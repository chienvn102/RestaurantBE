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
 * GET /api/tables/floors
 * Get all floors with their tables
 * Requires authentication
 */
router.get('/floors', authenticateToken, async (req, res) => {
  try {
    // Get all floors ordered by sort_order
    const [floors] = await pool.query(
      'SELECT id, name, sort_order FROM floors ORDER BY sort_order'
    );

    // Get all tables with current orders
    const [tables] = await pool.query(`
      SELECT 
        t.id, t.floor_id, t.table_number, t.seats, t.status, t.qr_code_token,
        t.current_order_id,
        o.order_number, o.total, o.opened_at as order_created_at
      FROM tables t
      LEFT JOIN orders o ON t.current_order_id = o.id
      ORDER BY t.floor_id, t.table_number
    `);

    // Group tables by floor
    const floorsWithTables = floors.map(floor => ({
      ...floor,
      tables: tables.filter(t => t.floor_id === floor.id)
    }));

    res.json({
      success: true,
      data: floorsWithTables
    });
  } catch (error) {
    console.error('Get floors error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get floors',
        code: 'GET_FLOORS_ERROR'
      }
    });
  }
});

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

/**
 * POST /api/tables/:id/occupy
 * Occupy table and create new order
 * Cross-check: BACKEND.md, WORKFLOWS.md Diagram 1, database-schema.sql (tables, orders)
 */
router.post('/:id/occupy', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { employee_id } = req.body;

    // Check table exists and is available
    const [tables] = await connection.query(
      'SELECT id, status, table_number FROM tables WHERE id = ?',
      [id]
    );

    if (tables.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Table not found',
          code: 'TABLE_NOT_FOUND'
        }
      });
    }

    if (tables[0].status !== 'available') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: {
          message: 'Table is not available',
          code: 'TABLE_NOT_AVAILABLE'
        }
      });
    }

    // Create new order
    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_number, table_id, employee_id, status, source, opened_at)
       VALUES (?, ?, ?, 'open', 'pos', NOW())`,
      [`ORD-${Date.now()}`, id, employee_id]
    );

    const orderId = orderResult.insertId;

    // Update table status and link to order
    await connection.query(
      'UPDATE tables SET status = "occupied", current_order_id = ? WHERE id = ?',
      [orderId, id]
    );

    await connection.commit();

    // Get created order details
    const [orders] = await connection.query(
      'SELECT id, order_number, table_id, employee_id, status, total, opened_at FROM orders WHERE id = ?',
      [orderId]
    );

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('table:status-update', {
      table_id: parseInt(id),
      status: 'occupied',
      current_order_id: orderId
    });

    res.json({
      success: true,
      data: {
        table_id: parseInt(id),
        order: orders[0],
        message: 'Table occupied successfully'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Occupy table error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to occupy table',
        code: 'OCCUPY_TABLE_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/tables/:id/free
 * Free table (mark as available)
 * Cross-check: BACKEND.md, WORKFLOWS.md Diagram 6, database-schema.sql (tables)
 */
router.post('/:id/free', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check table exists
    const [tables] = await pool.query(
      'SELECT id, status, current_order_id FROM tables WHERE id = ?',
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

    // Update table to available and clear order
    await pool.query(
      'UPDATE tables SET status = "available", current_order_id = NULL WHERE id = ?',
      [id]
    );

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('table:status-update', {
      table_id: parseInt(id),
      status: 'available',
      current_order_id: null
    });

    res.json({
      success: true,
      data: {
        table_id: parseInt(id),
        status: 'available',
        message: 'Table freed successfully'
      }
    });
  } catch (error) {
    console.error('Free table error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to free table',
        code: 'FREE_TABLE_ERROR'
      }
    });
  }
});

module.exports = router;
