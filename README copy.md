# 🍽️ Hệ Thống Quản Lý Nhà Hàng (Restaurant Management System)

## 📋 Tổng Quan

Hệ thống quản lý nhà hàng toàn diện dựa trên mô hình Odoo POS, hỗ trợ đầy đủ quy trình từ Front-of-House → Kitchen → Payment → Reporting với khả năng hoạt động offline và đồng bộ realtime.

### Tech Stack

- **Backend**: Node.js (Express/NestJS)
- **Frontend**: React Native (cross-platform for tablets, kiosk, kitchen display)
- **Database**: PostgreSQL
- **Realtime**: WebSocket (Socket.io)
- **Payment Integration**: Card terminals, payment gateways
- **Printing**: ESC/POS protocol

---

## 🎯 Nghiệp Vụ Chính (Core Business Processes)

### 1. Quản Lý Thực Đơn (Menu Management)
- Tạo/sửa/xóa món ăn, nhóm món, biến thể (size, topping)
- Quản lý giá theo thời gian, khuyến mãi
- Upload ảnh, mô tả, đơn vị tính, giá vốn

### 2. Quản Lý Bàn & Sơ Đồ Tầng (Floor Plan & Table Management)
- Vẽ sơ đồ tầng, tạo bàn với số chỗ ngồi
- Theo dõi trạng thái bàn (trống/đang phục vụ/đã đặt/cần dọn)
- Gộp/tách bàn, chuyển bàn
- **QR Code tại bàn**: Mỗi bàn có mã QR riêng, khách quét để order món trực tiếp

### 3. Đặt Bàn (Reservation)
- Đặt bàn online/điện thoại
- Check-in, auto-assign hoặc manual assign bàn
- Quản lý overbooking, late arrival

### 4. Order & POS
- **POS Tablet (Nhân viên)**: Order nhanh, tìm món, modifier, note
- **Kiosk (Self-service)**: Khách tự order và thanh toán
- **QR Order tại bàn**: Khách quét mã QR → order món → đẩy về POS/Kitchen
- Hold/recall order, split/merge bill

### 5. Điều Phối Bếp (Kitchen Workflow)
- Queue order theo khu vực bếp (drinks, grill, dessert, etc.)
- Kitchen display/printer
- Trạng thái món: Pending → Cooking → Ready → Served
- Realtime update về POS

### 6. Thanh Toán (Payment)
- Tiền mặt (cash)
- Thẻ (card terminal integration)
- Kiosk payment (gateway)
- QR payment (e-wallet)
- Split bill, share bill, coupon, gift card
- In hóa đơn, gửi email/SMS

### 7. Quản Lý Kho (Inventory Management)
- Mapping món → BOM (Bill of Materials)
- Tự động trừ tồn khi bán
- Nhập/xuất kho, cảnh báo tồn tối thiểu
- Stock movement audit

### 8. Quản Lý Nhân Viên (Employee & Access Control)
- Role-based access: Admin, Manager, Cashier, Waiter, Chef
- Login (PIN/username/password)
- Quản lý ca làm việc
- Audit log mọi thao tác

### 9. Khách Hàng & Loyalty
- Lưu thông tin khách hàng
- Lịch sử order
- Điểm tích lũy, phiếu giảm giá
- Nhận diện tự động qua phone/email

### 10. Báo Cáo & Analytics
- Doanh thu theo ca/ngày/sản phẩm
- Gross margin, top products
- Inventory turnover
- Hiệu suất nhân viên
- Export CSV/PDF

### 11. Hoạt Động Offline & Đồng Bộ
- POS hoạt động offline khi mất mạng
- Lưu local và sync khi có mạng
- Conflict resolution

### 12. Tích Hợp
- Online ordering website
- Delivery partners
- Accounting systems
- Network printer/ESC/POS

---

## 🔄 Luồng Hoạt Động Chi Tiết (Detailed Workflows)

