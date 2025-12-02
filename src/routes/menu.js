/**
 * Menu Routes
 * GET /api/menu - List all menu items
 * GET /api/menu/categories - List all categories
 * GET /api/menu/:id - Get menu item details
 * POST /api/menu - Create menu item (admin)
 * PUT /api/menu/:id - Update menu item (admin)
 * DELETE /api/menu/:id - Delete menu item (admin)
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * GET /api/menu
 * Get all active menu items with categories
 */
router.get('/', async (req, res) => {
  try {
    const { category_id, is_available } = req.query;

    let query = `
      SELECT 
        m.id, m.name, m.description, m.category_id, m.base_price as unit_price,
        m.image_url, m.available as is_available, m.sort_order as display_order,
        c.name as category_name,
        ka.name as kitchen_area_name
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      LEFT JOIN kitchen_areas ka ON m.kitchen_area_id = ka.id
      WHERE 1=1
    `;
    
    const params = [];

    if (category_id) {
      query += ' AND m.category_id = ?';
      params.push(category_id);
    }

    if (is_available !== undefined) {
      query += ' AND m.is_available = ?';
      params.push(is_available === 'true' || is_available === '1' ? 1 : 0);
    }

    query += ' ORDER BY c.sort_order, m.sort_order';

    const [items] = await pool.query(query, params);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get menu items',
        code: 'GET_MENU_ERROR'
      }
    });
  }
});

/**
 * GET /api/menu/categories
 * Get all categories
 */
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT id, name, sort_order as display_order FROM menu_categories WHERE active = 1 ORDER BY sort_order'
    );

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get categories',
        code: 'GET_CATEGORIES_ERROR'
      }
    });
  }
});

/**
 * GET /api/menu/:id
 * Get menu item details with modifiers
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [items] = await pool.query(
      `SELECT 
        m.id, m.name, m.description, m.category_id, m.base_price as unit_price,
        m.image_url, m.available as is_available, m.sort_order as display_order,
        c.name as category_name,
        ka.name as kitchen_area_name
       FROM menu_items m
       LEFT JOIN menu_categories c ON m.category_id = c.id
       LEFT JOIN kitchen_areas ka ON m.kitchen_area_id = ka.id
       WHERE m.id = ?`,
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Menu item not found',
          code: 'MENU_ITEM_NOT_FOUND'
        }
      });
    }

    // Get modifiers for this menu item
    const [modifiers] = await pool.query(
      `SELECT 
        mg.id as group_id, mg.name as group_name, mg.is_required, mg.max_selections,
        mo.id as modifier_id, mo.name as modifier_name, mo.price_adjustment
       FROM modifier_groups mg
       LEFT JOIN modifiers mo ON mg.id = mo.group_id
       WHERE mg.menu_item_id = ?
       ORDER BY mg.display_order, mo.display_order`,
      [id]
    );

    // Group modifiers by group
    const modifierGroups = {};
    modifiers.forEach(m => {
      if (!modifierGroups[m.group_id]) {
        modifierGroups[m.group_id] = {
          id: m.group_id,
          name: m.group_name,
          is_required: m.is_required,
          max_selections: m.max_selections,
          modifiers: []
        };
      }
      if (m.modifier_id) {
        modifierGroups[m.group_id].modifiers.push({
          id: m.modifier_id,
          name: m.modifier_name,
          price_adjustment: m.price_adjustment
        });
      }
    });

    res.json({
      success: true,
      data: {
        ...items[0],
        modifier_groups: Object.values(modifierGroups)
      }
    });
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get menu item',
        code: 'GET_MENU_ITEM_ERROR'
      }
    });
  }
});

/**
 * POST /api/menu
 * Create new menu item (admin only)
 */
router.post('/', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
  try {
    const {
      name, name_en, description, category_id, unit_price,
      image_url, is_available, kitchen_area_id, allergens,
      is_spicy, is_vegetarian, prep_time_minutes
    } = req.body;

    if (!name || !category_id || !unit_price) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Name, category_id, and unit_price are required',
          code: 'MISSING_FIELDS'
        }
      });
    }

    const [result] = await pool.query(
      `INSERT INTO menu_items 
       (name, name_en, description, category_id, unit_price, image_url, 
        is_available, kitchen_area_id, allergens, is_spicy, is_vegetarian, prep_time_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name_en, description, category_id, unit_price, image_url,
       is_available || 1, kitchen_area_id, allergens, is_spicy || 0, 
       is_vegetarian || 0, prep_time_minutes || 10]
    );

    // Log activity
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'menu_item', result.insertId, JSON.stringify({ name })]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        message: 'Menu item created successfully'
      }
    });
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create menu item',
        code: 'CREATE_MENU_ITEM_ERROR'
      }
    });
  }
});

module.exports = router;
