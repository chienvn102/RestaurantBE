# Backend Architecture - Node.js

## 📐 Architecture Overview

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js (or NestJS for larger scale)
- **Database**: PostgreSQL 14+ with `pg` driver
- **ORM**: Sequelize or Prisma
- **Realtime**: Socket.io with Redis adapter
- **Caching**: Redis
- **Queue**: Bull (Redis-based)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi or class-validator
- **Logging**: Winston + Morgan
- **Testing**: Jest + Supertest

### Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── socket.js
│   │   ├── payment.js
│   │   └── printer.js
│   ├── controllers/         # Request handlers
│   │   ├── auth.controller.js
│   │   ├── menu.controller.js
│   │   ├── order.controller.js
│   │   ├── payment.controller.js
│   │   ├── table.controller.js
│   │   ├── kitchen.controller.js
│   │   ├── inventory.controller.js
│   │   ├── customer.controller.js
│   │   ├── report.controller.js
│   │   └── sync.controller.js
│   ├── services/            # Business logic
│   │   ├── auth.service.js
│   │   ├── menu.service.js
│   │   ├── order.service.js
│   │   ├── payment.service.js
│   │   ├── table.service.js
│   │   ├── kitchen.service.js
│   │   ├── inventory.service.js
│   │   ├── customer.service.js
│   │   ├── report.service.js
│   │   ├── sync.service.js
│   │   └── notification.service.js
│   ├── models/              # Database models
│   │   ├── User.js
│   │   ├── Employee.js
│   │   ├── MenuItem.js
│   │   ├── Order.js
│   │   ├── OrderLine.js
│   │   ├── Payment.js
│   │   ├── Table.js
│   │   ├── InventoryItem.js
│   │   └── index.js
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── validation.middleware.js
│   │   ├── error.middleware.js
│   │   ├── rate-limit.middleware.js
│   │   └── logger.middleware.js
│   ├── routes/              # API routes
│   │   ├── auth.routes.js
│   │   ├── menu.routes.js
│   │   ├── order.routes.js
│   │   ├── payment.routes.js
│   │   ├── table.routes.js
│   │   ├── kitchen.routes.js
│   │   ├── inventory.routes.js
│   │   ├── customer.routes.js
│   │   ├── report.routes.js
│   │   ├── sync.routes.js
│   │   └── index.js
│   ├── validators/          # Request validators
│   │   ├── order.validator.js
│   │   ├── payment.validator.js
│   │   └── menu.validator.js
│   ├── utils/               # Utility functions
│   │   ├── jwt.util.js
│   │   ├── encryption.util.js
│   │   ├── qrcode.util.js
│   │   ├── printer.util.js
│   │   └── dateTime.util.js
│   ├── jobs/                # Background jobs
│   │   ├── inventory-sync.job.js
│   │   ├── report-generation.job.js
│   │   └── cleanup.job.js
│   ├── integrations/        # External integrations
│   │   ├── payment-gateway/
│   │   │   ├── stripe.integration.js
│   │   │   └── square.integration.js
│   │   ├── printer/
│   │   │   └── escpos.integration.js
│   │   └── sms/
│   │       └── twilio.integration.js
│   ├── sockets/             # WebSocket handlers
│   │   ├── order.socket.js
│   │   ├── kitchen.socket.js
│   │   ├── table.socket.js
│   │   └── index.js
│   ├── database/            # Database migrations & seeds
│   │   ├── migrations/
│   │   └── seeds/
│   └── app.js               # Express app setup
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── package.json
└── server.js                # Entry point
```

---

## 🔌 API Endpoints Documentation

### Authentication

#### POST /api/auth/login
**Description**: User login
**Request**:
```json
{
  "username": "admin",
  "password": "password123"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "..."
  }
}
```

#### POST /api/auth/logout
**Description**: User logout
**Headers**: `Authorization: Bearer <token>`

#### GET /api/auth/me
**Description**: Get current user info
**Headers**: `Authorization: Bearer <token>`

---

### Menu Management

#### GET /api/menu
**Description**: Get full menu with categories and items
**Query Params**: 
- `category_id`: Filter by category
- `active`: Filter active items (true/false)
**Response**:
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Appetizers",
        "items": [
          {
            "id": 1,
            "name": "Spring Rolls",
            "description": "Crispy spring rolls",
            "base_price": 5.99,
            "image_url": "...",
            "modifiers": [...]
          }
        ]
      }
    ]
  }
}
```

