/**
 * Inventory Routes
 * GET /api/inventory - List inventory items
 * GET /api/inventory/:id - Get inventory item details
 * PUT /api/inventory/:id - Update inventory item
 * GET /api/inventory/low-stock - Get low stock items
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * GET /api/inventory
 * List all inventory items
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, low_stock } = req.query;

    let query = `
      SELECT 
        id, name, sku, category, unit, current_stock, min_stock, max_stock,
        unit_cost, supplier, last_restock_date, expiry_date
      FROM inventory_items
      WHERE 1=1
    `;
    
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (low_stock === 'true') {
      query += ' AND current_stock <= min_stock';
    }

    query += ' ORDER BY name';

    const [items] = await pool.query(query, params);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get inventory',
        code: 'GET_INVENTORY_ERROR'
      }
    });
  }
});

/**
 * GET /api/inventory/low-stock
 * Get items with low stock (current_stock <= min_stock)
 */
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT 
        id, name, sku, category, unit, current_stock, min_stock,
        unit_cost, supplier
       FROM inventory_items
       WHERE current_stock <= min_stock
       ORDER BY (current_stock / min_stock), name`
    );

    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get low stock items',
        code: 'GET_LOW_STOCK_ERROR'
      }
    });
  }
});

/**
 * GET /api/inventory/:id
 * Get inventory item details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [items] = await pool.query(
      `SELECT * FROM inventory_items WHERE id = ?`,
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Inventory item not found',
          code: 'INVENTORY_ITEM_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: items[0]
    });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get inventory item',
        code: 'GET_INVENTORY_ITEM_ERROR'
      }
    });
  }
});

/**
 * PUT /api/inventory/:id
 * Update inventory item (stock adjustment)
 */
router.put('/:id', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { 
      current_stock, 
      min_stock, 
      max_stock, 
      unit_cost, 
      adjustment_reason 
    } = req.body;

    // Get current item
    const [items] = await connection.query(
      'SELECT current_stock FROM inventory_items WHERE id = ?',
      [id]
    );

    if (items.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: {
          message: 'Inventory item not found',
          code: 'INVENTORY_ITEM_NOT_FOUND'
        }
      });
    }

    const oldStock = items[0].current_stock;

    // Update inventory
    const updates = [];
    const values = [];

    if (current_stock !== undefined) {
      updates.push('current_stock = ?');
      values.push(current_stock);
    }
    if (min_stock !== undefined) {
      updates.push('min_stock = ?');
      values.push(min_stock);
    }
    if (max_stock !== undefined) {
      updates.push('max_stock = ?');
      values.push(max_stock);
    }
    if (unit_cost !== undefined) {
      updates.push('unit_cost = ?');
      values.push(unit_cost);
    }

    if (updates.length > 0) {
      values.push(id);
      await connection.query(
        `UPDATE inventory_items SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // Log the adjustment
    if (current_stock !== undefined && current_stock !== oldStock) {
      await connection.query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'inventory_adjustment',
          'inventory_item',
          id,
          JSON.stringify({
            old_stock: oldStock,
            new_stock: current_stock,
            adjustment: current_stock - oldStock,
            reason: adjustment_reason
          })
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      data: {
        id: id,
        message: 'Inventory updated successfully'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update inventory',
        code: 'UPDATE_INVENTORY_ERROR'
      }
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
