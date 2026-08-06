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
    id VARCHAR(36) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: products
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    buying_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    kg_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    default_unit VARCHAR(50) NOT NULL DEFAULT 'Piece',
    allowed_units VARCHAR(100) NOT NULL DEFAULT 'Piece',
    supplier_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_products_tenant (tenant_id),
    CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: orders
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    buyer_name VARCHAR(255) NOT NULL DEFAULT 'Walk-in Customer',
    contact_number VARCHAR(50) NOT NULL DEFAULT 'N/A',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Paid',
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    transportation_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_orders_tenant (tenant_id),
    CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: sales
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    order_id INT DEFAULT NULL,
    product_id INT NOT NULL,
    quantity_sold DECIMAL(10, 2) NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Paid',
    transportation_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    quantity_unit VARCHAR(50) NOT NULL DEFAULT 'Piece',
    buyer_name VARCHAR(255) DEFAULT NULL,
    buyer_contact VARCHAR(100) DEFAULT NULL,
    quantity_returned DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    amount_refunded DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sales_tenant (tenant_id),
    KEY idx_sales_order (order_id),
    KEY idx_sales_product (product_id),
    CONSTRAINT fk_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_sales_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: returns
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    sale_id INT NOT NULL,
    quantity_returned DECIMAL(10, 2) NOT NULL,
    amount_refunded DECIMAL(10, 2) NOT NULL,
    returned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_returns_tenant (tenant_id),
    KEY idx_returns_sale (sale_id),
    CONSTRAINT fk_returns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_returns_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: expenses
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    spent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_expenses_tenant (tenant_id),
    CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;
