-- ─────────────────────────────────────────────
-- MIGRATION: Multi-Item Cart POS Support
-- Run once against your live database to enable POST /api/sales/multi
-- ─────────────────────────────────────────────
USE simple_saas_inventory;

-- -----------------------------------------------------
-- Table: orders
-- Holds the master record for each cart checkout session.
-- Each order maps 1-to-many rows in the `sales` table.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       VARCHAR(36)    NOT NULL,
    buyer_name      VARCHAR(255)   NOT NULL,
    contact_number  VARCHAR(50)    NOT NULL,
    payment_method  VARCHAR(20)    NOT NULL DEFAULT 'Cash',
    total_amount    DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMP      NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_orders_tenant (tenant_id),
    CONSTRAINT fk_orders_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Alter: sales — add order_id foreign key column
-- Links individual sale rows back to their parent order.
-- -----------------------------------------------------
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS order_id INT NULL AFTER tenant_id,
    ADD KEY IF NOT EXISTS idx_sales_order (order_id),
    ADD CONSTRAINT fk_sales_order
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL;
