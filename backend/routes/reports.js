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
    // Query uses actual schema columns:
    //   sales.sold_at         (not sale_date)
    //   sales.total_revenue   (pre-computed line total)
    //   products.buying_price (unit cost)
    //   sales.quantity_sold   (qty sold)
    //   sales.quantity_returned / amount_refunded (return adjustments)
    const query = `
      SELECT 
        DATE_FORMAT(s.sold_at, '%Y-%m') AS month,
        SUM(s.total_revenue - s.amount_refunded) AS gross_revenue,
        SUM(
          (s.total_revenue - s.amount_refunded) - 
          ((s.quantity_sold - s.quantity_returned) * p.buying_price)
        ) AS net_profit,
        ROUND(
          CASE 
            WHEN SUM(s.total_revenue - s.amount_refunded) = 0 THEN 0 
            ELSE (
              SUM(
                (s.total_revenue - s.amount_refunded) - 
                ((s.quantity_sold - s.quantity_returned) * p.buying_price)
              ) / SUM(s.total_revenue - s.amount_refunded)
            ) * 100 
          END, 
          2
        ) AS net_profit_margin
      FROM sales s
      JOIN products p ON s.product_id = p.id AND p.tenant_id = ?
      WHERE s.tenant_id = ?
      GROUP BY DATE_FORMAT(s.sold_at, '%Y-%m')
      ORDER BY month ASC
    `;

    const [rows] = await pool.query(query, [tenantId, tenantId]);

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
