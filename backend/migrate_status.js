const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  console.log("Connecting to Aiven MySQL database...");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log("Fetching sales table schema...");
    const [salesColumns] = await connection.query('SHOW COLUMNS FROM sales');
    const salesColNames = salesColumns.map(c => c.Field);

    if (!salesColNames.includes('payment_status')) {
      console.log("Adding payment_status to sales...");
      await connection.query("ALTER TABLE sales ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Paid'");
    }

    console.log("Fetching orders table schema...");
    const [ordersColumns] = await connection.query('SHOW COLUMNS FROM orders');
    const ordersColNames = ordersColumns.map(c => c.Field);

    if (!ordersColNames.includes('payment_status')) {
      console.log("Adding payment_status to orders...");
      await connection.query("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Paid'");
    }

    console.log("Updating payment_status based on amount_paid...");
    await connection.query("UPDATE sales SET payment_status = IF(amount_paid < total_revenue, 'Unpaid', 'Paid') WHERE payment_status IS NULL");
    await connection.query("UPDATE orders SET payment_status = 'Paid' WHERE payment_status IS NULL"); // Just a default

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

runMigration();
