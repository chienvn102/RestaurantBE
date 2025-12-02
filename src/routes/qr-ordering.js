/**
 * QR Table Ordering Routes
 * POST /api/qr-ordering/table/:table_id/items - Add items from QR order
 * GET /api/qr-ordering/table/:table_id/order - Get current order for table
 * GET /api/qr-ordering/menu - Get menu for QR ordering
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const orderService = require('../services/order.service');

/**
 * Middleware to validate QR token
 */
const validateQRToken = async (req, res, next) => {
  try {
    const token = req.headers['x-table-token'];
    const { table_id } = req.params;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'QR token required',
          code: 'NO_QR_TOKEN'
        }
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await orderService.validateQRToken(table_id, token, connection);
      req.tableId = table_id;
      req.qrToken = token;
      next();
    } catch (error) {
      if (error.message === 'INVALID_QR_TOKEN') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Invalid QR code. Please scan the QR code on your table.',
            code: 'INVALID_QR_TOKEN'
          }
        });
      } else if (error.message === 'TABLE_NEEDS_CLEANING') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'This table is being cleaned. Please call a waiter.',
            code: 'TABLE_NEEDS_CLEANING'
          }
        });
      } else if (error.message === 'TABLE_NOT_AVAILABLE') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'This table is not available. Please call a waiter.',
            code: 'TABLE_NOT_AVAILABLE'
          }
        });
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('QR token validation error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to validate QR code',
        code: 'QR_VALIDATION_ERROR'
      }
    });
  }
};

/**
 * GET /api/qr-ordering/menu
 * Get menu for QR ordering (public access)
 */
router.get('/menu', async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT 
        m.id, m.name, m.name_en, m.description, m.category_id, m.unit_price,
        m.image_url, m.is_available, m.prep_time_minutes,
        m.allergens, m.is_spicy, m.is_vegetarian,
        c.name as category_name, c.name_en as category_name_en
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.is_available = 1
      ORDER BY c.display_order, m.display_order`
    );

    // Group by category
    const categories = {};
    items.forEach(item => {
      const catId = item.category_id;
      if (!categories[catId]) {
        categories[catId] = {
          id: catId,
          name: item.category_name,
          name_en: item.category_name_en,
          items: []
        };
      }
      categories[catId].items.push({
        id: item.id,
        name: item.name,
        name_en: item.name_en,
        description: item.description,
        unit_price: item.unit_price,
        image_url: item.image_url,
        prep_time_minutes: item.prep_time_minutes,
        allergens: item.allergens,
        is_spicy: item.is_spicy,
        is_vegetarian: item.is_vegetarian
      });
    });

    res.json({
      success: true,
      data: Object.values(categories)
    });
  } catch (error) {
    console.error('Get QR menu error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to load menu',
        code: 'GET_MENU_ERROR'
      }
    });
  }
});

/**
 * POST /api/qr-ordering/table/:table_id/items
 * Add items to order via QR code (with token validation)
 */
router.post('/table/:table_id/items', validateQRToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { table_id } = req.params;
    const { items } = req.body; // [{ menu_item_id, qty, modifiers, note }]

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'At least one item is required',
          code: 'NO_ITEMS'
        }
      });
    }

    // Get or create order for this table
    const order = await orderService.getOrCreateOrderForTable(
      table_id,
      null, // No user ID for QR orders
      null, // No employee ID
      'qr_table',
      connection
    );

    // Add items to order
    const createdLines = await orderService.addItemsToOrder(
      order.id,
      items,
      connection
    );

    // Recalculate order totals
    await orderService.calculateOrderTotals(order.id, 0, 0.1, connection);

    await connection.commit();

    // Emit socket event to notify waiters
    const io = req.app.get('io');
    io.to('role:waiter').emit('qr_order:new_items', {
      order_id: order.id,
      order_number: order.order_number,
      table_id: table_id,
      items_count: createdLines.length,
      source: 'qr_table'
    });

    res.status(201).json({
      success: true,
      data: {
        order_id: order.id,
        order_number: order.order_number,
        items: createdLines,
        message: 'Your order has been sent to the kitchen!'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('QR order error:', error);
    
    if (error.message.includes('MENU_ITEM_NOT_FOUND')) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'One or more items are no longer available',
          code: 'MENU_ITEM_NOT_FOUND'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to place order',
        code: 'QR_ORDER_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/qr-ordering/table/:table_id/order
 * Get current order for table (with token validation)
 */
router.get('/table/:table_id/order', validateQRToken, async (req, res) => {
  try {
    const { table_id } = req.params;

    // Get current order for table
    const [orders] = await pool.query(
      `SELECT 
        o.id, o.order_number, o.status, o.total_amount, o.created_at,
        t.name as table_name
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.table_id = ? AND o.status IN ('open', 'sent_to_kitchen', 'ready_to_serve')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [table_id]
    );

    if (orders.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No active order for this table'
      });
    }

    const order = orders[0];

    // Get order items with kitchen status
    const [items] = await pool.query(
      `SELECT 
        ol.id, ol.menu_item_id, ol.qty, ol.unit_price, ol.line_total,
        ol.modifiers, ol.note, ol.status,
        m.name as item_name, m.image_url,
        kq.status as kitchen_status
       FROM order_lines ol
       JOIN menu_items m ON ol.menu_item_id = m.id
       LEFT JOIN kitchen_queue kq ON ol.id = kq.order_line_id
       WHERE ol.order_id = ?
       ORDER BY ol.id`,
      [order.id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items: items
      }
    });
  } catch (error) {
    console.error('Get QR order error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get order',
        code: 'GET_ORDER_ERROR'
      }
    });
  }
});

module.exports = router;
