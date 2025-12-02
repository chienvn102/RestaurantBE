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
        t.current_order_id, t.position_x, t.position_y, t.shape,
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

    // Cross-check with database-schema.sql: tables.status ENUM('available','occupied','reserved','needs_cleaning')
    if (!['available', 'occupied', 'reserved', 'needs_cleaning'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid status. Must be: available, occupied, reserved, needs_cleaning',
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

/**
 * PUT /api/tables/batch/positions
 * Batch update table positions (save entire floor layout)
 * IMPORTANT: Must be BEFORE /:id/position to avoid route conflict
 * Cross-check: database-schema.sql (position_x, position_y)
 */
router.put('/batch/positions', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { tables } = req.body;

    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid tables array',
          code: 'INVALID_INPUT'
        }
      });
    }

    await connection.beginTransaction();

    // Update each table position
    for (const table of tables) {
      const { id, position_x, position_y, shape } = table;

      if (!id || position_x === undefined || position_y === undefined) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: {
            message: 'Each table must have id, position_x, position_y',
            code: 'INVALID_TABLE_DATA'
          }
        });
      }

      const updateFields = ['position_x = ?', 'position_y = ?'];
      const updateValues = [position_x, position_y];

      if (shape) {
        updateFields.push('shape = ?');
        updateValues.push(shape);
      }

      updateValues.push(id);

      await connection.query(
        `UPDATE tables SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        updateValues
      );
    }

    await connection.commit();

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('tables:layout-update', {
      tables: tables.map(t => ({
        table_id: t.id,
        position_x: t.position_x,
        position_y: t.position_y,
        shape: t.shape || null
      }))
    });

    res.json({
      success: true,
      data: {
        updated_count: tables.length,
        message: 'Table positions updated successfully'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Batch update positions error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update table positions',
        code: 'BATCH_UPDATE_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/tables/:id/position
 * Update table position (for drag-and-drop floor editor)
 * Cross-check: database-schema.sql (position_x, position_y, shape columns)
 */
router.put('/:id/position', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { position_x, position_y, shape } = req.body;

    // Validate inputs
    if (position_x === undefined || position_y === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'position_x and position_y are required',
          code: 'INVALID_POSITION'
        }
      });
    }

    // Check table exists
    const [tables] = await pool.query(
      'SELECT id FROM tables WHERE id = ?',
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

    // Update position
    const updateFields = ['position_x = ?', 'position_y = ?'];
    const updateValues = [position_x, position_y];

    if (shape) {
      updateFields.push('shape = ?');
      updateValues.push(shape);
    }

    updateValues.push(id);

    await pool.query(
      `UPDATE tables SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      updateValues
    );

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('table:position-update', {
      table_id: parseInt(id),
      position_x,
      position_y,
      shape: shape || null
    });

    res.json({
      success: true,
      data: {
        id: parseInt(id),
        position_x,
        position_y,
        shape: shape || null,
        message: 'Table position updated'
      }
    });
  } catch (error) {
    console.error('Update table position error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update table position',
        code: 'UPDATE_POSITION_ERROR'
      }
    });
  }
});

module.exports = router;
