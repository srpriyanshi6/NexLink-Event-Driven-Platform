const jwt = require('jsonwebtoken');

const validateJWT = async (req, res, next) => {
  // Public endpoints that don't require authentication
  const publicPaths = [
    '/health',
    '/api/auth/register', 
    '/api/auth/login',
    '/graphql'
  ];
  
  // Check if current path is public
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'No token provided',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      error: 'Invalid token format',
      code: 'INVALID_TOKEN_FORMAT'
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    return res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

module.exports = { validateJWT };