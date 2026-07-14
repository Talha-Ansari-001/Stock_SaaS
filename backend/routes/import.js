const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * @route   POST /api/products/bulk-import
 * @desc    Optimized bulk product import using single MySQL insert query
 * @access  Private (Tenant isolated)
 */
router.post('/bulk-import', async (req, res) => {
  const tenantId = req.tenant_id;
  const { products } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context is missing' });
  }

  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'No products provided for import' });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Map product objects into nested array format suitable for bulk insert:
    // INSERT INTO products (...) VALUES ? takes an array of arrays [[val1, val2], [val1, val2]]
    const values = products.map(p => [
      tenantId,
      p.sku,
      p.name,
      p.description || '',
      parseFloat(p.price || 0),
      parseFloat(p.cost || 0),
      parseInt(p.stock || 0),
      parseInt(p.low_stock_threshold || 5)
    ]);

    const query = `
      INSERT INTO products (tenant_id, sku, name, description, price, cost, stock, low_stock_threshold) 
      VALUES ?
    `;

    // Execute bulk insert query
    const [result] = await connection.query(query, [values]);

    // Commit changes
    await connection.commit();

    res.status(201).json({
      success: true,
      message: `Successfully imported ${result.affectedRows} products`,
      importedCount: result.affectedRows
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Error during transaction rollback:', rollbackErr);
      }
    }
    
    console.error('Bulk import transaction failed:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        error: 'Bulk import failed due to duplicate entry. One or more SKU codes already exist for this business.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to process bulk import due to database error',
      details: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