### Luồng 1: Walk-in Dine-in (Khách ngồi tại chỗ)

**Actors**: Khách, Waiter, POS Tablet, Server, Kitchen, Printer

**Flow**:
1. **Chọn bàn**: Waiter mở Floorplan → chọn bàn trống → `POST /api/tables/{id}/occupy`
2. **Tạo order**: Server tạo Order mới với `status=open`, gán `table_id`, `opened_by`, `timestamp`
3. **Thêm món**: Waiter chọn món → `POST /api/orders/{order_id}/lines` (menu_item, qty, modifiers, note)
4. **Gửi bếp**: Waiter bấm "Gửi tới bếp" → Server đánh dấu `kitchen_status=pending`, đẩy vào kitchen queue (WebSocket event `kitchen:order:new`)
5. **Bếp xử lý**: 
   - Kitchen screen hiển thị order
   - Chef đánh dấu `cooking` → `ready`
   - Server push event `kitchen:order:update` về POS
6. **Phục vụ**: Waiter thấy món `ready`, mang ra khách
7. **Thanh toán**: Khách yêu cầu bill → Waiter chọn payment method → `POST /api/payments`
8. **Hoàn tất**: 
   - Server mark `order.status=paid`
   - In hóa đơn
   - Trừ tồn kho theo BOM
   - Bàn chuyển `status=needs_cleaning`

**Acceptance Criteria**:
- Order tạo trong <1s
- Kitchen nhận order trong <2s sau khi "Gửi bếp"
- Sau thanh toán, hóa đơn in ra đầy đủ (món, thuế, giảm giá, tổng)
- Stock giảm đúng số lượng theo BOM

**Edge Cases**:
- DB lỗi → lưu local (offline mode)
- Kitchen printer offline → queue và retry
- 2 waiter cùng thao tác 1 bàn → optimistic lock/version control

---

### Luồng 2: QR Code Order tại Bàn (Table QR Ordering) ⭐ NEW

**Actors**: Khách, QR Code, Mobile Web/App, Server, Kitchen

**Precondition**: Bàn đang có order mở (hoặc tạo mới), mỗi bàn có mã QR riêng

**Flow**:
1. **Quét mã QR**: Khách quét QR code trên bàn → redirect tới `https://restaurant.app/table/{table_id}/menu`
2. **Load menu**: Mobile web load menu từ `GET /api/menu` (có thể filter theo availability)
3. **Chọn món**: Khách chọn món, modifier, ghi chú → add vào cart local
4. **Gửi order**: Khách bấm "Gửi order" → `POST /api/orders/table/{table_id}/add-items`
   - Nếu bàn chưa có order → tạo order mới với `source=qr_table`
   - Nếu đã có order mở → append items vào order hiện tại
5. **Realtime update**: 
   - Server push event `order:updated` tới POS tablet của waiter phụ trách bàn đó
   - POS hiển thị notification: "Bàn 5 vừa order thêm 2 món"
6. **Xác nhận**: Waiter có thể review và confirm trước khi gửi bếp (optional, config)
   - Hoặc auto-send tới bếp (tuỳ policy)
7. **Bếp nhận**: Kitchen nhận order như bình thường
8. **Thanh toán**: Waiter đến bàn xử lý thanh toán hoặc khách có thể thanh toán trực tiếp qua QR code (nếu bật tính năng)

**QR Code Format**: 
```
https://restaurant.app/table/{table_id}?token={secure_token}
```
- `table_id`: ID của bàn
- `secure_token`: Token để verify bàn (tránh fake QR), có thể rotate định kỳ

**Acceptance Criteria**:
- Quét QR → menu load trong <2s
- Order từ QR gộp vào order bàn hiện tại (nếu có)
- Waiter nhận notification realtime khi khách order từ QR
- Có thể config: auto-send bếp hoặc cần waiter confirm

