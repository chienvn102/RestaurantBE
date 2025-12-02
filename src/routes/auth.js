/**
 * Authentication Routes
 * POST /api/auth/login
 * POST /api/auth/register (admin only)
 * POST /api/auth/refresh
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * User login with username/password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username and password are required',
          code: 'MISSING_CREDENTIALS'
        }
      });
    }

    // Get user from database
    const [users] = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role_id, u.status,
              r.name as role_name, r.display_name, e.id as employee_id, e.full_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.username = ? AND u.status = 'active'`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    const user = users[0];

    // Verify password
    // Support both bcrypt hash and plain text (for testing)
    let isPasswordValid = false;
    if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
      // Bcrypt hash
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Plain text (testing only)
      isPasswordValid = password === user.password_hash;
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role_name,
      role_id: user.role_id,
      employee_id: user.employee_id
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    // Log login activity
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, new_value, ip_address) VALUES (?, ?, ?, ?, ?)',
      [user.id, 'login', 'auth', JSON.stringify({ username }), req.ip]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role_name,
          full_name: user.full_name,
          employee_id: user.employee_id
        },
        token: accessToken,
        refreshToken: refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Login failed',
        code: 'LOGIN_ERROR'
      }
    });
  }
});

/**
 * POST /api/auth/register
 * Create new user account (admin only)
 */
router.post('/register', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { username, password, role_id, employee_id } = req.body;

    if (!username || !password || !role_id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username, password, and role_id are required',
          code: 'MISSING_FIELDS'
        }
      });
    }

    // Check if username already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Username already exists',
          code: 'USERNAME_EXISTS'
        }
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    // Insert new user
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
      [username, passwordHash, role_id, 'active']
    );

    // Log activity
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'create', 'user', result.insertId, JSON.stringify({ username, role_id })]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        username: username,
        message: 'User created successfully'
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Registration failed',
        code: 'REGISTER_ERROR'
      }
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Refresh token required',
          code: 'NO_REFRESH_TOKEN'
        }
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        role_id: decoded.role_id,
        employee_id: decoded.employee_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      data: {
        token: newAccessToken
      }
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      error: {
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      }
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.username, r.name as role_name, r.display_name, e.id as employee_id, e.full_name, e.phone
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get user info',
        code: 'GET_USER_ERROR'
      }
    });
  }
});

module.exports = router;
