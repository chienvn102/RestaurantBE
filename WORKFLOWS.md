# Workflow Diagrams & Sequence Flows

## 📊 Visual Workflows

This document provides detailed sequence diagrams and flowcharts for all major business processes in the restaurant management system.

---

## 1. Walk-in Dine-in Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant W as Waiter (POS)
    participant S as Server
    participant DB as Database
    participant K as Kitchen Display
    participant P as Printer
    
    C->>W: Arrives at restaurant
    W->>S: GET /api/floors (load floor plan)
    S->>DB: Query tables
    DB-->>S: Return tables with status
    S-->>W: Floor plan data
    
    W->>W: Select available table
    W->>S: POST /api/tables/{id}/occupy
    S->>DB: UPDATE table SET status='occupied'
    S-->>W: Table occupied
    S-->>K: WS: table:status:update
    
    W->>S: POST /api/orders (create order)
    S->>DB: INSERT INTO orders
    DB-->>S: Order created
    S-->>W: Order ID
    
    loop Add items
        C->>W: Request item
        W->>W: Select menu item + modifiers
        W->>S: POST /api/orders/{id}/lines
        S->>DB: INSERT INTO order_lines
        S->>DB: Recalculate totals (trigger)
        DB-->>S: Updated order
        S-->>W: Order updated
    end
    
    W->>S: POST /api/orders/{id}/send-to-kitchen
    S->>DB: UPDATE order SET status='sent_to_kitchen'
    S->>DB: UPDATE order_lines SET kitchen_status='pending'
    S-->>K: WS: kitchen:order:new
    K->>K: Display order in queue
    K->>P: Print kitchen ticket
    S-->>W: Kitchen notified
    
    Note over K: Chef prepares food
    K->>S: PUT /api/kitchen/queue/{id}/status (cooking)
    S->>DB: UPDATE kitchen_queue SET status='cooking'
    S-->>W: WS: kitchen:order:update
    
    K->>S: PUT /api/kitchen/queue/{id}/status (ready)
    S->>DB: UPDATE kitchen_queue SET status='ready'
    S-->>W: WS: kitchen:order:update
    W->>W: Display "ready" indicator
    
    C->>W: Request bill
    W->>S: GET /api/orders/{id} (verify totals)
    S->>DB: SELECT order with lines
    DB-->>S: Order details
    S-->>W: Order summary
    
    W->>W: Select payment method
    W->>S: POST /api/payments
    S->>DB: BEGIN TRANSACTION
    S->>DB: INSERT INTO payments
    S->>DB: UPDATE order SET status='paid'
    S->>DB: Deduct inventory (trigger)
    S->>DB: COMMIT
    S->>P: Print receipt
    DB-->>S: Payment successful
    S-->>W: Payment confirmed
    
    W->>S: POST /api/tables/{id}/free
    S->>DB: UPDATE table SET status='needs_cleaning'
    S-->>W: Table freed
```

### Flowchart

```
┌─────────────────┐
│ Customer Arrives│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Waiter Selects  │
│ Available Table │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Order   │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Add    │◄────────┐
    │ Items  │         │
    └───┬────┘         │
        │              │
        ▼              │
    ┌────────┐         │
    │ More?  ├─Yes─────┘
    └───┬────┘
        │ No
        ▼