**Edge Cases**:
- Bàn đã thanh toán xong mà khách vẫn quét QR → hiển thị "Bàn đã check-out, vui lòng gọi nhân viên"
- Multiple khách cùng quét QR 1 bàn → merge items vào cùng order
- Offline: khách không thể order qua QR → hiển thị thông báo gọi waiter

**Security**:
- Token trong QR phải được verify
- Rate limit để tránh spam
- Log audit trail: ai order gì từ bàn nào

---

### Luồng 3: Reservation (Đặt bàn)

**Flow**:
1. Khách đặt bàn online/phone → tạo `Reservation` (customer, time, pax, requests)
2. Đến giờ → Receptionist check-in → gán bàn → tạo Order liên kết reservation
3. Tiếp theo như flow dine-in

**Edge Cases**:
- Overbooking → gợi ý chờ hoặc split table
- Khách đến muộn → auto-cancel sau N phút

---

### Luồng 4: Self-Service Kiosk

**Flow**:
1. Khách chọn Self-order → chọn bàn hoặc takeaway
2. Kiosk load menu → khách chọn món → `POST /api/orders`
3. Server trả `order_id` và payment token
4. Khách chọn payment (card) → kiosk tích hợp terminal/gateway
5. Payment success → webhook `POST /api/payments/webhook` → mark `order.status=paid`
6. Server đẩy order tới kitchen và in hóa đơn

**Security**:
- Payment: 3DS, tokenization
- Idempotency key để tránh duplicate

**Edge Cases**:
- Payment fail → retry hoặc cancel
- Network mất → lưu local và hướng dẫn liên hệ nhân viên

---

### Luồng 5: Kitchen Workflow

**Flow**:
1. Server nhận order → phân tách theo `kitchen_area` (drinks, grill, dessert)
2. Đẩy tới kitchen screen (WebSocket) và/hoặc in ticket
3. Chef mark `in_progress` → `cooking` → `ready`
4. Nếu thiếu nguyên liệu → tạo `InventoryAlert` cho manager

**Edge Cases**:
- Món được sửa sau khi in ticket → reprint hoặc high-priority update
- Kitchen offline → sync khi online lại

---

### Luồng 6: Payment - Tiền Mặt

**Flow**:
1. POS chọn Thanh toán → hiển thị tổng, tax, discount
2. Nhập tiền khách đưa → tính tiền thối → confirm
3. Server tạo `Payment` (method=cash) → mark `order.status=paid`
4. In hóa đơn, update inventory

**Edge Cases**:
- Double-click confirm → idempotency check
- In bill fail → vẫn mark paid và queue retry

---

### Luồng 7: Payment - Thẻ/Terminal

**Flow**:
1. POS gửi payment request tới terminal
2. Terminal thực hiện transaction → trả approved/declined
3. Approved → server tạo Payment với `txn_id` → mark paid
4. Declined → hiển thị lỗi, offer other method

**Edge Cases**:
- Terminal disconnect → allow offline batch mode (risky)
- Reconciliation: reconcile terminal settlement vs POS payments end-of-day

---

### Luồng 8: Split Bill / Merge Bill

**Split Bill**:
1. POS chọn Split bill → split by items hoặc by amount/%
2. Tạo nhiều `PaymentIntent` hoặc sub-orders
3. Mỗi part thanh toán riêng → khi tất cả paid → master order mark paid

**Merge Bill**:
1. Chọn nhiều orders → Merge → tạo order mới combine lines hoặc parent/child relation
2. Recompute totals, taxes, discounts

**Edge Cases**:
- Split 1 line giữa 2 khách → fractional qty hoặc duplicate line với fractional price
- Một phần đã gửi bếp → vẫn giữ cooking status

---

### Luồng 9: Takeaway / Delivery

**Flow**:
1. Khách đặt online → tạo Order với `fulfillment_type=takeaway/delivery`
2. Server forward to kitchen
3. Kitchen prepare → update `prepared` → `picked_up` → `delivered`
4. Nếu có external partner → push order qua API và nhận tracking update

