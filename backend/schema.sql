/*
# Multi-tenant Scaling & Database Indexing Strategy
Every operational query in a shared-database multi-tenant SaaS architecture filters by the tenant's identifier (`WHERE tenant_id = ?`). Without correct indexes, MySQL is forced to scan every single row across all tenants (a full-table scan), leading to CPU spikes and high latency as the platform scales.

### Composite Indexes:
1. `products (tenant_id, sku)` via `uq_tenant_sku` (Unique Key):
   - Enforces unique SKUs per tenant context.
   - Optimizes searches for individual products (`WHERE tenant_id = ? AND sku = ?`) and catalog loading (`WHERE tenant_id = ?`).
2. `sales (tenant_id, sale_date)` via `idx_tenant_sale_date`:
   - Speeds up monthly aggregation queries, CSV reporting exports, and filtered list queries.
   - Allows MySQL to lock onto a specific tenant's space in memory and perform range scans strictly within the specified datetime boundaries, matching the leftmost column condition.
*/

CREATE DATABASE IF NOT EXISTS saas_inventory;
USE saas_inventory;

-- -----------------------------------------------------
-- Table: tenants
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY, -- Stores cryptographically safe UUID v4
    name VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255) NULL,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'trialing', -- e.g., 'trialing', 'active', 'past_due', 'canceled'
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'free', -- e.g., 'free', 'premium'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: users
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: products
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5, -- Low stock alert threshold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Composite Unique Key: Enforces tenant-scoped SKU uniqueness and indexes tenant lookups
    UNIQUE KEY uq_tenant_sku (tenant_id, sku),
    CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: sales
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    
    -- Composite Index: Optimizes monthly reports and export queries
    KEY idx_tenant_sale_date (tenant_id, sale_date)
) ENGINE=InnoDB;