#### POST /api/menu/items
**Description**: Create menu item (admin only)
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "category_id": 1,
  "name": "Beef Burger",
  "description": "Juicy beef burger",
  "base_price": 12.99,
  "cost": 6.50,
  "image_url": "...",
  "modifiers": [1, 2, 3]
}
```

#### PUT /api/menu/items/:id
**Description**: Update menu item
**Headers**: `Authorization: Bearer <token>`

#### DELETE /api/menu/items/:id
**Description**: Soft delete menu item
**Headers**: `Authorization: Bearer <token>`

---

### Table Management

#### GET /api/floors
**Description**: Get all floors with tables
**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Ground Floor",
      "tables": [
        {
          "id": 1,
          "table_number": "T01",
          "seats": 4,
          "status": "available",
          "qr_code_token": "abc123xyz"
        }
      ]
    }
  ]
}
```

#### POST /api/tables/:id/occupy
**Description**: Mark table as occupied
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "employee_id": 1
}
```

#### POST /api/tables/:id/free
**Description**: Free table
**Headers**: `Authorization: Bearer <token>`

#### GET /api/tables/:id/qr
**Description**: Generate/get QR code for table
**Response**:
```json
{
  "success": true,
  "data": {
    "table_id": 1,
    "qr_url": "https://restaurant.app/table/1?token=abc123xyz",
    "qr_image": "data:image/png;base64,..."
  }
}
```

---

### Order Management

#### GET /api/orders
**Description**: List orders
**Query Params**:
- `status`: Filter by status
- `table_id`: Filter by table
- `from_date`, `to_date`: Date range
- `page`, `limit`: Pagination

#### GET /api/orders/:id
**Description**: Get order details
**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_number": "ORD-2025-001",
    "table": {
      "id": 1,
      "table_number": "T01"
    },
    "employee": {
      "id": 1,
      "full_name": "John Doe"
    },
    "status": "open",
    "source": "pos",
    "lines": [
      {
        "id": 1,
        "menu_item": {
          "id": 1,
          "name": "Beef Burger"
        },
        "quantity": 2,
        "unit_price": 12.99,
        "modifiers": [
          {"name": "Extra Cheese", "price": 1.50}
        ],
        "line_total": 28.98
      }
    ],
    "subtotal": 28.98,
    "tax": 2.32,
    "discount": 0,
    "total": 31.30,
    "opened_at": "2025-11-20T10:30:00Z"
  }
}
```

#### POST /api/orders
**Description**: Create new order
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "table_id": 1,
  "employee_id": 1,
  "source": "pos",
  "customer_id": null
}
```

#### POST /api/orders/:id/lines
**Description**: Add items to order
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "items": [
    {
      "menu_item_id": 1,
      "quantity": 2,
      "modifiers": [
        {"modifier_id": 1, "name": "Extra Cheese", "price": 1.50}
      ],
      "note": "No onions"
    }
  ]
}
```

#### PUT /api/orders/:id/lines/:line_id
**Description**: Update order line
**Headers**: `Authorization: Bearer <token>`

#### DELETE /api/orders/:id/lines/:line_id
**Description**: Remove order line
**Headers**: `Authorization: Bearer <token>`

#### POST /api/orders/:id/send-to-kitchen
**Description**: Send order to kitchen
**Headers**: `Authorization: Bearer <token>`

