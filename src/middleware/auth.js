/**
 * Authentication Middleware
 * JWT token verification
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token from Authorization header
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Access token required',
        code: 'NO_TOKEN'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role, employee_id }
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      }
    });
  }
};

/**
 * Check if user has required role
 * @param {string[]} allowedRoles - Array of allowed role names
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
          required_roles: allowedRoles,
          current_role: req.user.role
        }
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorize
};
