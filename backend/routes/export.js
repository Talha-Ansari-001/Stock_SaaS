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

    // Query sales and join product data to construct transaction records
    const query = `
      SELECT 
        s.sale_date,
        p.sku,
        p.name AS product_name,
        s.quantity,
        s.unit_price,
        s.unit_cost,
        (s.quantity * s.unit_price) AS gross_revenue,
        (s.quantity * s.unit_cost) AS total_cost,
        (s.quantity * (s.unit_price - s.unit_cost)) AS net_profit
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.tenant_id = ? AND DATE_FORMAT(s.sale_date, '%Y-%m') = ?
      ORDER BY s.sale_date DESC
    `;

    const [rows] = await connection.query(query, [tenantId, month]);

    // Build the CSV string matching standard RFC 4180 specs
    let csvString = 'Date,SKU,Product Name,Quantity,Unit Price,Unit Cost,Gross Revenue,Total Cost,Net Profit\n';

    for (const row of rows) {
      // Format timestamps cleanly
      const formattedDate = new Date(row.sale_date).toISOString().replace('T', ' ').substring(0, 19);
      // Escape SKU and Product Name to protect against quotes and commas breaking columns
      const escapedSKU = `"${row.sku.replace(/"/g, '""')}"`;
      const escapedName = `"${row.product_name.replace(/"/g, '""')}"`;
      
      csvString += `${formattedDate},${escapedSKU},${escapedName},${row.quantity},${row.unit_price},${row.unit_cost},${row.gross_revenue},${row.total_cost},${row.net_profit}\n`;
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
