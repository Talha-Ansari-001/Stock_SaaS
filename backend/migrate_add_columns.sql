-- ─────────────────────────────────────────────
-- MIGRATION: Add missing columns to existing DB
-- Run this if your DB was created with the old schema_1.sql
-- ─────────────────────────────────────────────
USE simple_saas_inventory;

-- Add email to tenants (if not exists)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Add buying_price and supplier_name to products (if not exists)
ALTER TABLE products ADD COLUMN IF NOT EXISTS buying_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255) NULL;

-- Add extra sales columns (if not exists)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255) NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_contact VARCHAR(100) NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS quantity_unit VARCHAR(50) NOT NULL DEFAULT 'Kg';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash';
