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
    console.log("Fetching products table schema...");
    const [columns] = await connection.query('SHOW COLUMNS FROM products');
    const colNames = columns.map(c => c.Field);
    console.log("Columns:", colNames);

    console.log("Executing schema alter migration (MODIFY quantity, price)...");
    await connection.query(`
      ALTER TABLE products 
      MODIFY COLUMN quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      MODIFY COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
    `);

    if (!colNames.includes('default_unit')) {
      console.log("Adding default_unit column...");
      await connection.query("ALTER TABLE products ADD COLUMN default_unit VARCHAR(50) DEFAULT 'Piece'");
    }
    if (!colNames.includes('allowed_units')) {
      console.log("Adding allowed_units column...");
      await connection.query("ALTER TABLE products ADD COLUMN allowed_units VARCHAR(100) DEFAULT 'Piece'");
    }
    if (!colNames.includes('kg_per_unit')) {
      console.log("Adding kg_per_unit column...");
      await connection.query("ALTER TABLE products ADD COLUMN kg_per_unit DECIMAL(10, 2) DEFAULT 1.00");
    }

    console.log("Updating Sand/Reti units to Bags & Kg with 50 Kg/Bag conversion...");
    const [result] = await connection.query(`
      UPDATE products
      SET default_unit = 'Bags',
      allowed_units = 'Bags,Kg',
      kg_per_unit = 50.00
      WHERE LOWER(name) LIKE '%sand%' OR LOWER(name) LIKE '%reti%';
    `);
    console.log(`Updated ${result.affectedRows} rows.`);

    console.log("Verifying migration...");
    const [rows] = await connection.query(`
      SELECT name, default_unit, kg_per_unit 
      FROM products 
      WHERE LOWER(name) LIKE '%sand%' OR LOWER(name) LIKE '%reti%';
    `);
    console.log("Sand/Reti records:", rows);
    
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

runMigration();