┌─────────────────┐
│ Send to Kitchen │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Kitchen Prepares│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Customer Eats   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Request Bill    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Payment │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Free Table      │
└─────────────────┘
```

---

## 2. QR Code Table Ordering Flow ⭐

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Customer (Mobile)
    participant QR as QR Ordering App
    participant S as Server
    participant DB as Database
    participant W as Waiter (POS)
    participant K as Kitchen Display
    
    C->>C: Scan QR code on table
    C->>QR: Open URL with table_id & token
    
    QR->>S: GET /api/menu
    S->>DB: SELECT menu_items WHERE active=true
    DB-->>S: Menu data
    S-->>QR: Menu with categories & items
    
    QR->>QR: Display menu
    
    loop Select items
        C->>QR: Tap item
        QR->>QR: Show modifiers modal
        C->>QR: Select modifiers, add note
        QR->>QR: Add to cart
    end
    
    C->>QR: Tap "Send Order"
    
    QR->>S: POST /api/orders/table/{table_id}/add-items
    Note right of QR: Headers: X-Table-Token
    
    S->>S: Validate QR token
    
    alt Token invalid
        S-->>QR: 403 Forbidden
        QR->>C: Show error: "Invalid QR code"
    else Table not available
        S-->>QR: 400 Bad Request
        QR->>C: Show error: "Table not available"
    else Token valid
        S->>DB: Check if table has open order
        
        alt No open order
            S->>DB: INSERT INTO orders (source='qr_table')
            DB-->>S: New order created
        else Open order exists
            S->>DB: Get existing order_id
        end
        
        S->>DB: INSERT INTO order_lines (items)
        S->>DB: Recalculate order totals
        DB-->>S: Order updated
        
        S-->>QR: Order confirmed
        QR->>C: Show success message
        
        S-->>W: WS: order:updated (notification)
        W->>W: Display notification: "Table 5 ordered 2 items"
        
        Note over W: Waiter reviews order
        
        alt Auto-send to kitchen enabled
            S->>DB: UPDATE order_lines SET kitchen_status='pending'
            S-->>K: WS: kitchen:order:new
            K->>K: Display in queue
        else Manual confirmation required
            W->>W: Review QR order
            W->>S: POST /api/orders/{id}/send-to-kitchen
            S->>DB: UPDATE order SET status='sent_to_kitchen'
            S-->>K: WS: kitchen:order:new
        end
        
        opt Customer tracks order
            QR->>S: GET /api/orders/{id} (poll or WebSocket)
            S->>DB: SELECT order with kitchen status
            DB-->>S: Order status
            S-->>QR: Display status (pending/cooking/ready)
        end
    end
```

### Flowchart

```
┌─────────────────┐
│ Customer Scans  │
│   Table QR Code │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validate Token │
└────┬────────────┘
     │
     ├─Invalid──► [Show Error]
     │
     │ Valid
     ▼
┌─────────────────┐
│  Load Menu      │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Select │◄────────┐
    │ Items  │         │
    └───┬────┘         │
        │              │
        ▼              │
    ┌────────┐         │
    │ More?  ├─Yes─────┘
    └───┬────┘
        │ No
        ▼
┌─────────────────┐
│  Send Order     │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Has    │
    │ Order? │
    └───┬────┘
        │
        ├─No──► [Create New Order]─┐
        │                          │
        │ Yes                      │
        ▼                          │
    [Append to                     │
     Existing Order]               │
        │                          │
        └──────────┬───────────────┘
                   │
                   ▼
            ┌──────────┐
            │ Notify   │
            │ Waiter   │
            └─────┬────┘
                  │
                  ▼
            ┌──────────┐
            │Auto-send?│
            └─────┬────┘
                  │
         ├─Yes───┴───No─┐
         │               │
         ▼               ▼
    [Send to       [Waiter
     Kitchen]       Confirms]
         │               │
         └───────┬───────┘
                 │
                 ▼
          [Kitchen Prepares]
```

### Security Considerations

1. **QR Token Validation**:
   - Token must match table's `qr_code_token` in DB
   - Token should be rotated periodically (e.g., daily or per session)
   - Invalid token → reject request immediately

2. **Rate Limiting**:
   - Limit orders per table per time window (e.g., 20 orders per 5 minutes)
   - Prevent spam/abuse

3. **Table Status Check**:
   - If table status is `needs_cleaning` or `available` → show message "Please call a waiter"
   - Only allow ordering when table is `occupied` or `reserved`

---

