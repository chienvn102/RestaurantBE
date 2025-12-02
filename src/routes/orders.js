/**
 * Order Routes
 * POST /api/orders - Create new order
 * GET /api/orders - List orders
 * GET /api/orders/:id - Get order details
 * PUT /api/orders/:id/status - Update order status
 * POST /api/orders/:id/lines - Add item to order
 * DELETE /api/orders/:id/lines/:line_id - Remove item from order
 * POST /api/orders/:id/send-to-kitchen - Send order to kitchen
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const orderService = require('../services/order.service');

/**
 * POST /api/orders
 * Create new order
 */
router.post('/', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { table_id, customer_count, source, note } = req.body;

    if (!table_id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'table_id is required',
          code: 'MISSING_TABLE_ID'
        }
      });
    }

    // Validate table availability
    await orderService.validateTableForOrder(table_id, connection);

    // Create order using service
    const order = await orderService.getOrCreateOrderForTable(
      table_id,
      req.user.id,
      req.user.employee_id,
      source || 'pos',
      connection
    );

    // Update customer count and note if provided
    if (customer_count || note) {
      await connection.query(
        'UPDATE orders SET customer_count = ?, note = ? WHERE id = ?',
        [customer_count || 1, note, order.id]
      );
    }

    await connection.commit();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('order:created', {
      id: order.id,
      order_number: order.order_number,
      table_id: table_id,
      status: 'open'
    });

    res.status(201).json({
      success: true,
      data: {
        id: order.id,
        order_number: order.order_number,
        table_id: table_id,
        status: 'open',
        total_amount: 0
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    
    if (error.message === 'TABLE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Table not found',
          code: 'TABLE_NOT_FOUND'
        }
      });
    } else if (error.message === 'TABLE_NEEDS_CLEANING') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Table needs cleaning',
          code: 'TABLE_NEEDS_CLEANING'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create order',
        code: 'CREATE_ORDER_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/orders
 * List orders with filters
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, table_id, date } = req.query;

    let query = `
      SELECT 
        o.id, o.order_number, o.table_id, o.status, o.customer_count,
        o.total_amount, o.discount_amount, o.tax_amount, o.final_amount,
        o.created_at, o.updated_at,
        t.name as table_name, t.area as table_area,
        e.full_name as waiter_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN employees e ON o.waiter_id = e.id
      WHERE 1=1
    `;
    
    const params = [];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (table_id) {
      query += ' AND o.table_id = ?';
      params.push(table_id);
    }

    if (date) {
      query += ' AND DATE(o.created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 100';

    const [orders] = await pool.query(query, params);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get orders',
        code: 'GET_ORDERS_ERROR'
      }
    });
  }
});

/**
 * GET /api/orders/:id
 * Get order details with items
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get order header
    const [orders] = await pool.query(
      `SELECT 
        o.id, o.order_number, o.table_id, o.status,
        o.subtotal, o.discount, o.tax, o.total,
        o.notes, o.created_at, o.updated_at,
        t.table_number as table_name,
        e.full_name as waiter_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN employees e ON o.employee_id = e.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Get order lines
    const [lines] = await pool.query(
      `SELECT 
        ol.id, ol.menu_item_id, ol.quantity as qty, ol.unit_price, ol.line_total,
        ol.modifiers, ol.note, ol.kitchen_status as status,
        ol.menu_item_name as item_name,
        m.image_url
       FROM order_lines ol
       LEFT JOIN menu_items m ON ol.menu_item_id = m.id
       WHERE ol.order_id = ?
       ORDER BY ol.id`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...orders[0],
        items: lines
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get order',
        code: 'GET_ORDER_ERROR'
      }
    });
  }
});

/**
 * POST /api/orders/:id/lines
 * Add item to order
 */
router.post('/:id/lines', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { menu_item_id, qty, modifiers, note } = req.body;

    if (!menu_item_id || !qty) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'menu_item_id and qty are required',
          code: 'MISSING_FIELDS'
        }
      });
    }

    // Get menu item price and name
    const [items] = await connection.query(
      'SELECT id, name, base_price FROM menu_items WHERE id = ?',
      [menu_item_id]
    );

    if (items.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Menu item not found',
          code: 'MENU_ITEM_NOT_FOUND'
        }
      });
    }

    const menuItem = items[0];
    const lineTotal = parseFloat(menuItem.base_price) * qty;

    // Insert order line
    const [result] = await connection.query(
      `INSERT INTO order_lines 
       (order_id, menu_item_id, menu_item_name, quantity, unit_price, line_total, modifiers, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, menu_item_id, menuItem.name, qty, menuItem.base_price, lineTotal, JSON.stringify(modifiers || []), note]
    );

    await connection.commit();

    // Emit socket event
    const io = req.app.get('io');
    io.emit('order:updated', {
      order_id: id,
      action: 'item_added',
      line_id: result.insertId
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        order_id: id,
        menu_item_id: menu_item_id,
        menu_item_name: menuItem.name,
        qty: qty,
        unit_price: menuItem.base_price,
        line_total: lineTotal
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Add order line error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to add item to order',
        code: 'ADD_ORDER_LINE_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/orders/:id/send-to-kitchen
 * Send order to kitchen
 */
router.post('/:id/send-to-kitchen', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Send to kitchen using service
    const kitchenItems = await orderService.sendOrderToKitchen(id, connection);

    await connection.commit();

    // Emit socket event to kitchen
    const io = req.app.get('io');
    
    // Notify kitchen by area
    kitchenItems.forEach(item => {
      io.to(`area:${item.kitchen_area_id}`).emit('kitchen:new_items', {
        order_id: id,
        kitchen_queue_id: item.kitchen_queue_id,
        item: item
      });
    });

    // Notify all chefs
    io.to('role:chef').emit('kitchen:new_items', {
      order_id: id,
      items: kitchenItems
    });

    res.json({
      success: true,
      data: {
        message: 'Order sent to kitchen',
        items_count: kitchenItems.length,
        items: kitchenItems
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Send to kitchen error:', error);
    
    if (error.message === 'NO_PENDING_ITEMS') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No items to send to kitchen',
          code: 'NO_PENDING_ITEMS'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send order to kitchen',
        code: 'SEND_TO_KITCHEN_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
