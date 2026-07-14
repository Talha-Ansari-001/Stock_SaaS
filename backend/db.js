const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'saas_inventory',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL database pool.');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed. Please ensure MySQL is running and credentials are correct.');
    console.error('Error Details:', error.message);
  }
})();

// -----------------------------------------------------
// Production Seeding & Schema Guard
// -----------------------------------------------------
// Intercept all database commands in production to prevent destructive commands (DROP, TRUNCATE)
const originalQuery = pool.query;
pool.query = function (sql, values) {
  if (process.env.NODE_ENV === 'production') {
    const sqlString = typeof sql === 'string' ? sql : (sql.text || '');
    const normalizedSql = sqlString.trim().toLowerCase();
    
    if (
      normalizedSql.includes('drop table') || 
      normalizedSql.includes('truncate table') || 
      normalizedSql.includes('drop database') ||
      normalizedSql.includes('drop schema')
    ) {
      console.error(`⚠️ CRITICAL SAFETY BLOCK: Blocked destructive query on production database: "${sqlString}"`);
      return Promise.reject(new Error('CRITICAL SAFETY BLOCK: Destructive operations (DROP/TRUNCATE/DROP DATABASE) are strictly forbidden in production environments.'));
    }
  }
  return originalQuery.apply(pool, arguments);
};

const originalExecute = pool.execute;
pool.execute = function (sql, values) {
  if (process.env.NODE_ENV === 'production') {
    const sqlString = typeof sql === 'string' ? sql : (sql.text || '');
    const normalizedSql = sqlString.trim().toLowerCase();
    
    if (
      normalizedSql.includes('drop table') || 
      normalizedSql.includes('truncate table') || 
      normalizedSql.includes('drop database') ||
      normalizedSql.includes('drop schema')
    ) {
      console.error(`⚠️ CRITICAL SAFETY BLOCK: Blocked destructive execution on production database: "${sqlString}"`);
      return Promise.reject(new Error('CRITICAL SAFETY BLOCK: Destructive operations (DROP/TRUNCATE/DROP DATABASE) are strictly forbidden in production environments.'));
    }
  }
  return originalExecute.apply(pool, arguments);
};

module.exports = pool;
