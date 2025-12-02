/**
 * Kitchen Service
 * Business logic for kitchen operations
 */

const { pool } = require('../config/database');

/**
 * Update kitchen item status with validation
 */
async function updateKitchenItemStatus(kitchenQueueId, newStatus, connection) {
  // Validate status transition
  const validTransitions = {
    'pending': ['cooking', 'cancelled'],
    'cooking': ['ready', 'cancelled'],
    'ready': ['served'],
    'served': [],
    'cancelled': []
  };

  // Get current item
  const [items] = await connection.query(
    `SELECT id, order_id, order_line_id, status, kitchen_area_id, menu_item_id
     FROM kitchen_queue WHERE id = ?`,
    [kitchenQueueId]
  );

  if (items.length === 0) {
    throw new Error('KITCHEN_ITEM_NOT_FOUND');
  }

  const item = items[0];

  // Validate transition
  if (!validTransitions[item.status].includes(newStatus)) {
    throw new Error(`INVALID_STATUS_TRANSITION: ${item.status} -> ${newStatus}`);
  }

  // Update kitchen queue
  let updateQuery = 'UPDATE kitchen_queue SET status = ?';
  const updateParams = [newStatus];

  // Track timestamps
  if (newStatus === 'cooking' && item.status === 'pending') {
    updateQuery += ', started_at = NOW()';
  } else if (newStatus === 'ready' && item.status === 'cooking') {
    updateQuery += ', completed_at = NOW()';
  }

  updateQuery += ' WHERE id = ?';
  updateParams.push(kitchenQueueId);

  await connection.query(updateQuery, updateParams);

  // Update order line status
  const orderLineStatus = {
    'pending': 'sent_to_kitchen',
    'cooking': 'cooking',
    'ready': 'ready',
    'served': 'served',
    'cancelled': 'cancelled'
  };

  await connection.query(
    'UPDATE order_lines SET status = ? WHERE id = ?',
    [orderLineStatus[newStatus], item.order_line_id]
  );

  // Check if all items in order are ready/served
  if (newStatus === 'ready' || newStatus === 'served') {
    await checkAndUpdateOrderStatus(item.order_id, connection);
  }

  return {
    kitchen_queue_id: kitchenQueueId,
    order_id: item.order_id,
    order_line_id: item.order_line_id,
    old_status: item.status,
    new_status: newStatus,
    kitchen_area_id: item.kitchen_area_id
  };
}

/**
 * Check if all items in order are ready and update order status
 */
async function checkAndUpdateOrderStatus(orderId, connection) {
  const [stats] = await connection.query(
    `SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_items,
      SUM(CASE WHEN status = 'served' THEN 1 ELSE 0 END) as served_items
     FROM order_lines
     WHERE order_id = ?`,
    [orderId]
  );

  const { total_items, ready_items, served_items } = stats[0];

  // If all items are ready
  if (ready_items === total_items) {
    await connection.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['ready_to_serve', orderId]
    );
  }
  // If all items are served
  else if (served_items === total_items) {
    await connection.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['served', orderId]
    );
  }
}

/**
 * Get kitchen queue grouped by area
 */
async function getKitchenQueueByArea(kitchenAreaId, statusFilter, connection) {
  let query = `
    SELECT 
      kq.id, kq.order_id, kq.order_line_id, kq.menu_item_id, kq.qty,
      kq.kitchen_area_id, kq.status, kq.started_at, kq.completed_at,
      kq.created_at,
      o.order_number, o.table_id,
      t.name as table_name, t.area as table_area,
      m.name as item_name, m.prep_time_minutes,
      ol.modifiers, ol.note,
      ka.name as kitchen_area_name,
      TIMESTAMPDIFF(MINUTE, kq.created_at, NOW()) as wait_time_minutes
    FROM kitchen_queue kq
    JOIN orders o ON kq.order_id = o.id
    JOIN tables t ON o.table_id = t.id
    JOIN menu_items m ON kq.menu_item_id = m.id
    LEFT JOIN order_lines ol ON kq.order_line_id = ol.id
    LEFT JOIN kitchen_areas ka ON kq.kitchen_area_id = ka.id
    WHERE 1=1
  `;
  
  const params = [];

  if (kitchenAreaId) {
    query += ' AND kq.kitchen_area_id = ?';
    params.push(kitchenAreaId);
  }

  if (statusFilter && statusFilter.length > 0) {
    query += ` AND kq.status IN (${statusFilter.map(() => '?').join(',')})`;
    params.push(...statusFilter);
  } else {
    // Default: show active items
    query += " AND kq.status IN ('pending', 'cooking')";
  }

  query += ' ORDER BY kq.created_at ASC';

  const [items] = await connection.query(query, params);

  return items;
}

/**
 * Mark item as priority (bump)
 */
async function markItemAsPriority(kitchenQueueId, connection) {
  await connection.query(
    'UPDATE kitchen_queue SET is_priority = 1, updated_at = NOW() WHERE id = ?',
    [kitchenQueueId]
  );

  return { kitchen_queue_id: kitchenQueueId, is_priority: true };
}

module.exports = {
  updateKitchenItemStatus,
  checkAndUpdateOrderStatus,
  getKitchenQueueByArea,
  markItemAsPriority
};
