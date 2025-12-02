# Frontend Architecture - React Native

## 📱 Overview

### Technology Stack

- **Framework**: React Native (with Expo for rapid development)
- **State Management**: Redux Toolkit + RTK Query
- **Navigation**: React Navigation v6
- **UI Library**: React Native Paper / NativeBase
- **Offline Support**: Redux Persist + AsyncStorage
- **Realtime**: Socket.io-client
- **HTTP Client**: Axios / RTK Query
- **Forms**: React Hook Form + Yup validation
- **QR Code**: react-native-qrcode-svg (generate), expo-barcode-scanner (scan)
- **Printing**: react-native-thermal-printer
- **Icons**: React Native Vector Icons

### App Variants

The frontend consists of multiple apps for different use cases:

1. **POS Tablet App** - For waiters/cashiers (main POS interface)
2. **Kitchen Display System (KDS)** - For chefs (kitchen queue management)
3. **Admin Dashboard** - For managers (configuration, reports)
4. **QR Table Ordering** - For customers (mobile web/PWA)
5. **Kiosk App** - For customers (self-service)

---

## 📂 Project Structure

```
frontend/
├── apps/
│   ├── pos/                    # POS Tablet App
│   ├── kitchen/                # Kitchen Display System
│   ├── admin/                  # Admin Dashboard
│   ├── qr-ordering/            # QR Table Ordering (PWA)
│   └── kiosk/                  # Self-Service Kiosk
├── packages/
│   ├── common/                 # Shared components & utilities
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── theme/
│   │   └── constants/
│   ├── api/                    # API client & RTK Query
│   │   ├── services/
│   │   └── hooks/
│   └── state/                  # Redux store & slices
│       ├── slices/
│       └── store.js
└── package.json
```

### POS App Structure (apps/pos/)

```
apps/pos/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── FloorPlanScreen.js
│   │   ├── OrderScreen.js
│   │   ├── PaymentScreen.js
│   │   ├── ShiftScreen.js
│   │   └── SettingsScreen.js
│   ├── components/
│   │   ├── FloorPlan/
│   │   │   ├── TableGrid.js
│   │   │   └── TableCard.js
│   │   ├── Order/
│   │   │   ├── MenuGrid.js
│   │   │   ├── MenuItem.js
│   │   │   ├── OrderList.js
│   │   │   ├── ModifierModal.js
│   │   │   └── OrderSummary.js
│   │   ├── Payment/
│   │   │   ├── PaymentMethods.js
│   │   │   ├── SplitBillModal.js
│   │   │   └── ReceiptPreview.js
│   │   └── Common/
│   │       ├── Header.js
│   │       ├── Button.js
│   │       ├── Card.js
│   │       └── LoadingSpinner.js
│   ├── navigation/
│   │   ├── AppNavigator.js
│   │   ├── AuthNavigator.js
│   │   └── TabNavigator.js
│   ├── store/
│   │   ├── slices/
│   │   │   ├── authSlice.js
│   │   │   ├── orderSlice.js
│   │   │   ├── tableSlice.js
│   │   │   ├── menuSlice.js
│   │   │   └── offlineSlice.js
│   │   └── index.js
│   ├── services/
│   │   ├── api.js
│   │   ├── socket.js
│   │   ├── printer.js
│   │   └── storage.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── constants.js
│   ├── hooks/
│   │   ├── useOrder.js
│   │   ├── useOfflineSync.js
│   │   └── useSocket.js
│   ├── theme/
│   │   ├── colors.js
│   │   ├── fonts.js
│   │   └── spacing.js
│   ├── App.js
│   └── index.js
├── app.json
├── babel.config.js
└── package.json
```

---

## 🎨 Screen Designs & Flows

### 1. POS Tablet App

#### Login Screen
- PIN pad or username/password
- Shift selection
- Offline indicator

#### Floor Plan Screen
- Visual grid of tables
- Color-coded status (available/occupied/reserved/needs cleaning)
- Table details on tap
- Quick filters (floor, status)
- Floating action button: Add walk-in order

