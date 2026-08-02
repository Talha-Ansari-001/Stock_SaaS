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
    console.log("Backfilling orders for single-item sales...");
    const [orphanSales] = await connection.query("SELECT * FROM sales WHERE order_id IS NULL");
    console.log(`Found ${orphanSales.length} orphan sales.`);

    for (const sale of orphanSales) {
      const [orderResult] = await connection.query(
        `INSERT INTO orders (tenant_id, buyer_name, contact_number, payment_method, payment_status, total_amount, transportation_fee, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sale.tenant_id, sale.buyer_name || 'Walk-in Customer', sale.buyer_contact || 'N/A', sale.payment_method, sale.payment_status || 'Paid', sale.total_revenue, sale.transportation_fee || 0, sale.sold_at]
      );
      
      const newOrderId = orderResult.insertId;
      await connection.query("UPDATE sales SET order_id = ? WHERE id = ?", [newOrderId, sale.id]);
    }

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

runMigration();