## 3. Kitchen Workflow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant POS as POS/QR App
    participant S as Server
    participant DB as Database
    participant K as Kitchen Display
    participant P as Kitchen Printer
    participant Chef as Chef
    
    POS->>S: POST /api/orders/{id}/send-to-kitchen
    S->>DB: UPDATE order SET status='sent_to_kitchen'
    S->>DB: INSERT INTO kitchen_queue (per area)
    
    S->>K: WS: kitchen:order:new
    S->>P: Print kitchen ticket
    
    K->>K: Display order card in "Pending" column
    K->>K: Play sound alert
    
    Chef->>K: Tap order card → View details
    Chef->>K: Tap "Start" button
    
    K->>S: PUT /api/kitchen/queue/{id}/status
    Note right of K: { status: 'cooking' }
    
    S->>DB: UPDATE kitchen_queue SET status='cooking', started_at=NOW()
    DB-->>S: Updated
    S-->>K: Status updated
    K->>K: Move card to "Cooking" column
    K->>K: Start timer
    
    S-->>POS: WS: kitchen:order:update
    POS->>POS: Update order status indicator
    
    Note over Chef: Prepares food
    
    Chef->>K: Tap "Ready" button
    K->>S: PUT /api/kitchen/queue/{id}/status
    Note right of K: { status: 'ready' }
    
    S->>DB: UPDATE kitchen_queue SET status='ready', completed_at=NOW()
    S->>DB: UPDATE order_lines SET kitchen_status='ready'
    DB-->>S: Updated
    S-->>K: Status updated
    K->>K: Move card to "Ready" column
    
    S-->>POS: WS: kitchen:order:update
    POS->>POS: Highlight "Ready for pickup"
    POS->>POS: Play notification sound
    
    Note over Chef: Waiter picks up food
    
    Chef->>K: Tap "Served" button
    K->>S: PUT /api/kitchen/queue/{id}/status
    Note right of K: { status: 'served' }
    
    S->>DB: UPDATE kitchen_queue SET status='served', served_at=NOW()
    S->>DB: UPDATE order_lines SET kitchen_status='served'
    DB-->>S: Updated
    S-->>K: Remove from active queue
```

### Kitchen Display States

```
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│ PENDING   │   │ COOKING   │   │  READY    │   │  SERVED   │
├───────────┤   ├───────────┤   ├───────────┤   ├───────────┤
│ ┌───────┐ │   │ ┌───────┐ │   │ ┌───────┐ │   │           │
│ │ORD-001│ │   │ │ORD-003│ │   │ │ORD-005│ │   │  (Empty)  │
│ │Table 5│ │   │ │Table 2│ │   │ │Table 8│ │   │           │
│ │10:35  │ │   │ │⏱ 8min │ │   │ │✓ Ready│ │   │           │
│ │       │ │   │ │       │ │   │ │       │ │   │           │
│ │[START]│ │   │ │[READY]│ │   │ │[SERVE]│ │   │           │
│ └───────┘ │   │ └───────┘ │   │ └───────┘ │   │           │
└───────────┘   └───────────┘   └───────────┘   └───────────┘
      │               │               │               │
      └───────────────┴───────────────┴───────────────┘
                Drag/Tap to move →
```

---

## 4. Payment Flow (Cash)

### Sequence Diagram

```mermaid
sequenceDiagram
    participant W as Waiter (POS)
    participant S as Server
    participant DB as Database
    participant P as Receipt Printer
    
    W->>S: GET /api/orders/{id}
    S->>DB: SELECT order with lines
    DB-->>S: Order data
    S-->>W: Display order summary
    
    W->>W: Tap "Pay Now"
    W->>W: Select "Cash"
    W->>W: Enter tender amount (e.g., $50)
    W->>W: Calculate change ($50 - $37.77 = $12.23)
    W->>W: Confirm payment
    
    W->>S: POST /api/payments
    Note right of W: {<br/>order_id: 1,<br/>method_id: 1 (cash),<br/>amount: 37.77<br/>}
    
    S->>DB: BEGIN TRANSACTION
    S->>DB: INSERT INTO payments (generate payment_number)
    S->>DB: UPDATE order SET status='paid', paid_at=NOW()
    
    Note over S,DB: Trigger: deduct_inventory_on_payment
    
    loop For each order_line
        S->>DB: SELECT bom WHERE menu_item_id = ?
        loop For each BOM ingredient
            S->>DB: UPDATE inventory_items SET qty = qty - required_qty
            S->>DB: INSERT INTO stock_movements (type='out')
        end
    end
    
    S->>DB: COMMIT TRANSACTION
    
    DB-->>S: Payment successful
    S-->>W: Payment confirmed
    
    S->>P: Print receipt
    P-->>W: Receipt printed
    
    W->>W: Display change: $12.23
    W->>W: Show success message
    
    W->>S: POST /api/tables/{table_id}/free
    S->>DB: UPDATE table SET status='needs_cleaning'
    S-->>W: Table freed
