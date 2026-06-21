const rateLimit = require('express-rate-limit');

// Global rate limiter for all API endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { 
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => req.ip,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Stricter rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 failed attempts per hour
  message: { 
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour'
  },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip
});

// Rate limiter for workflow creation
const workflowLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 workflow creations per hour
  message: {
    error: 'Workflow creation limit exceeded',
    code: 'WORKFLOW_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

module.exports = { globalLimiter, authLimiter, workflowLimiter };