**Edge Cases**:
- Late delivery → auto-notify + offer voucher
- Cancel sau khi cooking → policy refund partial/full

---

### Luồng 10: Inventory Deduction

**Flow**:
1. Order paid → server lấy BOM của mỗi món
2. Transaction: `UPDATE inventory SET qty = qty - used WHERE id = x AND qty >= used`
3. Nếu fail (negative stock) → ROLLBACK và tạo `stock_issue`
4. Success → COMMIT và tạo `StockMovement`

**Edge Cases**:
- Concurrent sales → row locking (`SELECT FOR UPDATE`)
- Ingredient thiếu → notify waiter/kitchen, suggest alternative

---

### Luồng 11: Offline POS & Sync

**Flow**:
1. POS mất mạng → chuyển offline mode → lưu orders local với `local_order_id`
2. Online lại → batch sync: `POST /api/sync/orders` with idempotency keys
3. Server check conflicts (table freed, menu changed)
4. Nếu conflict → trả `sync_conflict` → POS show resolution UI
5. Sync success → server trả `order_id` chính thức

**Edge Cases**:
- Menu price changed khi offline → sync warning, operator accept/cancel
- 2 offline clients cùng tạo order cho 1 bàn → resolve: allow both + mark double-booked

---

### Luồng 12: Admin - Cập Nhật Menu

**Flow**:
1. Admin thay đổi món/giá → server update DB và tạo `menu_version++`
2. Server push event `menu:updated` → POS fetch updated menu
3. Active orders giữ nguyên giá cũ (snapshot), new orders dùng giá mới

**Edge Cases**:
- Admin xóa món đang trong order chưa gửi bếp → keep order_line nhưng mark `menu_item.deleted=true`

---

### Luồng 13: Reports

**Flow**:
1. Manager request report (sales by day) → server query aggregates
2. Server compute và cache → provide CSV/PDF export
3. Realtime dashboard dùng materialized views

**Edge Cases**:
- Refund sau report period → snapshot historical hoặc include adjustments với notes

---

### Luồng 14: Employee Login & Shift

**Flow**:
1. Employee login (PIN/username) → authenticate → return token
2. Start shift: `POST /api/shifts/start` → create Shift record
3. Mọi action POS gắn `audit_log` (who, when, reason)
4. End shift: `POST /api/shifts/end` → reconcile payments

**Edge Cases**:
- Quên end shift → manager override

---

### Luồng 15: Refund / Void

**Flow**:
1. Cashier request refund → tạo `RefundRequest`
2. Nếu amount <= threshold → auto-process, ngược lại cần manager approve
3. Card refund → call PSP refund API → tạo negative Payment
4. Cash refund → issue cash và record `cash_out`

**Edge Cases**:
- Partial refund on split bill → apply to respective sub-order

---

## 📊 Mô Hình Dữ Liệu (Data Model)

### Core Entities

#### User & Employee
- `users`: id, username, password_hash, email, role_id, created_at
- `roles`: id, name (admin, manager, cashier, waiter, chef), permissions (JSON)
- `employees`: id, user_id, full_name, phone, hire_date, status
- `shifts`: id, employee_id, start_time, end_time, cash_start, cash_end, status

#### Menu
- `menu_categories`: id, name, description, sort_order, active
- `menu_items`: id, category_id, name, description, image_url, base_price, cost, unit, active, created_at, updated_at
- `modifiers`: id, name, type (size/topping/extra), price_adjustment
- `menu_item_modifiers`: menu_item_id, modifier_id
- `menu_versions`: id, version_number, changed_by, changed_at, changes (JSON)

#### Floor & Tables
- `floors`: id, name, layout (JSON - coordinates, etc.)
- `tables`: id, floor_id, table_number, seats, qr_code_token, status (available/occupied/reserved/needs_cleaning), position_x, position_y
- `reservations`: id, customer_id, table_id, reservation_time, pax, status, special_requests, created_at

