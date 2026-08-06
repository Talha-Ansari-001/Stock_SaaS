-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 001: Add missing FK constraints and Stripe SaaS columns
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Add FK constraint on expenses.tenant_id (missing from schema.sql)
--    The column and index already exist; only the constraint is missing.
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expenses'
    AND CONSTRAINT_NAME = 'fk_expenses_tenant'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE expenses ADD CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT ''FK fk_expenses_tenant already exists — skipping'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 2. Add Stripe subscription columns to tenants table (for webhooks.js)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) NOT NULL DEFAULT 'free';

-- 3. Add index on stripe_customer_id for webhook lookups
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenants'
    AND INDEX_NAME = 'idx_tenants_stripe_customer'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE tenants ADD INDEX idx_tenants_stripe_customer (stripe_customer_id)',
  'SELECT ''Index idx_tenants_stripe_customer already exists — skipping'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 4. Composite index on (tenant_id, sold_at) for date-range report queries
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sales'
    AND INDEX_NAME = 'idx_sales_tenant_date'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE sales ADD INDEX idx_sales_tenant_date (tenant_id, sold_at)',
  'SELECT ''Index idx_sales_tenant_date already exists — skipping'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────────────────────────────
-- END OF MIGRATION 001
-- ─────────────────────────────────────────────────────────────────────