#### Order Screen (Main Interface)
```
┌─────────────────────────────────────────────────────────┐
│  Table 5 | John Doe | Order #ORD-2025-001  [≡] [⚙]  │
├──────────────────┬──────────────────────────────────────┤
│                  │  ORDER SUMMARY                       │
│  MENU ITEMS      │  ┌────────────────────────────────┐ │
│                  │  │ Beef Burger x2      $25.98     │ │
│  [All Items ▼]   │  │  + Extra Cheese                │ │
│                  │  │  Note: No onions               │ │
│  ┌──────┬──────┐ │  │                                │ │
│  │Spring│Beef  │ │  │ Caesar Salad x1     $8.99      │ │
│  │Rolls │Burger│ │  ├────────────────────────────────┤ │
│  │$5.99 │$12.99│ │  │ Subtotal:          $34.97      │ │
│  └──────┴──────┘ │  │ Tax (8%):           $2.80      │ │
│  ┌──────┬──────┐ │  │ Discount:           $0.00      │ │
│  │Caesar│Pasta │ │  │ TOTAL:             $37.77      │ │
│  │Salad │Carbo │ │  └────────────────────────────────┘ │
│  │$8.99 │$14.99│ │                                     │
│  └──────┴──────┘ │  [Send to Kitchen] [Hold] [Cancel] │
│                  │                                     │
│  [< Back]        │  [Split Bill] [Pay Now]            │
└──────────────────┴──────────────────────────────────────┘
```

**Features**:
- Left: Menu grid with categories
- Right: Order summary with line items
- Quick actions: Add/edit/remove items
- Modifiers modal on item tap
- Realtime kitchen status indicators
- Offline mode banner

#### Payment Screen
- Order summary (read-only)
- Payment method buttons (Cash, Card, QR, etc.)
- Cash: Tender amount input → Calculate change
- Card: Terminal integration
- Split bill options
- Print receipt button

#### Shift Management Screen
- Start/end shift
- Cash drawer open/close
- Shift summary (total sales, orders, etc.)

---

### 2. Kitchen Display System (KDS)

#### Kitchen Queue Screen
```
┌────────────────────────────────────────────────────────┐
│  KITCHEN QUEUE - Main Kitchen            🔔 3 New     │
├──────────────┬──────────────┬──────────────┬──────────┤
│  PENDING (5) │ COOKING (3)  │  READY (2)   │  SERVED  │
├──────────────┼──────────────┼──────────────┼──────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │          │
│ │ ORD-001  │ │ │ ORD-003  │ │ │ ORD-005  │ │          │
│ │ Table 5  │ │ │ Table 2  │ │ │ Table 8  │ │          │
│ │ 10:35 AM │ │ │ 10:40 AM │ │ │ 10:45 AM │ │          │
│ │          │ │ │ [Timer]  │ │ │ ✓ Ready  │ │          │
│ │ • Burger │ │ │ • Pasta  │ │ │ • Salad  │ │          │
│ │   x2     │ │ │   x1     │ │ │   x1     │ │          │
│ │ • Salad  │ │ │ Note:    │ │ │          │ │          │
│ │   x1     │ │ │ No garlic│ │ │ [Serve]  │ │          │
│ │          │ │ │          │ │ │          │ │          │
│ │ [START]  │ │ │ [READY]  │ │ └──────────┘ │          │
│ └──────────┘ │ └──────────┘ │              │          │
└──────────────┴──────────────┴──────────────┴──────────┘
```

**Features**:
- Kanban-style columns (Pending → Cooking → Ready → Served)
- Order cards with items, quantity, notes, table
- Tap card to view details
- Drag or button to move between statuses
- Sound/visual alerts for new orders
- Timer for cooking items
- Filter by area (if multi-area kitchen)

---

### 3. QR Table Ordering (Mobile Web/PWA)

#### Landing Screen (after QR scan)
```
┌────────────────────────────┐
│  🍽️ Welcome to             │
│     ABC Restaurant         │
│                            │
│  You're at Table 5         │
│                            │
│  [View Menu]               │
│  [Call Waiter]             │
└────────────────────────────┘
```