#### Orders
- `orders`: id, order_number, table_id, customer_id, employee_id, source (pos/kiosk/qr_table/online), status (open/sent_to_kitchen/ready/paid/cancelled), subtotal, tax, discount, total, opened_at, closed_at, payment_at
- `order_lines`: id, order_id, menu_item_id, quantity, unit_price, modifiers (JSON), note, kitchen_status (pending/cooking/ready/served), kitchen_area
- `order_notes`: id, order_id, note, created_by, created_at

#### Payments
- `payments`: id, order_id, method (cash/card/qr/wallet), amount, txn_id, gateway_response (JSON), status, processed_by, processed_at
- `payment_methods`: id, name, type, config (JSON - gateway credentials, etc.), active
- `refunds`: id, payment_id, amount, reason, approved_by, status, created_at

#### Inventory
- `inventory_items`: id, name, unit, qty, min_qty, cost_per_unit, supplier, last_updated
- `bom`: id, menu_item_id, inventory_item_id, qty_required
- `stock_movements`: id, inventory_item_id, type (in/out/adjustment), qty, reference_type, reference_id, performed_by, timestamp
- `stock_alerts`: id, inventory_item_id, alert_type (low/out), status, created_at

#### Customers
- `customers`: id, full_name, phone, email, address, loyalty_points, created_at
- `customer_orders`: customer_id, order_id (for linking)
- `loyalty_transactions`: id, customer_id, points, type (earn/redeem), reference_order_id, created_at

#### Kitchen
- `kitchen_areas`: id, name (drinks/grill/dessert/etc), printer_config (JSON)
- `kitchen_queue`: id, order_id, order_line_id, area_id, status, priority, received_at, started_at, completed_at

#### Sync & Audit
- `sync_queue`: id, device_id, entity_type, entity_id, operation, data (JSON), status, created_at
- `audit_logs`: id, user_id, entity_type, entity_id, action, old_value (JSON), new_value (JSON), ip_address, timestamp

---

## 🔌 API Endpoints (REST)

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Menu
- `GET /api/menu` - Get full menu (with filters)
- `GET /api/menu/categories` - Get categories
- `GET /api/menu/items/:id` - Get item detail
- `POST /api/menu/items` - Create item (admin)
- `PUT /api/menu/items/:id` - Update item (admin)
- `DELETE /api/menu/items/:id` - Delete item (admin)

### Tables & Floors
- `GET /api/floors` - Get floors with tables
- `GET /api/tables/:id` - Get table detail
- `POST /api/tables/:id/occupy` - Occupy table
- `POST /api/tables/:id/free` - Free table
- `POST /api/tables/merge` - Merge tables
- `POST /api/tables/split` - Split table
- `GET /api/tables/:id/qr` - Generate/get QR code for table

### Orders
- `GET /api/orders` - List orders (filters: status, table, date)
- `GET /api/orders/:id` - Get order detail
- `POST /api/orders` - Create new order
- `POST /api/orders/:id/lines` - Add items to order
- `PUT /api/orders/:id/lines/:line_id` - Update order line
- `DELETE /api/orders/:id/lines/:line_id` - Remove order line
- `POST /api/orders/:id/send-to-kitchen` - Send to kitchen
- `POST /api/orders/:id/split` - Split bill
- `POST /api/orders/merge` - Merge orders
- `POST /api/orders/table/:table_id/add-items` - Add items via QR order

### Kitchen
- `GET /api/kitchen/queue` - Get kitchen queue
- `PUT /api/kitchen/queue/:id/status` - Update item status
- `GET /api/kitchen/areas` - Get kitchen areas

### Payments
- `POST /api/payments` - Process payment
- `POST /api/payments/webhook` - Payment gateway webhook
- `POST /api/payments/:id/refund` - Refund payment
- `GET /api/payments/:id/receipt` - Get receipt

