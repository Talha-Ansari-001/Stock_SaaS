CREATE DATABASE IF NOT EXISTS simple_saas_inventory;
USE simple_saas_inventory;

-- 1. Separates Trader A from Trader B
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stores inventory item quantities
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    quantity INT NOT NULL DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    buying_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    supplier_name VARCHAR(255) NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3. Logs sales records and automatically accumulates revenue
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity_sold DECIMAL(10, 2) NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    buyer_name VARCHAR(255) NULL,
    buyer_contact VARCHAR(100) NULL,
    quantity_unit VARCHAR(50) NOT NULL DEFAULT 'Kg',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);