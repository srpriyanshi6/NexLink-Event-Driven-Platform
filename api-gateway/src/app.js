const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const { validateJWT } = require('./middleware/auth');
const { requestLogger, logger } = require('./middleware/logging');
const { globalLimiter, authLimiter, workflowLimiter } = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check routes (no rate limiting)
app.use(healthRoutes);

// Apply rate limiting
app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/workflows', workflowLimiter);

// JWT validation
app.use(validateJWT);

// Service proxy configurations
const proxyConfigs = [
  {
    route: '/api/auth',
    target: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    pathRewrite: { '^/api/auth': '/auth' }
  },
  {
    route: '/api/users',
    target: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    pathRewrite: { '^/api/users': '/users' }
  },
  {
    route: '/api/workflows',
    target: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:3002',
    pathRewrite: { '^/api/workflows': '/workflows' }
  },
  {
    route: '/api/notifications',
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
    pathRewrite: { '^/api/notifications': '/notifications' }
  },
  {
    route: '/api/analytics',
    target: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004',
    pathRewrite: { '^/api/analytics': '/analytics' }
  },
  {
    route: '/graphql',
    target: process.env.GRAPHQL_SERVICE_URL || 'http://localhost:3005',
    changeOrigin: true
  }
];

// Setup proxies
proxyConfigs.forEach(config => {
  logger.info(`Setting up proxy: ${config.route} -> ${config.target}`);
  
  app.use(config.route, createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    timeout: 30000,
    proxyTimeout: 30000,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${config.route}:`, err.message);
      res.status(503).json({ 
        error: 'Service unavailable',
        service: config.route,
        timestamp: new Date().toISOString()
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      // Forward authorization header
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      // Add request ID for tracing
      proxyReq.setHeader('X-Request-ID', req.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      // Forward user context if available
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add gateway info to response headers
      proxyRes.headers['X-Gateway'] = 'nexlink-api-gateway';
      proxyRes.headers['X-Request-ID'] = req.id;
    }
  }));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

//starting server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`yay API Gateway running on port ${PORT}`);
  logger.info(`Proxying to services:`);
  logger.info(`   - User Service: ${process.env.USER_SERVICE_URL}`);
  logger.info(`   - Workflow Service: ${process.env.WORKFLOW_SERVICE_URL}`);
  logger.info(`   - GraphQL: ${process.env.GRAPHQL_SERVICE_URL}/graphql`);
  logger.info(`Rate limiting: 100 requests/15min, 5 auth attempts/hour`);
});

module.exports = app;