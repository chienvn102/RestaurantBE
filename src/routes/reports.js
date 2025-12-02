/**
 * Reports Routes
 * GET /api/reports/sales - Sales report
 * GET /api/reports/top-items - Top selling items
 * GET /api/reports/daily-summary - Daily summary
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * GET /api/reports/sales
 * Sales report by date range
 */
router.get('/sales', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'start_date and end_date are required',
          code: 'MISSING_DATES'
        }
      });
    }

    const [sales] = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        SUM(total_amount) as gross_sales,
        SUM(discount_amount) as total_discounts,
        SUM(tax_amount) as total_tax,
        SUM(final_amount) as net_sales
       FROM orders
       WHERE status IN ('paid', 'completed')
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [start_date, end_date]
    );

    // Calculate totals
    const totals = sales.reduce((acc, row) => ({
      total_orders: acc.total_orders + row.total_orders,
      gross_sales: acc.gross_sales + parseFloat(row.gross_sales),
      total_discounts: acc.total_discounts + parseFloat(row.total_discounts),
      total_tax: acc.total_tax + parseFloat(row.total_tax),
      net_sales: acc.net_sales + parseFloat(row.net_sales)
    }), {
      total_orders: 0,
      gross_sales: 0,
      total_discounts: 0,
      total_tax: 0,
      net_sales: 0
    });

    res.json({
      success: true,
      data: {
        daily: sales,
        totals: totals
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate sales report',
        code: 'SALES_REPORT_ERROR'
      }
    });
  }
});

/**
 * GET /api/reports/top-items
 * Top selling menu items
 */
router.get('/top-items', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    let query = `
      SELECT 
        m.id, m.name, m.category_id, c.name as category_name,
        COUNT(ol.id) as times_ordered,
        SUM(ol.qty) as total_quantity,
        SUM(ol.line_total) as total_revenue
      FROM order_lines ol
      JOIN menu_items m ON ol.menu_item_id = m.id
      JOIN orders o ON ol.order_id = o.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE o.status IN ('paid', 'completed')
    `;
    
    const params = [];

    if (start_date && end_date) {
      query += ' AND DATE(o.created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += `
      GROUP BY m.id, m.name, m.category_id, c.name
      ORDER BY total_revenue DESC
      LIMIT ?
    `;
    params.push(parseInt(limit));

    const [items] = await pool.query(query, params);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Top items report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate top items report',
        code: 'TOP_ITEMS_REPORT_ERROR'
      }
    });
  }
});

/**
 * GET /api/reports/daily-summary
 * Daily summary for today
 */
router.get('/daily-summary', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    // Get sales summary
    const [sales] = await pool.query(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as gross_sales,
        SUM(discount_amount) as total_discounts,
        SUM(final_amount) as net_sales,
        AVG(final_amount) as avg_order_value
       FROM orders
       WHERE status IN ('paid', 'completed')
         AND DATE(created_at) = ?`,
      [reportDate]
    );

    // Get payment methods breakdown
    const [paymentMethods] = await pool.query(
      `SELECT 
        pm.name as payment_method,
        COUNT(p.id) as count,
        SUM(p.final_amount) as total
       FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       JOIN orders o ON p.order_id = o.id
       WHERE DATE(p.created_at) = ?
       GROUP BY pm.id, pm.name`,
      [reportDate]
    );

    // Get current open orders
    const [openOrders] = await pool.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status = 'open' AND DATE(created_at) = ?`,
      [reportDate]
    );

    res.json({
      success: true,
      data: {
        date: reportDate,
        sales: sales[0],
        payment_methods: paymentMethods,
        open_orders: openOrders[0].count
      }
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate daily summary',
        code: 'DAILY_SUMMARY_ERROR'
      }
    });
  }
});

/**
 * GET /api/reports/payment-methods
 * Payment methods summary
 */
router.get('/payment-methods', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        pm.name as payment_method,
        COUNT(p.id) as transaction_count,
        SUM(p.final_amount) as total_amount
      FROM payments p
      JOIN payment_methods pm ON p.payment_method_id = pm.id
      WHERE 1=1
    `;
    
    const params = [];

    if (start_date && end_date) {
      query += ' AND DATE(p.created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' GROUP BY pm.id, pm.name ORDER BY total_amount DESC';

    const [methods] = await pool.query(query, params);

    res.json({
      success: true,
      data: methods
    });
  } catch (error) {
    console.error('Payment methods report error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate payment methods report',
        code: 'PAYMENT_METHODS_REPORT_ERROR'
      }
    });
  }
});

module.exports = router;
