CREATE DATABASE IF NOT EXISTS simple_saas_inventory;
USE simple_saas_inventory;

-- 1. Separates Trader A from Trader B
CREATE TABLE tenants (
    id VARCHAR(36) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stores inventory item quantities
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3. Logs sales records and automatically accumulates revenue
CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity_sold INT NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);