/**
 * Restaurant POS Backend Server
 * Node.js + Express + MariaDB + Socket.io
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const { testConnection } = require('./config/database');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
const API_PREFIX = process.env.API_PREFIX || '/api';

// Import routes
app.use(`${API_PREFIX}/auth`, require('./routes/auth'));
app.use(`${API_PREFIX}/menu`, require('./routes/menu'));
app.use(`${API_PREFIX}/orders`, require('./routes/orders'));
app.use(`${API_PREFIX}/tables`, require('./routes/tables'));
app.use(`${API_PREFIX}/kitchen`, require('./routes/kitchen'));
app.use(`${API_PREFIX}/payments`, require('./routes/payments'));
app.use(`${API_PREFIX}/inventory`, require('./routes/inventory'));
app.use(`${API_PREFIX}/reports`, require('./routes/reports'));
app.use(`${API_PREFIX}/qr-ordering`, require('./routes/qr-ordering'));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Join rooms based on role/area
  socket.on('join', (data) => {
    const { role, area } = data;
    if (role) socket.join(`role:${role}`);
    if (area) socket.join(`area:${area}`);
    console.log(`Socket ${socket.id} joined: role=${role}, area=${area}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Start server
    server.listen(PORT, () => {
      console.log(' Server running on port', PORT);
      console.log(` API available at http://localhost:${PORT}${API_PREFIX}`);
      console.log(` Socket.io ready`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
