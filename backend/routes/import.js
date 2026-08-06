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

    let importedCount = 0;

    for (const p of products) {
      if (!p.name || p.name.trim() === '') {
        throw new Error(`Product name is required. Got empty name at row index ${importedCount}.`);
      }

      const name = p.name.trim();
      const quantity = parseFloat(p.quantity || 0);
      const price = parseFloat(p.price || 0);
      const buyingPrice = parseFloat(p.buying_price || 0);
      const kgPerUnit = parseFloat(p.kg_per_unit || 1);
      const defaultUnit = p.default_unit || 'Piece';
      const allowedUnits = p.allowed_units || 'Piece';
      const supplierName = p.supplier_name || null;

      // Check if product with same name already exists for this tenant
      const [existing] = await connection.execute(
        'SELECT id FROM products WHERE name = ? AND tenant_id = ?',
        [name, tenantId]
      );

      if (existing.length > 0) {
        // Replenish existing product stock
        await connection.execute(
          `UPDATE products 
           SET quantity = quantity + ?, price = ?, buying_price = ?, 
               kg_per_unit = ?, default_unit = ?, allowed_units = ?, supplier_name = ?
           WHERE id = ? AND tenant_id = ?`,
          [quantity, price, buyingPrice, kgPerUnit, defaultUnit, allowedUnits, supplierName, existing[0].id, tenantId]
        );
      } else {
        // Insert new product
        await connection.execute(
          `INSERT INTO products (tenant_id, name, quantity, price, buying_price, kg_per_unit, default_unit, allowed_units, supplier_name) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, name, quantity, price, buyingPrice, kgPerUnit, defaultUnit, allowedUnits, supplierName]
        );
      }

      importedCount++;
    }

    // Commit changes
    await connection.commit();

    res.status(201).json({
      success: true,
      message: `Successfully imported ${importedCount} products`,
      importedCount
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
        error: 'Bulk import failed due to duplicate entry. One or more product names already exist for this business.' 
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
