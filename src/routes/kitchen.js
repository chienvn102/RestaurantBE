/**
 * Kitchen Routes
 * GET /api/kitchen/queue - Get kitchen queue
 * PUT /api/kitchen/:id/status - Update kitchen item status
 * GET /api/kitchen/areas - Get kitchen areas
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/kitchen/queue
 * Get kitchen queue items
 */
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const { kitchen_area_id, status } = req.query;

    let query = `
      SELECT 
        kq.id, kq.order_id, kq.order_line_id, kq.menu_item_id, kq.qty,
        kq.kitchen_area_id, kq.status, kq.started_at, kq.completed_at,
        kq.created_at,
        o.order_number, o.table_id,
        t.name as table_name, t.area as table_area,
        m.name as item_name, m.prep_time_minutes,
        ol.modifiers, ol.note,
        ka.name as kitchen_area_name
      FROM kitchen_queue kq
      JOIN orders o ON kq.order_id = o.id
      JOIN tables t ON o.table_id = t.id
      JOIN menu_items m ON kq.menu_item_id = m.id
      LEFT JOIN order_lines ol ON kq.order_line_id = ol.id
      LEFT JOIN kitchen_areas ka ON kq.kitchen_area_id = ka.id
      WHERE 1=1
    `;
    
    const params = [];

    if (kitchen_area_id) {
      query += ' AND kq.kitchen_area_id = ?';
      params.push(kitchen_area_id);
    }

    if (status) {
      query += ' AND kq.status = ?';
      params.push(status);
    } else {
      // By default, show pending and cooking items
      query += " AND kq.status IN ('pending', 'cooking')";
    }

    query += ' ORDER BY kq.created_at ASC';

    const [items] = await pool.query(query, params);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Get kitchen queue error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get kitchen queue',
        code: 'GET_KITCHEN_QUEUE_ERROR'
      }
    });
  }
});

/**
 * PUT /api/kitchen/:id/status
 * Update kitchen item status
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'cooking', 'ready', 'served'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid status',
          code: 'INVALID_STATUS'
        }
      });
    }

    // Get kitchen queue item
    const [items] = await connection.query(
      `SELECT id, order_id, order_line_id, status, kitchen_area_id 
       FROM kitchen_queue WHERE id = ?`,
      [id]
    );

    if (items.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Kitchen item not found',
          code: 'KITCHEN_ITEM_NOT_FOUND'
        }
      });
    }

    const item = items[0];

    // Update kitchen queue status
    let updateQuery = 'UPDATE kitchen_queue SET status = ?';
    const updateParams = [status];

    if (status === 'cooking' && item.status === 'pending') {
      updateQuery += ', started_at = NOW()';
    } else if (status === 'ready' && item.status === 'cooking') {
      updateQuery += ', completed_at = NOW()';
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await connection.query(updateQuery, updateParams);

    // Update order line status
    if (status === 'ready') {
      await connection.query(
        'UPDATE order_lines SET status = ? WHERE id = ?',
        ['ready', item.order_line_id]
      );
    } else if (status === 'served') {
      await connection.query(
        'UPDATE order_lines SET status = ? WHERE id = ?',
        ['served', item.order_line_id]
      );
    }

    await connection.commit();

    // Emit socket event
    const io = req.app.get('io');
    
    if (status === 'ready') {
      io.to('role:waiter').emit('kitchen:item_ready', {
        kitchen_queue_id: id,
        order_id: item.order_id,
        order_line_id: item.order_line_id
      });
    }

    io.to(`area:${item.kitchen_area_id}`).emit('kitchen:status_changed', {
      kitchen_queue_id: id,
      status: status
    });

    res.json({
      success: true,
      data: {
        id: id,
        status: status,
        message: 'Kitchen item status updated'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update kitchen status error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update kitchen item status',
        code: 'UPDATE_KITCHEN_STATUS_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/kitchen/areas
 * Get all kitchen areas
 */
router.get('/areas', async (req, res) => {
  try {
    const [areas] = await pool.query(
      'SELECT id, name, description FROM kitchen_areas ORDER BY name'
    );

    res.json({
      success: true,
      data: areas
    });
  } catch (error) {
    console.error('Get kitchen areas error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get kitchen areas',
        code: 'GET_KITCHEN_AREAS_ERROR'
      }
    });
  }
});

module.exports = router;
