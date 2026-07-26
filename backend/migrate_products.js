const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  console.log('Connecting to database...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'defaultdb',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    waitForConnections: true,
    connectionLimit: 5
  });

  const dbName = process.env.DB_NAME || process.env.DB_DATABASE || 'defaultdb';

  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL. Executing migrations for `products` table...');

    // 1. Helper helper function to add column if missing safely
    const addColumnIfMissing = async (columnName, definition) => {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = ?`,
        [dbName, columnName]
      );
      if (columns.length === 0) {
        console.log(`Adding missing column \`${columnName}\` to products table...`);
        await connection.execute(`ALTER TABLE products ADD COLUMN ${columnName} ${definition}`);
        console.log(`✓ Column \`${columnName}\` added.`);
      } else {
        console.log(`ℹ Column \`${columnName}\` already exists.`);
      }
    };

    // Add required dynamic unit columns safely
    await addColumnIfMissing('default_unit', "VARCHAR(50) NOT NULL DEFAULT 'Piece'");
    await addColumnIfMissing('allowed_units', "VARCHAR(100) NOT NULL DEFAULT 'Piece'");
    await addColumnIfMissing('kg_per_unit', "DECIMAL(10, 2) NOT NULL DEFAULT 1.00");

    // 2. Data Patching & Cleanup
    console.log('Running data patching and cleanup...');

    // Replace NULL, 0, or invalid values in kg_per_unit with 1.00
    const [kgUpdate] = await connection.execute(
      `UPDATE products SET kg_per_unit = 1.00 WHERE kg_per_unit IS NULL OR kg_per_unit <= 0`
    );
    console.log(`✓ Updated ${kgUpdate.affectedRows} product records with default kg_per_unit = 1.00.`);

    // Set default_unit = 'Piece' wherever default_unit is NULL or empty
    const [unitUpdate] = await connection.execute(
      `UPDATE products SET default_unit = 'Piece' WHERE default_unit IS NULL OR TRIM(default_unit) = ''`
    );
    console.log(`✓ Updated ${unitUpdate.affectedRows} product records with default_unit = 'Piece'.`);

    // Set allowed_units = 'Piece' wherever allowed_units is NULL or empty
    const [allowedUpdate] = await connection.execute(
      `UPDATE products SET allowed_units = 'Piece' WHERE allowed_units IS NULL OR TRIM(allowed_units) = ''`
    );
    console.log(`✓ Updated ${allowedUpdate.affectedRows} product records with allowed_units = 'Piece'.`);

    connection.release();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✕ Migration failed with error:', err.message);
    process.exit(1);
  }
}

runMigration();