```

---

## 5. Payment Flow (Card Terminal)

### Sequence Diagram

```mermaid
sequenceDiagram
    participant W as Waiter (POS)
    participant S as Server
    participant DB as Database
    participant T as Card Terminal
    participant PG as Payment Gateway
    participant P as Printer
    
    W->>W: Select "Card" payment
    W->>S: POST /api/payments (initiate)
    Note right of W: { order_id, method_id, amount }
    
    S->>DB: INSERT INTO payments (status='pending')
    DB-->>S: Payment record created
    
    S->>T: Send payment request
    T->>T: Prompt customer to insert/tap card
    T->>PG: Process transaction
    
    alt Transaction Approved
        PG-->>T: Approved (txn_id: ABC123)
        T-->>S: Payment successful
        S->>DB: UPDATE payment SET status='success', txn_id='ABC123'
        S->>DB: UPDATE order SET status='paid'
        S->>DB: Deduct inventory (trigger)
        S-->>W: Payment confirmed
        S->>P: Print receipt
        W->>W: Show success
    else Transaction Declined
        PG-->>T: Declined (reason: insufficient funds)
        T-->>S: Payment failed
        S->>DB: UPDATE payment SET status='failed'
        S-->>W: Payment failed
        W->>W: Show error & offer retry or other method
    end
```

---

## 6. Split Bill Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant W as Waiter (POS)
    participant S as Server
    participant DB as Database
    
    W->>S: GET /api/orders/{id}
    S->>DB: SELECT order with lines
    DB-->>S: Order data
    S-->>W: Display order
    
    W->>W: Tap "Split Bill"
    W->>W: Choose split type: "By Item" or "By Amount"
    
    alt Split by Item
        W->>W: Select items for Split 1
        W->>W: Select items for Split 2
        W->>W: Confirm split
        
        W->>S: POST /api/orders/{id}/split
        Note right of W: {<br/>split_type: 'by_item',<br/>splits: [<br/>  {split_number: 1, line_ids: [1,2]},<br/>  {split_number: 2, line_ids: [3]}<br/>]<br/>}
        
        S->>DB: BEGIN TRANSACTION
        loop For each split
            S->>DB: INSERT INTO order_splits
            S->>DB: Calculate split amount
        end
        S->>DB: COMMIT
        DB-->>S: Splits created
        S-->>W: Split details
        
        W->>W: Display split summary
        
        loop For each split
            W->>W: Process payment for split
            W->>S: POST /api/payments (split_id)
            S->>DB: INSERT payment
            S->>DB: UPDATE order_splits SET paid=true
        end
        
        S->>DB: Check if all splits paid
        alt All splits paid
            S->>DB: UPDATE order SET status='paid'
            S->>DB: Deduct inventory
        end
        
    else Split by Amount (Equal/Percentage)
        W->>W: Enter number of splits (e.g., 2)
        W->>W: System calculates: $37.77 / 2 = $18.89 each
        W->>W: Confirm split
        
        loop For each person
            W->>W: Process individual payment
            W->>S: POST /api/payments (amount: 18.89)
        end
    end
```

---