#### Menu Screen
```
┌────────────────────────────┐
│ ← Table 5      🛒 (2)      │
├────────────────────────────┤
│ [Appetizers] [Mains] [...] │
├────────────────────────────┤
│ ┌────────────────────────┐ │
│ │ 🖼️ Spring Rolls         │ │
│ │    Fresh spring rolls  │ │
│ │    $5.99          [+]  │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ 🖼️ Beef Burger          │ │
│ │    Juicy beef burger   │ │
│ │    $12.99         [+]  │ │
│ └────────────────────────┘ │
│                            │
│ [View Cart]                │
└────────────────────────────┘
```

#### Cart/Checkout Screen
```
┌────────────────────────────┐
│ ← Your Order               │
├────────────────────────────┤
│ Spring Rolls x1     $5.99  │
│ [−] [1] [+]                │
│                            │
│ Beef Burger x2     $25.98  │
│ [−] [2] [+]                │
│  + Extra Cheese            │
│  Note: No onions           │
├────────────────────────────┤
│ Total:            $31.97   │
│                            │
│ [Send Order to Kitchen]    │
│                            │
│ Orders will be confirmed   │
│ by our staff               │
└────────────────────────────┘
```

**Features**:
- Responsive mobile design
- Item images and descriptions
- Quantity selector
- Modifier selection
- Add note to items
- Real-time cart updates
- Order confirmation message
- Track order status (optional)

---

### 4. Kiosk App (Self-Service)

Similar to QR ordering but:
- Full-screen tablet interface
- Larger touch targets
- Auto-idle timeout → return to home
- Integrated payment terminal
- Print receipt on completion

---

### 5. Admin Dashboard

#### Dashboard Home
- Sales summary cards (today, week, month)
- Charts (sales trend, top items)
- Quick actions (add menu item, view reports)
- Alerts (low stock, pending approvals)

#### Menu Management
- List of menu items with search/filter
- Add/edit/delete items
- Category management
- Modifier management
- Bulk import/export

#### Reports
- Date range selector
- Report type selector (sales, inventory, employee)
- Filters (product, employee, table, etc.)
- Charts and tables
- Export to CSV/PDF

#### Floor Plan Editor
- Drag-and-drop table placement
- Add/remove/resize tables
- Save floor layouts

---

## 🔄 State Management (Redux)

### Store Structure

```javascript
// packages/state/store.js
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/services';

import authReducer from './slices/authSlice';
import orderReducer from './slices/orderSlice';
import tableReducer from './slices/tableSlice';
import menuReducer from './slices/menuSlice';
import offlineReducer from './slices/offlineSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'offline'] // Only persist these
};

const rootReducer = {
  auth: persistReducer(persistConfig, authReducer),
  order: orderReducer,
  table: tableReducer,
  menu: menuReducer,
  offline: offlineReducer,
  [api.reducerPath]: api.reducer
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }).concat(api.middleware)
});

export const persistor = persistStore(store);
```

### Auth Slice

```javascript
// packages/state/slices/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    currentShift: null
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.currentShift = null;
    },
    setCurrentShift: (state, action) => {
      state.currentShift = action.payload;
    }
  }
});

export const { loginSuccess, logout, setCurrentShift } = authSlice.actions;
export default authSlice.reducer;
```

### Order Slice (with Offline Support)

```javascript
// packages/state/slices/orderSlice.js
import { createSlice } from '@reduxjs/toolkit';

const orderSlice = createSlice({
  name: 'order',
  initialState: {
    currentOrder: null,
    activeOrders: [],
    orderHistory: []
  },
  reducers: {
    createOrder: (state, action) => {
      const order = {
        local_id: `local-${Date.now()}`,
        ...action.payload,
        lines: [],
        status: 'open',
        synced: false
      };
      state.currentOrder = order;
      state.activeOrders.push(order);
    },
    addOrderLine: (state, action) => {
      if (state.currentOrder) {
        state.currentOrder.lines.push(action.payload);
        state.currentOrder.synced = false;
      }
    },
    updateOrderLine: (state, action) => {
      const { lineId, updates } = action.payload;
      const line = state.currentOrder?.lines.find(l => l.id === lineId);
      if (line) {
        Object.assign(line, updates);
        state.currentOrder.synced = false;
      }
    },
    removeOrderLine: (state, action) => {
      if (state.currentOrder) {
        state.currentOrder.lines = state.currentOrder.lines.filter(
          l => l.id !== action.payload
        );
        state.currentOrder.synced = false;
      }
    },
    markOrderSynced: (state, action) => {
      const { localId, serverId } = action.payload;
      const order = state.activeOrders.find(o => o.local_id === localId);
      if (order) {
        order.id = serverId;
        order.synced = true;
      }
    },
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
    }
  }
});

export const {
  createOrder,
  addOrderLine,
  updateOrderLine,
  removeOrderLine,
  markOrderSynced,
  clearCurrentOrder
} = orderSlice.actions;

export default orderSlice.reducer;
```

