const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'defaultdb',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    const connection = await pool.getConnection();
    console.log("Connected to Aiven Database!");
    
    // 1. Create orders table
    const createOrdersSql = `
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
    `;
    console.log("Creating orders table...");
    await connection.query(createOrdersSql);

    // 2. Add order_id column (ignoring ER_DUP_FIELDNAME)
    console.log("Adding order_id to sales table...");
    try {
      await connection.query(`ALTER TABLE sales ADD COLUMN order_id INT NULL AFTER tenant_id`);
      await connection.query(`ALTER TABLE sales ADD KEY idx_sales_order (order_id)`);
      await connection.query(`ALTER TABLE sales ADD CONSTRAINT fk_sales_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL`);
      console.log("Columns and keys added successfully.");
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log("order_id column already exists on sales table. Skipping alter.");
      } else {
        throw err;
      }
    }

    console.log("Migration executed successfully!");
    connection.release();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
