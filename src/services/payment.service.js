/**
 * Payment Service
 * Business logic for payment processing
 */

const { pool } = require('../config/database');

/**
 * Process payment for order
 * Handles payment recording, inventory deduction, and table cleanup
 */
async function processPayment(orderId, paymentData, userId, connection) {
  const {
    payment_method_id,
    amount_paid,
    discount_amount,
    tax_amount,
    note
  } = paymentData;

  // Get order details
  const [orders] = await connection.query(
    `SELECT id, order_number, total_amount, discount_amount, tax_amount, 
            final_amount, status, table_id
     FROM orders WHERE id = ?`,
    [orderId]
  );

  if (orders.length === 0) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const order = orders[0];

  // Validate order status
  if (order.status === 'paid' || order.status === 'completed') {
    throw new Error('ORDER_ALREADY_PAID');
  }

  // Check if all items are ready (optional validation)
  const [pendingItems] = await connection.query(
    `SELECT COUNT(*) as count FROM order_lines 
     WHERE order_id = ? AND status IN ('pending', 'sent_to_kitchen', 'cooking')`,
    [orderId]
  );

  // Calculate final amounts
  const finalDiscount = discount_amount || order.discount_amount || 0;
  const finalTax = tax_amount || order.tax_amount || 0;
  const subtotal = order.total_amount - finalDiscount;
  const finalAmount = subtotal + finalTax;

  // Validate payment amount
  if (amount_paid < finalAmount) {
    throw new Error('INSUFFICIENT_PAYMENT');
  }

  const changeAmount = amount_paid - finalAmount;

  // Update order with final amounts
  await connection.query(
    `UPDATE orders 
     SET discount_amount = ?, tax_amount = ?, final_amount = ?,
         status = 'paid', paid_at = NOW(), updated_by = ?
     WHERE id = ?`,
    [finalDiscount, finalTax, finalAmount, userId, orderId]
  );

  // Create payment record
  const [paymentResult] = await connection.query(
    `INSERT INTO payments 
     (order_id, payment_method_id, amount, discount_amount, tax_amount, 
      final_amount, amount_paid, change_amount, note, processed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      payment_method_id,
      order.total_amount,
      finalDiscount,
      finalTax,
      finalAmount,
      amount_paid,
      changeAmount,
      note,
      userId
    ]
  );

  // Update table status to needs_cleaning
  await connection.query(
    `UPDATE tables 
     SET status = 'needs_cleaning', current_order_id = NULL, updated_at = NOW()
     WHERE id = ?`,
    [order.table_id]
  );

  // Deduct inventory using stored procedure
  try {
    await connection.query('CALL sp_deduct_inventory_on_payment(?)', [orderId]);
  } catch (error) {
    console.error('Inventory deduction warning:', error.message);
    // Continue even if inventory deduction fails (log for review)
  }

  return {
    payment_id: paymentResult.insertId,
    order_id: orderId,
    order_number: order.order_number,
    table_id: order.table_id,
    final_amount: finalAmount,
    amount_paid: amount_paid,
    change_amount: changeAmount
  };
}

/**
 * Split bill calculation
 * Split order into multiple payments
 */
async function calculateSplitBill(orderId, splitType, splitData, connection) {
  // Get order total
  const [orders] = await connection.query(
    'SELECT id, final_amount FROM orders WHERE id = ?',
    [orderId]
  );

  if (orders.length === 0) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const order = orders[0];
  const totalAmount = order.final_amount;

  let splits = [];

  if (splitType === 'equal') {
    // Split equally among N people
    const { number_of_people } = splitData;
    const amountPerPerson = Math.ceil(totalAmount / number_of_people * 100) / 100;
    
    for (let i = 0; i < number_of_people; i++) {
      splits.push({
        person: i + 1,
        amount: amountPerPerson
      });
    }
  } else if (splitType === 'by_item') {
    // Split by specific items
    const { item_assignments } = splitData; // [{ person: 1, line_ids: [1,2,3] }]
    
    for (const assignment of item_assignments) {
      const [itemTotals] = await connection.query(
        'SELECT SUM(line_total) as total FROM order_lines WHERE id IN (?)',
        [assignment.line_ids]
      );
      
      splits.push({
        person: assignment.person,
        amount: itemTotals[0].total || 0
      });
    }
  } else if (splitType === 'custom') {
    // Custom amounts
    splits = splitData.amounts; // [{ person: 1, amount: 100 }, ...]
  }

  return {
    order_id: orderId,
    total_amount: totalAmount,
    split_type: splitType,
    splits: splits
  };
}

/**
 * Apply discount to order
 */
async function applyDiscount(orderId, discountData, userId, connection) {
  const { discount_type, discount_value, reason } = discountData;

  // Get order
  const [orders] = await connection.query(
    'SELECT id, total_amount FROM orders WHERE id = ?',
    [orderId]
  );

  if (orders.length === 0) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const order = orders[0];
  let discountAmount = 0;

  if (discount_type === 'percentage') {
    discountAmount = (order.total_amount * discount_value) / 100;
  } else if (discount_type === 'fixed') {
    discountAmount = discount_value;
  }

  // Update order
  await connection.query(
    'UPDATE orders SET discount_amount = ?, updated_by = ? WHERE id = ?',
    [discountAmount, userId, orderId]
  );

  // Log discount
  await connection.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (?, 'discount_applied', 'order', ?, ?)`,
    [userId, orderId, JSON.stringify({
      discount_type,
      discount_value,
      discount_amount: discountAmount,
      reason
    })]
  );

  return {
    order_id: orderId,
    discount_amount: discountAmount,
    new_total: order.total_amount - discountAmount
  };
}

module.exports = {
  processPayment,
  calculateSplitBill,
  applyDiscount
};
