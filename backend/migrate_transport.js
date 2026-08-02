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

    if (!salesColNames.includes('transportation_fee')) {
      console.log("Adding transportation_fee to sales...");
      await connection.query("ALTER TABLE sales ADD COLUMN transportation_fee DECIMAL(10, 2) DEFAULT 0.00");
    }

    console.log("Fetching orders table schema...");
    const [ordersColumns] = await connection.query('SHOW COLUMNS FROM orders');
    const ordersColNames = ordersColumns.map(c => c.Field);

    if (!ordersColNames.includes('transportation_fee')) {
      console.log("Adding transportation_fee to orders...");
      await connection.query("ALTER TABLE orders ADD COLUMN transportation_fee DECIMAL(10, 2) DEFAULT 0.00");
    }

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

runMigration();