### Offline Slice

```javascript
// packages/state/slices/offlineSlice.js
import { createSlice } from '@reduxjs/toolkit';

const offlineSlice = createSlice({
  name: 'offline',
  initialState: {
    isOnline: true,
    syncQueue: [],
    lastSyncTime: null
  },
  reducers: {
    setOnlineStatus: (state, action) => {
      state.isOnline = action.payload;
    },
    addToSyncQueue: (state, action) => {
      state.syncQueue.push({
        id: Date.now(),
        ...action.payload,
        timestamp: new Date().toISOString()
      });
    },
    removeFromSyncQueue: (state, action) => {
      state.syncQueue = state.syncQueue.filter(
        item => item.id !== action.payload
      );
    },
    clearSyncQueue: (state) => {
      state.syncQueue = [];
    },
    setLastSyncTime: (state) => {
      state.lastSyncTime = new Date().toISOString();
    }
  }
});

export const {
  setOnlineStatus,
  addToSyncQueue,
  removeFromSyncQueue,
  clearSyncQueue,
  setLastSyncTime
} = offlineSlice.actions;

export default offlineSlice.reducer;
```

---

## 🌐 API Integration (RTK Query)

```javascript
// packages/api/services.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    }
  }),
  tagTypes: ['Orders', 'Menu', 'Tables', 'Kitchen'],
  endpoints: (builder) => ({
    // Auth
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials
      })
    }),
    
    // Menu
    getMenu: builder.query({
      query: () => '/menu',
      providesTags: ['Menu']
    }),
    
    // Orders
    getOrders: builder.query({
      query: (params) => ({
        url: '/orders',
        params
      }),
      providesTags: ['Orders']
    }),
    
    createOrder: builder.mutation({
      query: (order) => ({
        url: '/orders',
        method: 'POST',
        body: order
      }),
      invalidatesTags: ['Orders', 'Tables']
    }),
    
    addOrderLines: builder.mutation({
      query: ({ orderId, items }) => ({
        url: `/orders/${orderId}/lines`,
        method: 'POST',
        body: { items }
      }),
      invalidatesTags: ['Orders']
    }),
    
    sendToKitchen: builder.mutation({
      query: (orderId) => ({
        url: `/orders/${orderId}/send-to-kitchen`,
        method: 'POST'
      }),
      invalidatesTags: ['Orders', 'Kitchen']
    }),
    
    // Tables
    getTables: builder.query({
      query: () => '/floors',
      providesTags: ['Tables']
    }),
    
    occupyTable: builder.mutation({
      query: ({ tableId, employeeId }) => ({
        url: `/tables/${tableId}/occupy`,
        method: 'POST',
        body: { employee_id: employeeId }
      }),
      invalidatesTags: ['Tables']
    }),
    
    // Kitchen
    getKitchenQueue: builder.query({
      query: (params) => ({
        url: '/kitchen/queue',
        params
      }),
      providesTags: ['Kitchen']
    }),
    
    updateKitchenStatus: builder.mutation({
      query: ({ queueId, status }) => ({
        url: `/kitchen/queue/${queueId}/status`,
        method: 'PUT',
        body: { status }
      }),
      invalidatesTags: ['Kitchen', 'Orders']
    }),
    
    // Payments
    processPayment: builder.mutation({
      query: (payment) => ({
        url: '/payments',
        method: 'POST',
        body: payment
      }),
      invalidatesTags: ['Orders', 'Tables']
    })
  })
});

export const {
  useLoginMutation,
  useGetMenuQuery,
  useGetOrdersQuery,
  useCreateOrderMutation,
  useAddOrderLinesMutation,
  useSendToKitchenMutation,
  useGetTablesQuery,
  useOccupyTableMutation,
  useGetKitchenQueueQuery,
  useUpdateKitchenStatusMutation,
  useProcessPaymentMutation
} = api;
```

