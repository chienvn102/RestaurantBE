/**
 * Payment Routes
 * POST /api/payments - Process payment
 * GET /api/payments/:id - Get payment details
 * POST /api/payments/:id/refund - Refund payment
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const paymentService = require('../services/payment.service');

/**
 * POST /api/payments
 * Process payment for an order
 */
router.post('/', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'order_id is required',
          code: 'MISSING_ORDER_ID'
        }
      });
    }

    // Process payment using service
    const result = await paymentService.processPayment(
      order_id,
      req.body,
      req.user.id,
      connection
    );

    // Log activity
    await connection.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'payment', 'order', order_id, JSON.stringify(result)]
    );

    await connection.commit();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('payment:completed', {
      order_id: result.order_id,
      payment_id: result.payment_id,
      table_id: result.table_id
    });

    io.emit('table:status_changed', {
      table_id: result.table_id,
      status: 'needs_cleaning'
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    await connection.rollback();
    console.error('Payment error:', error);
    
    if (error.message === 'ORDER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    } else if (error.message === 'ORDER_ALREADY_PAID') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Order already paid',
          code: 'ORDER_ALREADY_PAID'
        }
      });
    } else if (error.message === 'INSUFFICIENT_PAYMENT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Payment amount is less than order total',
          code: 'INSUFFICIENT_PAYMENT'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Payment processing failed',
        code: 'PAYMENT_ERROR',
        details: error.message
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/payments/:id
 * Get payment details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [payments] = await pool.query(
      `SELECT 
        p.id, p.order_id, p.payment_method_id, p.amount, p.discount_amount,
        p.tax_amount, p.final_amount, p.amount_paid, p.change_amount,
        p.note, p.created_at,
        pm.name as payment_method,
        o.order_number,
        e.full_name as processed_by_name
       FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       JOIN orders o ON p.order_id = o.id
       LEFT JOIN employees e ON p.processed_by = e.id
       WHERE p.id = ?`,
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: payments[0]
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get payment',
        code: 'GET_PAYMENT_ERROR'
      }
    });
  }
});

/**
 * GET /api/payments/methods
 * Get all payment methods
 */
router.get('/methods/list', async (req, res) => {
  try {
    const [methods] = await pool.query(
      'SELECT id, name, is_active FROM payment_methods WHERE is_active = 1 ORDER BY name'
    );

    res.json({
      success: true,
      data: methods
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get payment methods',
        code: 'GET_PAYMENT_METHODS_ERROR'
      }
    });
  }
});

module.exports = router;