#### POST /api/orders/:id/split
**Description**: Split bill
**Request**:
```json
{
  "split_type": "by_item",
  "splits": [
    {
      "split_number": 1,
      "line_ids": [1, 2]
    },
    {
      "split_number": 2,
      "line_ids": [3]
    }
  ]
}
```

#### POST /api/orders/merge
**Description**: Merge multiple orders
**Request**:
```json
{
  "order_ids": [1, 2, 3]
}
```

#### POST /api/orders/table/:table_id/add-items
**Description**: Add items via QR ordering (public endpoint with token auth)
**Headers**: `X-Table-Token: <qr_code_token>`
**Request**:
```json
{
  "items": [
    {
      "menu_item_id": 1,
      "quantity": 1,
      "modifiers": [],
      "note": ""
    }
  ]
}
```

---

### Kitchen Management

#### GET /api/kitchen/queue
**Description**: Get kitchen queue
**Headers**: `Authorization: Bearer <token>`
**Query Params**: `area_id`, `status`
**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_number": "ORD-2025-001",
      "table_number": "T01",
      "items": [
        {
          "id": 1,
          "name": "Beef Burger",
          "quantity": 2,
          "modifiers": ["Extra Cheese"],
          "note": "No onions",
          "status": "pending"
        }
      ],
      "priority": 0,
      "received_at": "2025-11-20T10:35:00Z"
    }
  ]
}
```

#### PUT /api/kitchen/queue/:id/status
**Description**: Update kitchen item status
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "status": "cooking",
  "assigned_to": 5
}
```

---

### Payment Management

#### POST /api/payments
**Description**: Process payment
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "order_id": 1,
  "payment_method_id": 1,
  "amount": 31.30,
  "tender_amount": 40.00
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "payment_id": 1,
    "payment_number": "PAY-2025-001",
    "change": 8.70,
    "status": "success",
    "receipt_url": "..."
  }
}
```

#### POST /api/payments/webhook
**Description**: Payment gateway webhook (for card/online payments)
**Request**: Varies by gateway

#### POST /api/payments/:id/refund
**Description**: Refund payment
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "amount": 31.30,
  "reason": "Customer complaint"
}
```

#### GET /api/payments/:id/receipt
**Description**: Get payment receipt (PDF/HTML)

---

### Inventory Management

#### GET /api/inventory
**Description**: List inventory items
**Query Params**: `category`, `low_stock` (boolean)

#### POST /api/inventory/movements
**Description**: Record stock movement
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "inventory_item_id": 1,
  "type": "in",
  "qty": 100,
  "cost_per_unit": 2.50,
  "reason": "Supplier delivery"
}
```

#### GET /api/inventory/alerts
**Description**: Get low stock alerts

#### GET /api/inventory/items/:id/bom
**Description**: Get BOM for inventory item

---

### Customer Management

#### GET /api/customers
**Description**: List customers
**Query Params**: `phone`, `email`, `search`

#### GET /api/customers/:id
**Description**: Get customer details with order history

#### POST /api/customers
**Description**: Create customer
**Request**:
```json
{
  "full_name": "Jane Doe",
  "phone": "1234567890",
  "email": "jane@example.com",
  "address": "123 Main St"
}
```

#### GET /api/customers/:id/loyalty
**Description**: Get loyalty points and transactions

---

### Reservations

#### GET /api/reservations
**Description**: List reservations
**Query Params**: `status`, `date`

#### POST /api/reservations
**Description**: Create reservation
**Request**:
```json
{
  "customer_name": "John Smith",
  "customer_phone": "1234567890",
  "customer_email": "john@example.com",
  "reservation_time": "2025-11-20T19:00:00Z",
  "pax": 4,
  "special_requests": "Window seat"
}
```

#### PUT /api/reservations/:id/checkin
**Description**: Check-in reservation
**Request**:
```json
{
  "table_id": 5
}
```

---

### Reports

#### GET /api/reports/sales
**Description**: Sales report
**Query Params**: 
- `from_date`, `to_date`: Date range
- `group_by`: `day`, `week`, `month`, `product`, `employee`
**Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_orders": 150,
      "total_sales": 4500.00,
      "avg_order_value": 30.00
    },
    "details": [...]
  }
}
```

