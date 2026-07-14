const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * @route   GET /api/reports/monthly
 * @desc    Get monthly aggregated gross revenue and net profit margins
 * @access  Private (Tenant isolated)
 */
router.get('/monthly', async (req, res) => {
  const tenantId = req.tenant_id;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant identifier missing from request context' });
  }

  try {
    // SQL query using DATE_FORMAT to group sales by month.
    // Handles division-by-zero using a CASE statement when gross revenue is 0.
    const query = `
      SELECT 
        DATE_FORMAT(sale_date, '%Y-%m') AS month,
        SUM(quantity * unit_price) AS gross_revenue,
        SUM(quantity * (unit_price - unit_cost)) AS net_profit,
        ROUND(
          CASE 
            WHEN SUM(quantity * unit_price) = 0 THEN 0 
            ELSE (SUM(quantity * (unit_price - unit_cost)) / SUM(quantity * unit_price)) * 100 
          END, 
          2
        ) AS net_profit_margin
      FROM sales
      WHERE tenant_id = ?
      GROUP BY DATE_FORMAT(sale_date, '%Y-%m')
      ORDER BY month ASC
    `;

    const [rows] = await pool.query(query, [tenantId]);

    // Format the response values for cleaner frontend consumption (convert string decimals to numbers)
    const formattedData = rows.map(row => ({
      month: row.month,
      gross_revenue: parseFloat(row.gross_revenue || 0),
      net_profit: parseFloat(row.net_profit || 0),
      net_profit_margin: parseFloat(row.net_profit_margin || 0)
    }));

    res.json({
      success: true,
      tenantId,
      data: formattedData
    });
  } catch (error) {
    console.error('Failed to generate monthly report:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error while generating report',
      details: error.message
    });
  }
});

module.exports = router;