### Inventory
- `GET /api/inventory` - List inventory items
- `POST /api/inventory/movements` - Record stock movement
- `GET /api/inventory/alerts` - Get low stock alerts
- `GET /api/inventory/items/:id/bom` - Get BOM for item

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer detail
- `POST /api/customers` - Create customer
- `GET /api/customers/:id/loyalty` - Get loyalty info

### Reservations
- `GET /api/reservations` - List reservations
- `POST /api/reservations` - Create reservation
- `PUT /api/reservations/:id/checkin` - Check-in reservation

### Reports
- `GET /api/reports/sales` - Sales report (query params: from, to, group_by)
- `GET /api/reports/inventory` - Inventory report
- `GET /api/reports/employees` - Employee performance
- `GET /api/reports/export` - Export report (CSV/PDF)

### Shifts
- `POST /api/shifts/start` - Start shift
- `POST /api/shifts/end` - End shift
- `GET /api/shifts/:id` - Get shift detail

### Sync (Offline)
- `POST /api/sync/orders` - Batch sync offline orders
- `POST /api/sync/resolve-conflict` - Resolve sync conflict

---

## 🔄 Realtime Events (WebSocket)

### Events từ Server → Clients

- `order:created` - Order mới tạo
- `order:updated` - Order được cập nhật (add/remove items)
- `order:status_changed` - Trạng thái order đổi (sent_to_kitchen, ready, paid)
- `kitchen:order:new` - Order mới vào queue bếp
- `kitchen:order:update` - Trạng thái món trong bếp đổi
- `table:status:update` - Trạng thái bàn đổi
- `payment:created` - Payment mới
- `payment:refunded` - Payment bị refund
- `inventory:low_alert` - Cảnh báo tồn kho thấp
- `menu:updated` - Menu được cập nhật
- `sync:conflict` - Có conflict cần resolve

### Event Subscriptions

Clients subscribe theo:
- `floor:{floor_id}` - Subscribe tất cả events của 1 tầng
- `table:{table_id}` - Subscribe events của 1 bàn
- `order:{order_id}` - Subscribe events của 1 order
- `kitchen:{area_id}` - Subscribe events của 1 khu bếp
- `device:{device_id}` - Subscribe events của 1 device

---

## 📱 Frontend Modules (React Native)

### 1. POS Tablet App
- **Login**: PIN/username login
- **Floor Plan**: Visual floor layout, table status
- **Order Entry**: Quick item search, modifiers, notes
- **Order Management**: Hold, recall, split, merge
- **Payment**: Cash, card terminal integration
- **Kitchen Status**: View dish status realtime
- **Offline Mode**: Queue operations when offline

### 2. Kiosk App (Customer Self-Service)
- **Menu Browse**: Category navigation, item detail
- **Cart Management**: Add/remove items, modifiers
- **Payment**: Card/QR payment integration
- **Order Confirmation**: Print/show receipt

### 3. QR Table Ordering (Mobile Web/PWA)
- **Scan QR**: Camera scan or manual table code
- **Menu**: Responsive menu optimized for mobile
- **Order**: Add to cart, send to kitchen
- **Track Order**: View order status
- **Payment**: Optional self-payment

### 4. Kitchen Display System (KDS)
- **Queue View**: Grid/list view of pending orders
- **Order Detail**: Items, modifiers, notes
- **Status Update**: Tap to update cooking/ready
- **Alerts**: Sound/visual alerts for new orders

### 5. Admin Dashboard (Web/Tablet)
- **Menu Management**: CRUD menu items
- **Floor Management**: Create/edit floors, tables
- **Inventory**: Stock management, BOM
- **Reports**: Sales, inventory, employee
- **User Management**: Roles, permissions
- **Settings**: Payment methods, kitchen areas, etc.

---

## 🔐 Security & Access Control

### Role Permissions