#### GET /api/reports/inventory
**Description**: Inventory report

#### GET /api/reports/employees
**Description**: Employee performance report

#### GET /api/reports/export
**Description**: Export report (CSV/PDF)
**Query Params**: `report_type`, `format`, `from_date`, `to_date`

---

### Shifts

#### POST /api/shifts/start
**Description**: Start shift
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "cash_start": 200.00
}
```

#### POST /api/shifts/end
**Description**: End shift
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "cash_end": 1500.00,
  "notes": "All good"
}
```

#### GET /api/shifts/:id
**Description**: Get shift details with all transactions

---

### Sync (Offline Support)

#### POST /api/sync/orders
**Description**: Batch sync offline orders
**Headers**: `Authorization: Bearer <token>`, `X-Device-ID: <device_id>`
**Request**:
```json
{
  "orders": [
    {
      "local_order_id": "local-001",
      "idempotency_key": "device-001-1637426400",
      "data": {
        "table_id": 1,
        "lines": [...],
        "opened_at": "2025-11-20T10:30:00Z"
      }
    }
  ]
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "synced": [
      {
        "local_order_id": "local-001",
        "server_order_id": 123,
        "order_number": "ORD-2025-123"
      }
    ],
    "conflicts": [],
    "errors": []
  }
}
```

#### POST /api/sync/resolve-conflict
**Description**: Resolve sync conflict
**Request**:
```json
{
  "sync_queue_id": 1,
  "resolution": "accept_server" | "accept_client" | "merge"
}
```

---

## 🔄 WebSocket Events

### Connection & Authentication

```javascript
// Client connects with JWT token
const socket = io('https://api.restaurant.app', {
  auth: {
    token: 'Bearer <jwt_token>'
  }
});

// Subscribe to channels
socket.emit('subscribe', { 
  channels: ['floor:1', 'kitchen:main', 'order:123'] 
});
```

### Server → Client Events

#### order:created
```javascript
socket.on('order:created', (data) => {
  // data: { order_id, order_number, table_id, employee_id, ... }
});
```

#### order:updated
```javascript
socket.on('order:updated', (data) => {
  // data: { order_id, changes: { ... } }
});
```

#### order:status_changed
```javascript
socket.on('order:status_changed', (data) => {
  // data: { order_id, old_status, new_status }
});
```

#### kitchen:order:new
```javascript
socket.on('kitchen:order:new', (data) => {
  // data: { queue_id, order_number, items: [...] }
});
```

#### kitchen:order:update
```javascript
socket.on('kitchen:order:update', (data) => {
  // data: { queue_id, item_id, status: 'cooking' | 'ready' }
});
```

#### table:status:update
```javascript
socket.on('table:status:update', (data) => {
  // data: { table_id, status: 'available' | 'occupied' | ... }
});
```

#### payment:created
```javascript
socket.on('payment:created', (data) => {
  // data: { payment_id, order_id, amount, status }
});
```

#### inventory:low_alert
```javascript
socket.on('inventory:low_alert', (data) => {
  // data: { inventory_item_id, name, current_qty, min_qty }
});
```

#### menu:updated
```javascript
socket.on('menu:updated', (data) => {
  // data: { version, changes: [...] }
});
```

---

## 🛡️ Security Measures

### Authentication & Authorization

```javascript
// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
```

### QR Code Token Validation

```javascript
// middleware/qr-auth.middleware.js
const validateQRToken = async (req, res, next) => {
  const token = req.headers['x-table-token'];
  const tableId = req.params.table_id;
  
  if (!token) return res.status(401).json({ error: 'Missing table token' });
  
  const table = await Table.findOne({ 
    where: { id: tableId, qr_code_token: token } 
  });
  
  if (!table) return res.status(403).json({ error: 'Invalid table token' });
  if (table.status === 'needs_cleaning') {
    return res.status(400).json({ error: 'Table is being cleaned' });
  }
  
  req.table = table;
  next();
};
```