---

## 🔌 WebSocket Integration

```javascript
// packages/api/socket.js
import io from 'socket.io-client';
import { store } from '../state/store';
import { api } from './services';

let socket = null;

export const connectSocket = (token) => {
  socket = io(process.env.API_BASE_URL, {
    auth: { token: `Bearer ${token}` }
  });
  
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  // Order events
  socket.on('order:created', (data) => {
    store.dispatch(api.util.invalidateTags(['Orders']));
  });
  
  socket.on('order:updated', (data) => {
    store.dispatch(api.util.invalidateTags(['Orders']));
  });
  
  socket.on('order:status_changed', (data) => {
    store.dispatch(api.util.invalidateTags(['Orders']));
  });
  
  // Kitchen events
  socket.on('kitchen:order:new', (data) => {
    store.dispatch(api.util.invalidateTags(['Kitchen']));
    // Play sound alert
    playNotificationSound();
  });
  
  socket.on('kitchen:order:update', (data) => {
    store.dispatch(api.util.invalidateTags(['Kitchen', 'Orders']));
  });
  
  // Table events
  socket.on('table:status:update', (data) => {
    store.dispatch(api.util.invalidateTags(['Tables']));
  });
  
  // Menu events
  socket.on('menu:updated', (data) => {
    store.dispatch(api.util.invalidateTags(['Menu']));
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
  
  return socket;
};

export const subscribeToChannels = (channels) => {
  if (socket) {
    socket.emit('subscribe', { channels });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

const playNotificationSound = () => {
  // Implement sound notification
};
```

---

## 📴 Offline Support

### Offline Detection

```javascript
// hooks/useOfflineSync.js
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import NetInfo from '@react-native-community/netinfo';
import { setOnlineStatus, addToSyncQueue } from '../state/slices/offlineSlice';
import { syncOfflineData } from '../services/sync';

export const useOfflineSync = () => {
  const dispatch = useDispatch();
  const { isOnline, syncQueue } = useSelector(state => state.offline);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      dispatch(setOnlineStatus(online));
      
      if (online && syncQueue.length > 0) {
        syncOfflineData(syncQueue, dispatch);
      }
    });
    
    return () => unsubscribe();
  }, [dispatch, syncQueue]);
  
  return { isOnline };
};
```

### Sync Service

```javascript
// services/sync.js
import axios from 'axios';
import { removeFromSyncQueue, setLastSyncTime } from '../state/slices/offlineSlice';

export const syncOfflineData = async (syncQueue, dispatch) => {
  try {
    const response = await axios.post('/api/sync/orders', {
      orders: syncQueue
    });
    
    const { synced, conflicts, errors } = response.data.data;
    
    // Remove synced items from queue
    synced.forEach(item => {
      dispatch(removeFromSyncQueue(item.local_order_id));
    });
    
    // Handle conflicts
    if (conflicts.length > 0) {
      // Show conflict resolution UI
      conflicts.forEach(conflict => {
        showConflictResolutionModal(conflict);
      });
    }
    
    dispatch(setLastSyncTime());
  } catch (error) {
    console.error('Sync failed:', error);
    // Will retry on next online event
  }
};
```

---

## 🖨️ Printer Integration

