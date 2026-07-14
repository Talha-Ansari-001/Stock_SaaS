const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'saas-inventory-super-secret-key-2026';

/**
 * Authentication Middleware
 * Strictly validates Bearer JWT token, extracts bound tenant context, and attaches to request.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  // Parse Bearer token format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Authorization header format must be: Bearer <token>' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Extract tenant_id
    const tenantId = decoded.tenantId || decoded.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ error: 'Invalid token structure: missing tenant identifier' });
    }

    // Bind tenant context securely to request. Do not trust user input headers.
    req.tenant_id = tenantId;
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid, expired, or tampered token', 
      details: error.message 
    });
  }
};

module.exports = authMiddleware;