### Rate Limiting

```javascript
// middleware/rate-limit.middleware.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

const qrOrderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 orders per 5 min per table
  keyGenerator: (req) => req.params.table_id
});

module.exports = { apiLimiter, qrOrderLimiter };
```

### Input Validation

```javascript
// validators/order.validator.js
const Joi = require('joi');

const createOrderSchema = Joi.object({
  table_id: Joi.number().integer().required(),
  employee_id: Joi.number().integer().required(),
  source: Joi.string().valid('pos', 'kiosk', 'qr_table', 'online').required(),
  customer_id: Joi.number().integer().allow(null)
});

const addOrderLinesSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      menu_item_id: Joi.number().integer().required(),
      quantity: Joi.number().min(0.01).required(),
      modifiers: Joi.array().items(
        Joi.object({
          modifier_id: Joi.number().integer(),
          name: Joi.string(),
          price: Joi.number()
        })
      ),
      note: Joi.string().max(500).allow('')
    })
  ).min(1).required()
});

module.exports = { createOrderSchema, addOrderLinesSchema };
```

---

## 🔄 Core Services

### Order Service

```javascript
// services/order.service.js
const { Order, OrderLine, MenuItem, Table } = require('../models');
const { sequelize } = require('../config/database');
const notificationService = require('./notification.service');

class OrderService {
  async createOrder(data) {
    const transaction = await sequelize.transaction();
    try {
      const orderNumber = await this.generateOrderNumber();
      
      const order = await Order.create({
        order_number: orderNumber,
        ...data,
        status: 'open'
      }, { transaction });
      
      // Update table status
      if (data.table_id) {
        await Table.update(
          { status: 'occupied' },
          { where: { id: data.table_id }, transaction }
        );
      }
      
      await transaction.commit();
      
      // Emit realtime event
      notificationService.emit('order:created', order);
      
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async addOrderLines(orderId, items) {
    const transaction = await sequelize.transaction();
    try {
      const lines = [];
      
      for (const item of items) {
        const menuItem = await MenuItem.findByPk(item.menu_item_id);
        if (!menuItem) throw new Error(`Menu item ${item.menu_item_id} not found`);
        
        let unitPrice = menuItem.base_price;
        if (item.modifiers) {
          unitPrice += item.modifiers.reduce((sum, m) => sum + (m.price || 0), 0);
        }
        
        const line = await OrderLine.create({
          order_id: orderId,
          menu_item_id: item.menu_item_id,
          menu_item_name: menuItem.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          modifiers: item.modifiers || [],
          note: item.note,
          line_total: unitPrice * item.quantity
        }, { transaction });
        
        lines.push(line);
      }
      
      // Recalculate order totals (trigger will handle this)
      const order = await Order.findByPk(orderId, { transaction });
      
      await transaction.commit();
      
      // Emit realtime event
      notificationService.emit('order:updated', { order_id: orderId, lines });
      
      return lines;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async sendToKitchen(orderId) {
    const order = await Order.findByPk(orderId, {
      include: [OrderLine]
    });
    
    if (!order) throw new Error('Order not found');
    if (order.status !== 'open') throw new Error('Order already sent');
    
    await order.update({ 
      status: 'sent_to_kitchen',
      sent_to_kitchen_at: new Date()
    });
    
    // Emit to kitchen
    notificationService.emit('kitchen:order:new', order);
    
    return order;
  }
  
  async generateOrderNumber() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const count = await Order.count({
      where: sequelize.where(
        sequelize.fn('DATE', sequelize.col('opened_at')),
        new Date().toISOString().split('T')[0]
      )
    });
    return `ORD-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}

module.exports = new OrderService();
```

### Payment Service

```javascript
// services/payment.service.js
const { Payment, Order } = require('../models');
const { sequelize } = require('../config/database');
const inventoryService = require('./inventory.service');
const notificationService = require('./notification.service');