## 7. Offline Mode & Sync Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant POS as POS (Offline)
    participant Local as Local Storage
    participant Net as Network
    participant S as Server
    participant DB as Database
    
    Note over POS: Network disconnected
    POS->>POS: Detect offline (NetInfo)
    POS->>POS: Show offline banner
    
    POS->>POS: Waiter creates order
    POS->>Local: Save order (local_id: 'local-001')
    POS->>Local: Add to sync_queue
    Local-->>POS: Saved locally
    
    POS->>POS: Add order lines
    POS->>Local: Update local order
    POS->>Local: Update sync_queue
    
    POS->>POS: Attempt send to kitchen
    POS->>Local: Mark order as "pending_sync"
    
    Note over POS: Network reconnected
    POS->>Net: Detect online
    POS->>POS: Show "Syncing..." message
    
    POS->>S: POST /api/sync/orders
    Note right of POS: {<br/>orders: [<br/>  {<br/>    local_order_id: 'local-001',<br/>    idempotency_key: 'device-001-1637426400',<br/>    data: { ... }<br/>  }<br/>]<br/>}
    
    S->>S: Validate idempotency_key
    
    alt Order already synced
        S-->>POS: Already synced (skip)
    else New order
        S->>DB: BEGIN TRANSACTION
        S->>DB: Check table availability
        
        alt Table conflict (occupied by another order)
            S->>DB: ROLLBACK
            S-->>POS: Conflict: table already occupied
            POS->>POS: Show conflict resolution UI
            POS->>POS: Operator reassigns table
            POS->>S: POST /api/sync/resolve-conflict
        else No conflict
            S->>DB: INSERT INTO orders
            S->>DB: INSERT INTO order_lines
            S->>DB: COMMIT
            DB-->>S: Order created (server_id: 123)
            S-->>POS: Synced (local: 'local-001' → server: 123)
            
            POS->>Local: Update order with server_id
            POS->>Local: Remove from sync_queue
            POS->>POS: Show "Sync complete"
        end
    end
```

### Conflict Resolution UI

```
┌─────────────────────────────────────┐
│  ⚠️ Sync Conflict Detected          │
├─────────────────────────────────────┤
│  Order: local-001                   │
│  Issue: Table 5 is already occupied │
│         by Order #ORD-2025-050      │
│                                     │
│  Options:                           │
│  ○ Reassign to another table        │
│  ○ Merge with existing order        │
│  ○ Cancel this order                │
│                                     │
│  [Resolve] [Skip]                   │
└─────────────────────────────────────┘
```

---

## 8. Inventory Deduction Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant POS as POS
    participant S as Server
    participant DB as Database (PostgreSQL)
    
    POS->>S: POST /api/payments (order paid)
    S->>DB: BEGIN TRANSACTION
    
    S->>DB: INSERT INTO payments
    S->>DB: UPDATE order SET status='paid'
    
    Note over DB: Trigger: deduct_inventory_on_payment
    
    DB->>DB: SELECT order_lines WHERE order_id = ?
    
    loop For each order_line
        DB->>DB: SELECT bom WHERE menu_item_id = line.menu_item_id
        
        loop For each bom_item
            DB->>DB: Calculate qty_to_deduct = bom.qty_required * line.quantity
            
            DB->>DB: SELECT * FROM inventory_items<br/>WHERE id = bom.inventory_item_id<br/>FOR UPDATE (row lock)
            
            alt Sufficient stock
                DB->>DB: UPDATE inventory_items<br/>SET qty = qty - qty_to_deduct
                DB->>DB: INSERT INTO stock_movements<br/>(type='out', reference='payment')
            else Insufficient stock
                DB->>DB: ROLLBACK TRANSACTION
                DB-->>S: Error: Insufficient stock for "Lettuce"
                S-->>POS: Payment failed: low stock
                POS->>POS: Show error + suggest alternative
            end
        end
    end
    
    Note over DB: Trigger: check_low_stock
    DB->>DB: IF qty <= min_qty THEN
    DB->>DB: INSERT INTO stock_alerts<br/>(alert_type='low', status='open')
    
    DB->>DB: COMMIT TRANSACTION
    DB-->>S: Payment & inventory updated
    S-->>POS: Payment successful
```