```javascript
// services/printer.js
import { BluetoothEscposPrinter } from 'react-native-thermal-printer';

export class PrinterService {
  static async printReceipt(order, payment) {
    try {
      await BluetoothEscposPrinter.printerAlign(
        BluetoothEscposPrinter.ALIGN.CENTER
      );
      
      await BluetoothEscposPrinter.printText('ABC RESTAURANT\n', {
        encoding: 'GBK',
        codepage: 0,
        widthtimes: 2,
        heigthtimes: 2,
        fonttype: 1
      });
      
      await BluetoothEscposPrinter.printText('\n');
      await BluetoothEscposPrinter.printerAlign(
        BluetoothEscposPrinter.ALIGN.LEFT
      );
      
      await BluetoothEscposPrinter.printText(
        `Order: ${order.order_number}\n` +
        `Date: ${new Date().toLocaleString()}\n` +
        `Table: ${order.table?.table_number || 'N/A'}\n` +
        `Waiter: ${order.employee?.full_name}\n` +
        `\n--------------------------------\n`
      );
      
      // Print items
      for (const line of order.lines) {
        await BluetoothEscposPrinter.printText(
          `${line.menu_item_name} x${line.quantity}\n` +
          `  $${line.line_total.toFixed(2)}\n`
        );
      }
      
      await BluetoothEscposPrinter.printText(
        `--------------------------------\n` +
        `Subtotal:  $${order.subtotal.toFixed(2)}\n` +
        `Tax:       $${order.tax.toFixed(2)}\n` +
        `Discount:  $${order.discount.toFixed(2)}\n` +
        `TOTAL:     $${order.total.toFixed(2)}\n\n` +
        `Payment: ${payment.method}\n` +
        `\n\n` +
        `Thank you for dining with us!\n\n\n`
      );
      
      await BluetoothEscposPrinter.printerAlign(
        BluetoothEscposPrinter.ALIGN.CENTER
      );
      
      // Print QR code (optional)
      // await BluetoothEscposPrinter.printQRCode(
      //   order.order_number,
      //   200,
      //   BluetoothEscposPrinter.ERROR_CORRECTION.L
      // );
      
      await BluetoothEscposPrinter.printText('\n\n\n');
    } catch (error) {
      console.error('Print error:', error);
      throw error;
    }
  }
  
  static async printKitchenTicket(order, area) {
    // Similar to receipt but kitchen-focused format
    // Include: Table, Order #, Items with notes, Time
  }
}
```

---

## 🔐 Security

### Secure Storage

```javascript
// utils/secureStorage.js
import * as SecureStore from 'expo-secure-store';

export const saveToken = async (token) => {
  await SecureStore.setItemAsync('auth_token', token);
};

export const getToken = async () => {
  return await SecureStore.getItemAsync('auth_token');
};

export const deleteToken = async () => {
  await SecureStore.deleteItemAsync('auth_token');
};
```

### QR Code Generation

```javascript
// utils/qrCode.js
import QRCode from 'react-native-qrcode-svg';

export const generateTableQR = (tableId, token) => {
  const url = `${process.env.QR_ORDERING_URL}/table/${tableId}?token=${token}`;
  return <QRCode value={url} size={200} />;
};
```

---

## 🧪 Testing

### Component Test Example

```javascript
// components/__tests__/MenuItem.test.js
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MenuItem from '../MenuItem';

describe('MenuItem', () => {
  const mockItem = {
    id: 1,
    name: 'Beef Burger',
    base_price: 12.99,
    image_url: 'https://...'
  };
  
  it('renders correctly', () => {
    const { getByText } = render(<MenuItem item={mockItem} />);
    expect(getByText('Beef Burger')).toBeTruthy();
    expect(getByText('$12.99')).toBeTruthy();
  });
  
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <MenuItem item={mockItem} onPress={onPress} />
    );
    
    fireEvent.press(getByText('Beef Burger'));
    expect(onPress).toHaveBeenCalledWith(mockItem);
  });
});
```

---

## 🚀 Build & Deploy

### Build for Production

```bash
# POS App (Android tablet)
cd apps/pos
eas build --platform android --profile production

# Kiosk App (Android)
cd apps/kiosk
eas build --platform android --profile production

# QR Ordering (Web/PWA)
cd apps/qr-ordering
expo build:web
```

### Environment Configuration

```javascript
// apps/pos/.env.production
API_BASE_URL=https://api.restaurant.com
QR_ORDERING_URL=https://order.restaurant.com
PRINTER_TYPE=bluetooth
```

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-20