class PaymentService {
  async processPayment(data, processedBy) {
    const transaction = await sequelize.transaction();
    try {
      const paymentNumber = await this.generatePaymentNumber();
      
      const payment = await Payment.create({
        payment_number: paymentNumber,
        ...data,
        processed_by: processedBy,
        processed_at: new Date(),
        status: 'success'
      }, { transaction });
      
      // Update order status
      await Order.update(
        { status: 'paid', paid_at: new Date() },
        { where: { id: data.order_id }, transaction }
      );
      
      // Deduct inventory (trigger will handle this automatically)
      
      await transaction.commit();
      
      // Emit realtime event
      notificationService.emit('payment:created', payment);
      
      return payment;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  async generatePaymentNumber() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const count = await Payment.count({
      where: sequelize.where(
        sequelize.fn('DATE', sequelize.col('processed_at')),
        new Date().toISOString().split('T')[0]
      )
    });
    return `PAY-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}

module.exports = new PaymentService();
```

### Inventory Service

```javascript
// services/inventory.service.js
const { InventoryItem, StockMovement, BOM } = require('../models');
const { sequelize } = require('../config/database');

class InventoryService {
  async deductInventory(orderId) {
    const orderLines = await OrderLine.findAll({
      where: { order_id: orderId },
      include: [{ model: MenuItem, include: [BOM] }]
    });
    
    const transaction = await sequelize.transaction();
    try {
      for (const line of orderLines) {
        for (const bomItem of line.MenuItem.BOMs) {
          const qtyToDeduct = bomItem.qty_required * line.quantity;
          
          const item = await InventoryItem.findByPk(
            bomItem.inventory_item_id,
            { lock: true, transaction }
          );
          
          if (item.qty < qtyToDeduct) {
            throw new Error(`Insufficient stock for ${item.name}`);
          }
          
          await item.update(
            { qty: item.qty - qtyToDeduct },
            { transaction }
          );
          
          await StockMovement.create({
            inventory_item_id: item.id,
            type: 'out',
            qty: qtyToDeduct,
            reference_type: 'order',
            reference_id: orderId
          }, { transaction });
        }
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new InventoryService();
```

---

## 🎛️ Environment Variables

```bash
# .env.example

# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Payment Gateway (Stripe example)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# Printer
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100

# File Upload
MAX_FILE_SIZE=5MB
UPLOAD_DIR=./uploads

# CORS
CORS_ORIGIN=http://localhost:19006,http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

---

## 🚀 Deployment

### Production Setup

```bash
# Install dependencies
npm install --production

# Run migrations
npm run migrate

# Start with PM2
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit
```

### ecosystem.config.js (PM2)

```javascript
module.exports = {
  apps: [{
    name: 'restaurant-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

---

## 📊 Monitoring & Logging

### Winston Logger Setup

```javascript
// config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

---

## ✅ Testing

### Unit Test Example

```javascript
// tests/unit/order.service.test.js
const OrderService = require('../../src/services/order.service');
const { Order, MenuItem } = require('../../src/models');

jest.mock('../../src/models');

describe('OrderService', () => {
  describe('createOrder', () => {
    it('should create order and update table status', async () => {
      const mockOrder = { id: 1, order_number: 'ORD-001' };
      Order.create.mockResolvedValue(mockOrder);
      
      const result = await OrderService.createOrder({
        table_id: 1,
        employee_id: 1
      });
      
      expect(result).toEqual(mockOrder);
      expect(Order.create).toHaveBeenCalled();
    });
  });
});
```

### Integration Test Example

```javascript
// tests/integration/order.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Order API', () => {
  let authToken;
  
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'test123' });
    authToken = res.body.data.token;
  });
  
  it('POST /api/orders should create order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        table_id: 1,
        employee_id: 1,
        source: 'pos'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('order_number');
  });
});
```

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-20
