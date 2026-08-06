const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * @route   GET /api/reports/export-csv
 * @desc    Export sales data for a specific month as downloadable RFC 4180 compliant CSV
 * @access  Private (Tenant isolated)
 */
router.get('/export-csv', async (req, res) => {
  const tenantId = req.tenant_id;
  const { month } = req.query; // Expecting format 'YYYY-MM', e.g. '2026-07'

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context is missing' });
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Valid month parameter (YYYY-MM) is required' });
  }

  let connection;

  try {
    connection = await pool.getConnection();

    // Query uses actual schema columns:
    //   sales.sold_at          (not sale_date)
    //   products.name          (not sku — sku column doesn't exist)
    //   sales.quantity_sold    (not quantity)
    //   sales.total_revenue    (pre-computed line total)
    //   products.buying_price  (unit cost)
    const query = `
      SELECT 
        s.sold_at,
        p.name AS product_name,
        s.quantity_sold,
        s.quantity_unit,
        s.total_revenue,
        p.buying_price,
        (s.quantity_sold * p.buying_price) AS total_cost,
        (s.total_revenue - (s.quantity_sold * p.buying_price)) AS net_profit,
        s.payment_method,
        s.payment_status,
        s.quantity_returned,
        s.amount_refunded
      FROM sales s
      JOIN products p ON s.product_id = p.id AND p.tenant_id = ?
      WHERE s.tenant_id = ? AND DATE_FORMAT(s.sold_at, '%Y-%m') = ?
      ORDER BY s.sold_at DESC
    `;

    const [rows] = await connection.query(query, [tenantId, tenantId, month]);

    // Build the CSV string matching standard RFC 4180 specs
    let csvString = 'Date,Product Name,Quantity Sold,Unit,Total Revenue,Buying Price,Total Cost,Net Profit,Payment Method,Payment Status,Qty Returned,Amount Refunded\n';

    for (const row of rows) {
      // Format timestamps cleanly
      const formattedDate = new Date(row.sold_at).toISOString().replace('T', ' ').substring(0, 19);
      // Escape Product Name to protect against quotes and commas breaking columns
      const escapedName = `"${row.product_name.replace(/"/g, '""')}"`;
      
      csvString += `${formattedDate},${escapedName},${row.quantity_sold},${row.quantity_unit},${row.total_revenue},${row.buying_price},${row.total_cost},${row.net_profit},${row.payment_method},${row.payment_status},${row.quantity_returned},${row.amount_refunded}\n`;
    }

    // Set response headers to force download in browser
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sales_report_${tenantId.substring(0, 8)}_${month}.csv"`);
    
    // Send CSV string
    res.status(200).send(csvString);

  } catch (error) {
    console.error('CSV export failed:', error);
    res.status(500).json({ 
      error: 'Internal server error constructing CSV download', 
      details: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