| Feature | Admin | Manager | Cashier | Waiter | Chef |
|---------|-------|---------|---------|--------|------|
| Menu CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Menu | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Order | ✅ | ✅ | ✅ | ✅ | ❌ |
| Payment | ✅ | ✅ | ✅ | ❌ | ❌ |
| Refund | ✅ | ✅ | ❌ | ❌ | ❌ |
| Void Order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Inventory | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kitchen Queue | ✅ | ✅ | ❌ | View | ✅ |
| User Management | ✅ | ❌ | ❌ | ❌ | ❌ |

### Security Measures

- **Authentication**: JWT tokens with refresh mechanism
- **QR Code Security**: Secure tokens with expiry, rotation
- **Payment Security**: PCI-DSS compliance, tokenization, 3DS
- **API Rate Limiting**: Prevent abuse
- **Audit Trail**: All actions logged with user/timestamp
- **Data Encryption**: Sensitive data encrypted at rest and in transit
- **Input Validation**: Sanitize all user inputs
- **HTTPS Only**: All API communication over HTTPS

---

## 🎯 MVP Roadmap

### Phase 1 (MVP Core) - 4-6 weeks
- ✅ Basic POS: Order entry, cash payment
- ✅ Floor plan & table management
- ✅ Kitchen display (basic)
- ✅ Menu management (admin)
- ✅ Simple reporting
- ✅ Offline mode (basic)

### Phase 2 (Enhanced Features) - 4-6 weeks
- ✅ Card payment integration
- ✅ QR code table ordering
- ✅ Split/merge bill
- ✅ Inventory management with BOM
- ✅ Reservation system
- ✅ Employee management & shifts
- ✅ Enhanced kitchen workflow

### Phase 3 (Advanced) - 6-8 weeks
- ✅ Kiosk self-service
- ✅ Loyalty program
- ✅ Online ordering integration
- ✅ Delivery partner integration
- ✅ Advanced reporting & analytics
- ✅ Multi-location support (optional)
- ✅ Email/SMS notifications

---

## 🧪 Testing Requirements

### Unit Tests
- Business logic (order calculation, stock deduction)
- Payment processing
- BOM calculation

### Integration Tests
- API endpoints
- Database transactions
- WebSocket events
- Payment gateway integration

### E2E Tests
- Complete order flow (create → kitchen → payment)
- Offline sync scenario
- Split bill scenario
- QR ordering flow

### Performance Tests
- Concurrent orders (100+ simultaneous)
- Offline → online sync with large queue
- Real-time event delivery latency (<2s)
- Database query optimization (order list, reports)

### UAT Scenarios
- Peak hour simulation (lunch/dinner rush)
- Network failure recovery
- Hardware failure (printer, terminal)
- User role scenarios

---

## 📈 Non-Functional Requirements

### Performance
- Order creation: <1s
- Kitchen notification: <2s
- Menu load: <2s
- Report generation: <5s (for 1 month data)
- Offline → online sync: <10s for 50 orders

### Scalability
- Support 100 concurrent POS devices
- Handle 10,000 orders/day per location
- Store 2 years of transaction history

### Availability
- 99.9% uptime for online services
- 100% availability for offline POS core features
- Auto-failover for critical services

### Reliability
- Zero data loss on sync
- Idempotent payment processing
- Automatic retry for failed operations

### Usability
- Intuitive UI, minimal training required
- Touch-optimized for tablets
- Responsive design for mobile (QR ordering)
- Multi-language support (optional)

---

## 🚀 Deployment Architecture

### Backend
- **Web Server**: Node.js (PM2/cluster mode)
- **Database**: PostgreSQL (with connection pooling)
- **Cache**: Redis (for sessions, frequently accessed data)
- **Message Queue**: Redis/RabbitMQ (for async jobs)
- **WebSocket**: Socket.io with Redis adapter (for horizontal scaling)

