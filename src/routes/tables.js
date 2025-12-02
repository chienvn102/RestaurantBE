/**
 * Table Routes
 * GET /api/tables - List all tables
 * GET /api/tables/:id - Get table details
 * PUT /api/tables/:id/status - Update table status
 * POST /api/tables/:id/checkout - Checkout table
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/tables
 * Get all tables with current orders
 */
router.get('/', async (req, res) => {
  try {
    const { area, status } = req.query;

    let query = `
      SELECT 
        t.id, t.floor_id, t.table_number, t.seats, t.status, t.qr_code_token,
        t.current_order_id,
        f.name as floor_name,
        o.order_number, o.total, o.opened_at as order_created_at
      FROM tables t
      LEFT JOIN floors f ON t.floor_id = f.id
      LEFT JOIN orders o ON t.current_order_id = o.id
      WHERE 1=1
    `;
    
    const params = [];

    if (area) {
      query += ' AND t.floor_id = ?';
      params.push(area);
    }

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY t.floor_id, t.table_number';

    const [tables] = await pool.query(query, params);

    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get tables',
        code: 'GET_TABLES_ERROR'
      }
    });
  }
});

/**
 * GET /api/tables/:id
 * Get table details with current order
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [tables] = await pool.query(
      `SELECT 
        t.id, t.floor_id, t.table_number, t.seats, t.status, t.qr_code_token,
        t.current_order_id,
        f.name as floor_name,
        o.order_number, o.total, o.status as order_status
       FROM tables t
       LEFT JOIN floors f ON t.floor_id = f.id
       LEFT JOIN orders o ON t.current_order_id = o.id
       WHERE t.id = ?`,
      [id]
    );

    if (tables.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Table not found',
          code: 'TABLE_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: tables[0]
    });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get table',
        code: 'GET_TABLE_ERROR'
      }
    });
  }
});

/**
 * PUT /api/tables/:id/status
 * Update table status
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['available', 'occupied', 'reserved', 'cleaning'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid status',
          code: 'INVALID_STATUS'
        }
      });
    }

    await pool.query(
      'UPDATE tables SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    // Emit socket event
    const io = req.app.get('io');
    io.emit('table:status_changed', {
      table_id: id,
      status: status
    });

    res.json({
      success: true,
      data: {
        id: id,
        status: status,
        message: 'Table status updated'
      }
    });
  } catch (error) {
    console.error('Update table status error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update table status',
        code: 'UPDATE_TABLE_STATUS_ERROR'
      }
    });
  }
});

module.exports = router;