---

## 9. Menu Update Propagation

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Admin as Admin Dashboard
    participant S as Server
    participant DB as Database
    participant Cache as Redis Cache
    participant POS as POS Clients (multiple)
    participant Kiosk as Kiosk Clients
    
    Admin->>S: PUT /api/menu/items/{id}
    Note right of Admin: Update price: $12.99 → $14.99
    
    S->>DB: BEGIN TRANSACTION
    S->>DB: UPDATE menu_items SET base_price=14.99, updated_at=NOW()
    S->>DB: INSERT INTO menu_versions<br/>(version++, changes)
    S->>DB: COMMIT
    
    DB-->>S: Updated
    
    S->>Cache: DEL menu:*
    S->>Cache: SET menu:version = {new_version}
    
    S-->>Admin: Success
    
    S-->>POS: WS: menu:updated<br/>{ version, item_id, changes }
    S-->>Kiosk: WS: menu:updated
    
    POS->>S: GET /api/menu (refresh)
    S->>Cache: GET menu:full
    
    alt Cache miss
        S->>DB: SELECT menu with items
        DB-->>S: Menu data
        S->>Cache: SET menu:full (TTL: 1 hour)
    else Cache hit
        Cache-->>S: Menu data
    end
    
    S-->>POS: Updated menu
    POS->>POS: Refresh menu UI
    
    Note over POS: Active orders keep old price (snapshot)
    Note over POS: New orders use new price
```

---

## 10. Shift Management Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant E as Employee
    participant POS as POS
    participant S as Server
    participant DB as Database
    
    Note over E: Start of shift
    E->>POS: Login with PIN
    POS->>S: POST /api/auth/login
    S->>DB: Verify credentials
    DB-->>S: User authenticated
    S-->>POS: JWT token
    
    POS->>POS: Show "Start Shift" screen
    E->>POS: Enter cash_start amount ($200)
    POS->>S: POST /api/shifts/start
    S->>DB: INSERT INTO shifts<br/>(employee_id, start_time, cash_start, status='open')
    DB-->>S: Shift created
    S-->>POS: Shift started
    
    Note over E: Work during shift
    
    loop Process orders
        E->>POS: Create order
        E->>POS: Process payment
        Note over POS,DB: All actions logged with employee_id
    end
    
    Note over E: End of shift
    E->>POS: Tap "End Shift"
    POS->>S: GET /api/shifts/{shift_id}
    S->>DB: SELECT shift with summary<br/>(total_sales, total_orders, etc.)
    DB-->>S: Shift data
    S-->>POS: Shift summary
    
    POS->>POS: Display summary & ask for cash_end
    E->>POS: Enter cash_end amount ($1,500)
    E->>POS: Enter notes (optional)
    E->>POS: Confirm end shift
    
    POS->>S: POST /api/shifts/end
    S->>DB: UPDATE shifts<br/>SET end_time=NOW(), cash_end=1500, status='closed'
    S->>DB: Calculate expected_cash vs actual_cash
    
    alt Cash discrepancy
        S->>DB: INSERT INTO audit_logs<br/>(note: 'Cash variance: $X')
        S-->>POS: Warning: Cash variance detected
        POS->>POS: Show variance & require manager approval
    else Cash matches
        S-->>POS: Shift ended successfully
    end
    
    POS->>POS: Auto logout
```

---

## 11. Error Handling & Recovery Flows

### Payment Failure Recovery

```
┌─────────────────┐
│ Process Payment │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Call   │
    │ Gateway│
    └───┬────┘
        │
        ├─Success──► [Mark Paid] ──► [Print Receipt]
        │
        │ Failure
        ▼
┌──────────────────┐
│ Determine Reason │
└────────┬─────────┘
         │
         ├─Card Declined──► [Offer Retry / Other Method]
         │
         ├─Network Error──┐
         │                │
         ├─Timeout────────┤
         │                ▼
         │         ┌──────────────┐
         │         │ Save to      │
         │         │ Retry Queue  │
         │         └──────┬───────┘
         │                │
         │                ▼
         │         [Background Retry]
         │                │
         │                ├─Success──► [Update Payment]
         │                │
         │                └─Fail after N retries──► [Manual Intervention]
         │
         └─Gateway Error──► [Log Error] ──► [Contact Support]
```

