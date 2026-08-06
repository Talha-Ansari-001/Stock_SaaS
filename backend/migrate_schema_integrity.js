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
    console.log('Connected to MySQL. Executing schema integrity migration...');

    const addColumnIfMissing = async (tableName, columnName, definition) => {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [dbName, tableName, columnName]
      );
      if (columns.length === 0) {
        console.log(`Adding missing column \`${columnName}\` to ${tableName} table...`);
        await connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        console.log(`✓ Column \`${columnName}\` added to ${tableName}.`);
      } else {
        console.log(`ℹ Column \`${columnName}\` already exists in ${tableName}.`);
      }
    };

    // Sales table
    await addColumnIfMissing('sales', 'order_id', "INT");
    await addColumnIfMissing('sales', 'due_amount', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('sales', 'payment_status', "VARCHAR(20) DEFAULT 'Paid'");
    await addColumnIfMissing('sales', 'transportation_fee', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('sales', 'quantity_returned', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('sales', 'amount_refunded', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('sales', 'quantity_unit', "VARCHAR(50) DEFAULT 'Piece'");
    await addColumnIfMissing('sales', 'buyer_name', "VARCHAR(255)");
    await addColumnIfMissing('sales', 'buyer_contact', "VARCHAR(100)");

    // Orders table
    await addColumnIfMissing('orders', 'paid_amount', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('orders', 'due_amount', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('orders', 'payment_status', "VARCHAR(20) DEFAULT 'Paid'");
    await addColumnIfMissing('orders', 'transportation_fee', "DECIMAL(10,2) DEFAULT 0.00");

    // Products table
    await addColumnIfMissing('products', 'default_unit', "VARCHAR(50) DEFAULT 'Piece'");
    await addColumnIfMissing('products', 'allowed_units', "VARCHAR(100) DEFAULT 'Piece'");
    await addColumnIfMissing('products', 'kg_per_unit', "DECIMAL(10,2) DEFAULT 1.00");
    await addColumnIfMissing('products', 'buying_price', "DECIMAL(10,2) DEFAULT 0.00");
    await addColumnIfMissing('products', 'supplier_name', "VARCHAR(255)");

    // Handle amount_paid to paid_amount in sales table
    const [salesColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND COLUMN_NAME IN ('amount_paid', 'paid_amount')`,
      [dbName]
    );
    const colNames = salesColumns.map(c => c.COLUMN_NAME);
    if (colNames.includes('amount_paid') && !colNames.includes('paid_amount')) {
      console.log("Renaming amount_paid to paid_amount in sales table...");
      await connection.execute(`ALTER TABLE sales CHANGE amount_paid paid_amount DECIMAL(10,2) DEFAULT 0.00`);
      console.log("✓ Renamed amount_paid to paid_amount.");
    } else if (colNames.includes('amount_paid') && colNames.includes('paid_amount')) {
      console.log("Both amount_paid and paid_amount exist in sales. Merging data...");
      await connection.execute(`UPDATE sales SET paid_amount = amount_paid WHERE amount_paid IS NOT NULL AND amount_paid > 0`);
      await connection.execute(`ALTER TABLE sales DROP COLUMN amount_paid`);
      console.log("✓ Merged data and dropped amount_paid column.");
    } else {
      await addColumnIfMissing('sales', 'paid_amount', "DECIMAL(10,2) DEFAULT 0.00");
    }

    // Backfill sales
    console.log("Backfilling sales paid_amount...");
    const [salesBackfill] = await connection.execute(
      `UPDATE sales SET paid_amount = total_revenue 
       WHERE (paid_amount IS NULL OR paid_amount = 0) 
       AND total_revenue > 0 AND payment_status = 'Paid'`
    );
    console.log(`✓ Backfilled ${salesBackfill.affectedRows} sales records.`);

    // Backfill orders
    console.log("Backfilling orders paid_amount...");
    const [ordersBackfill] = await connection.execute(
      `UPDATE orders SET paid_amount = total_amount 
       WHERE (paid_amount IS NULL OR paid_amount = 0) 
       AND total_amount > 0 AND payment_status = 'Paid'`
    );
    console.log(`✓ Backfilled ${ordersBackfill.affectedRows} orders records.`);

    connection.release();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✕ Migration failed with error:', err.message);
    process.exit(1);
  }
}

runMigration();
