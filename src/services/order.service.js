/**
 * Order Service
 * Business logic for order management
 */

const { pool } = require('../config/database');

/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXXX
 */
async function generateOrderNumber(connection) {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const [countResult] = await connection.query(
    'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()'
  );
  const dailySeq = countResult[0].count + 1;
  return `ORD-${today}-${dailySeq.toString().padStart(4, '0')}`;
}

/**
 * Validate table availability for ordering
 */
async function validateTableForOrder(tableId, connection) {
  const [tables] = await connection.query(
    'SELECT id, status, qr_code_token FROM tables WHERE id = ?',
    [tableId]
  );

  if (tables.length === 0) {
    throw new Error('TABLE_NOT_FOUND');
  }

  const table = tables[0];

  // Check if table is available for ordering
  if (table.status === 'needs_cleaning') {
    throw new Error('TABLE_NEEDS_CLEANING');
  }

  return table;
}

/**
 * Get or create order for table
 * If table has open order, return it. Otherwise create new.
 */
async function getOrCreateOrderForTable(tableId, userId, employeeId, source, connection) {
  // Check if table has current open order
  const [existingOrders] = await connection.query(
    `SELECT id, order_number, status FROM orders 
     WHERE table_id = ? AND status IN ('open', 'sent_to_kitchen')
     ORDER BY created_at DESC LIMIT 1`,
    [tableId]
  );

  if (existingOrders.length > 0) {
    return existingOrders[0];
  }

  // Create new order
  const orderNumber = await generateOrderNumber(connection);

  const [result] = await connection.query(
    `INSERT INTO orders 
     (order_number, table_id, status, customer_count, source, 
      waiter_id, total_amount, created_by, updated_by)
     VALUES (?, ?, 'open', 1, ?, ?, 0, ?, ?)`,
    [orderNumber, tableId, source || 'pos', employeeId, userId, userId]
  );

  // Update table status to occupied
  await connection.query(
    'UPDATE tables SET status = ?, current_order_id = ?, updated_at = NOW() WHERE id = ?',
    ['occupied', result.insertId, tableId]
  );

  return {
    id: result.insertId,
    order_number: orderNumber,
    status: 'open'
  };
}

/**
 * Add items to order
 * Returns order lines created
 */
async function addItemsToOrder(orderId, items, connection) {
  const createdLines = [];

  for (const item of items) {
    const { menu_item_id, qty, modifiers, note } = item;

    // Get menu item price
    const [menuItems] = await connection.query(
      'SELECT id, unit_price, is_available FROM menu_items WHERE id = ?',
      [menu_item_id]
    );

    if (menuItems.length === 0) {
      throw new Error(`MENU_ITEM_NOT_FOUND: ${menu_item_id}`);
    }

    if (!menuItems[0].is_available) {
      throw new Error(`MENU_ITEM_NOT_AVAILABLE: ${menu_item_id}`);
    }

    const unitPrice = menuItems[0].unit_price;

    // Insert order line (trigger will calculate total)
    const [result] = await connection.query(
      `INSERT INTO order_lines 
       (order_id, menu_item_id, qty, unit_price, modifiers, note, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [orderId, menu_item_id, qty, unitPrice, JSON.stringify(modifiers || []), note]
    );

    createdLines.push({
      id: result.insertId,
      order_id: orderId,
      menu_item_id: menu_item_id,
      qty: qty,
      unit_price: unitPrice
    });
  }

  return createdLines;
}

/**
 * Send order to kitchen
 * Create kitchen queue items for each line
 */
async function sendOrderToKitchen(orderId, connection) {
  // Get order lines that haven't been sent to kitchen
  const [lines] = await connection.query(
    `SELECT ol.id, ol.menu_item_id, ol.qty, m.kitchen_area_id, m.name
     FROM order_lines ol
     JOIN menu_items m ON ol.menu_item_id = m.id
     WHERE ol.order_id = ? AND ol.status = 'pending'`,
    [orderId]
  );

  if (lines.length === 0) {
    throw new Error('NO_PENDING_ITEMS');
  }

  // Group by kitchen area for efficient processing
  const kitchenItems = [];

  for (const line of lines) {
    // Insert kitchen queue item
    const [result] = await connection.query(
      `INSERT INTO kitchen_queue 
       (order_id, order_line_id, menu_item_id, qty, kitchen_area_id, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [orderId, line.id, line.menu_item_id, line.qty, line.kitchen_area_id]
    );

    kitchenItems.push({
      kitchen_queue_id: result.insertId,
      order_line_id: line.id,
      menu_item_id: line.menu_item_id,
      item_name: line.name,
      qty: line.qty,
      kitchen_area_id: line.kitchen_area_id
    });

    // Update order line status
    await connection.query(
      'UPDATE order_lines SET status = ? WHERE id = ?',
      ['sent_to_kitchen', line.id]
    );
  }

  // Update order status
  await connection.query(
    'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
    ['sent_to_kitchen', orderId]
  );

  return kitchenItems;
}

/**
 * Calculate order totals
 */
async function calculateOrderTotals(orderId, discountAmount, taxRate, connection) {
  // Get order lines total
  const [totals] = await connection.query(
    'SELECT SUM(line_total) as total_amount FROM order_lines WHERE order_id = ?',
    [orderId]
  );

  const totalAmount = totals[0].total_amount || 0;
  const discount = discountAmount || 0;
  const tax = ((totalAmount - discount) * (taxRate || 0.1)); // Default 10% tax
  const finalAmount = totalAmount - discount + tax;

  // Update order
  await connection.query(
    `UPDATE orders 
     SET total_amount = ?, discount_amount = ?, tax_amount = ?, final_amount = ?
     WHERE id = ?`,
    [totalAmount, discount, tax, finalAmount, orderId]
  );

  return {
    total_amount: totalAmount,
    discount_amount: discount,
    tax_amount: tax,
    final_amount: finalAmount
  };
}

/**
 * Validate QR code token for table ordering
 */
async function validateQRToken(tableId, token, connection) {
  const [tables] = await connection.query(
    'SELECT id, status, qr_code_token FROM tables WHERE id = ?',
    [tableId]
  );

  if (tables.length === 0) {
    throw new Error('TABLE_NOT_FOUND');
  }

  const table = tables[0];

  // Validate token
  if (table.qr_code_token !== token) {
    throw new Error('INVALID_QR_TOKEN');
  }

  // Check table status - only allow ordering if occupied or reserved
  if (!['occupied', 'reserved'].includes(table.status)) {
    if (table.status === 'needs_cleaning') {
      throw new Error('TABLE_NEEDS_CLEANING');
    }
    throw new Error('TABLE_NOT_AVAILABLE');
  }

  return table;
}

module.exports = {
  generateOrderNumber,
  validateTableForOrder,
  getOrCreateOrderForTable,
  addItemsToOrder,
  sendOrderToKitchen,
  calculateOrderTotals,
  validateQRToken
};