### Kitchen Printer Offline

```
┌─────────────────┐
│ Send to Kitchen │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Print  │
    │ Ticket │
    └───┬────┘
        │
        ├─Success──► [Done]
        │
        │ Printer Offline
        ▼
┌──────────────────┐
│ Save to Print    │
│ Queue            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Notify Manager:  │
│ "Printer offline"│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Display on       │
│ Kitchen Screen   │
│ (fallback)       │
└────────┬─────────┘
         │
         ▼
    ┌────────┐
    │ Retry  │◄─────┐
    │ Print  │      │
    └───┬────┘      │
        │           │
        ├─Success───┴──► [Done]
        │
        └─Still Offline──► [Continue with screen only]
```

---

## 12. Data Flow Overview

```
┌─────────────┐
│             │
│  POS Tablet │────────┐
│             │        │
└─────────────┘        │
                       │
┌─────────────┐        │     ┌──────────────┐
│             │        │     │              │
│ QR Ordering │────────┼────►│   Backend    │◄────┐
│             │        │     │   (Node.js)  │     │
└─────────────┘        │     │              │     │
                       │     └──────┬───────┘     │
┌─────────────┐        │            │             │
│             │        │            │             │
│   Kiosk     │────────┘            ▼             │
│             │              ┌──────────────┐     │
└─────────────┘              │              │     │
                             │  PostgreSQL  │     │
┌─────────────┐              │   Database   │     │
│             │              │              │     │
│   Kitchen   │◄─────────────┤              │     │
│   Display   │              └──────────────┘     │
│             │                                   │
└─────────────┘              ┌──────────────┐     │
                             │              │     │
┌─────────────┐              │    Redis     │─────┘
│             │              │   (Cache &   │
│   Admin     │◄─────────────┤   PubSub)    │
│  Dashboard  │              │              │
│             │              └──────────────┘
└─────────────┘

     │                          ▲
     │                          │
     │        WebSocket         │
     │      (Realtime Events)   │
     └──────────────────────────┘
```

---

## 13. State Transitions

### Order Status

```
┌────────┐
│  open  │
└───┬────┘
    │
    ▼
┌──────────────────┐
│ sent_to_kitchen  │
└───┬──────────────┘
    │
    ▼
┌────────┐
│ ready  │
└───┬────┘
    │
    ▼
┌────────┐     ┌───────────┐
│  paid  │────►│ completed │
└───┬────┘     └───────────┘
    │
    ▼
┌───────────┐
│ cancelled │
└───────────┘
```

### Table Status

```
┌───────────┐
│ available │
└─────┬─────┘
      │
      ▼
┌──────────┐     ┌──────────┐
│ reserved │────►│ occupied │
└──────────┘     └────┬─────┘
                      │
                      ▼
               ┌────────────────┐
               │ needs_cleaning │
               └────────┬───────┘
                        │
                        └──────►[available]
```

### Kitchen Item Status

```
┌─────────┐
│ pending │
└────┬────┘
     │
     ▼
┌─────────┐
│ cooking │
└────┬────┘
     │
     ▼
┌─────────┐
│  ready  │
└────┬────┘
     │
     ▼
┌─────────┐
│ served  │
└─────────┘

     │
     └──► [cancelled] (any stage)
```

---

## 📝 Notes

- All timestamps use UTC and are converted to local time in frontend
- All monetary amounts stored with 2 decimal precision
- Idempotency keys format: `{device_id}-{timestamp}` for offline sync
- WebSocket reconnection: exponential backoff (1s, 2s, 4s, ..., max 30s)
- Audit logs are immutable and include IP address, user agent

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-20