### Frontend
- **POS/Kiosk/KDS**: React Native (compiled for tablets/kiosks)
- **QR Ordering**: PWA (Progressive Web App) for mobile
- **Admin**: React Native Web or Next.js

### Infrastructure
- **Cloud**: AWS/Azure/GCP or On-premise
- **CDN**: CloudFront/CloudFlare for static assets
- **Monitoring**: PM2, New Relic, or DataDog
- **Logging**: Winston + ELK stack or CloudWatch
- **Backup**: Automated daily DB backups

### Network
- **Local Network**: All POS devices on same LAN for low latency
- **Printer**: Network printers (ESC/POS) or local USB
- **Payment Terminal**: LAN or Bluetooth connection

---

## 📝 Acceptance Criteria Summary

### Critical Features

1. **Order Flow**
   - ✅ Waiter có thể tạo order trong <1s
   - ✅ Kitchen nhận order trong <2s
   - ✅ Trạng thái món cập nhật realtime về POS

2. **QR Table Ordering**
   - ✅ Quét QR → menu load trong <2s
   - ✅ Order từ QR tự động gộp vào order bàn hiện tại
   - ✅ Waiter nhận notification khi khách order qua QR
   - ✅ Có thể config auto-send bếp hoặc cần confirm

3. **Payment**
   - ✅ Support cash, card, QR payment
   - ✅ Hóa đơn in đúng thông tin (món, thuế, giảm giá, tổng)
   - ✅ Payment idempotent (không duplicate)
   - ✅ Reconciliation end-of-day khớp

4. **Offline Mode**
   - ✅ POS vẫn tạo order khi offline
   - ✅ Sync tự động khi online lại
   - ✅ Conflict resolution có UI rõ ràng

5. **Inventory**
   - ✅ Bán 1 món → trừ đúng nguyên liệu theo BOM
   - ✅ Cảnh báo khi tồn thấp
   - ✅ Không bán âm kho (hoặc có alert)

6. **Security**
   - ✅ Role-based access đúng permissions
   - ✅ QR token secure, không fake được
   - ✅ Payment PCI-DSS compliant
   - ✅ Audit trail đầy đủ

---

## 📞 Support & Maintenance

### Daily Operations
- Monitor system health (CPU, memory, DB)
- Check kitchen printer/terminal status
- Review failed sync queue
- Reconcile payments vs bank/terminal

### Weekly Tasks
- Database backup verification
- Review audit logs for anomalies
- Update menu/pricing as needed
- Generate weekly reports

### Monthly Tasks
- Database optimization (vacuum, reindex)
- Review and archive old data
- Software updates/patches
- Performance tuning

---

## 📚 Documentation Deliverables

1. ✅ **README.md** (this file)
2. **database-schema.sql** - PostgreSQL schema
3. **api-documentation.md** - API endpoints, request/response
4. **workflow-diagrams.md** - Sequence diagrams for key flows
5. **deployment-guide.md** - Setup, configuration, deployment steps
6. **user-manual.md** - End-user guide (waiter, cashier, admin)
7. **developer-guide.md** - Code structure, conventions, contributing

---

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- React Native CLI (for mobile builds)

### Installation
```bash
# Clone repository
git clone <repo-url>
cd restaurant

# Install backend dependencies
cd backend
npm install

# Setup database
psql -U postgres -f database-schema.sql

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
npm run migrate

# Start backend
npm run dev

# Install frontend dependencies
cd ../frontend
npm install

# Start frontend (development)
npm start
```

### Configuration
- Database: `backend/.env` - DB connection string
- Payment Gateway: `backend/config/payment.js`
- Kitchen Areas: `backend/config/kitchen.js`
- Printer: `backend/config/printer.js`

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

[Specify license - e.g., MIT, Proprietary]

---

## 📧 Contact

- **Project Manager**: [name@email.com]
- **Tech Lead**: [name@email.com]
- **Support**: [support@email.com]

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-20  
**Status**: In Development (MVP Phase 1)
