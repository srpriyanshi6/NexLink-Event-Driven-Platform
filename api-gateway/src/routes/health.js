const express = require('express');
const axios = require('axios');
const router = express.Router();

// Service health check endpoints
const services = {
  'user-service': process.env.USER_SERVICE_URL,
  'workflow-service': process.env.WORKFLOW_SERVICE_URL,
  'notification-service': process.env.NOTIFICATION_SERVICE_URL,
  'analytics-service': process.env.ANALYTICS_SERVICE_URL,
  'graphql-service': process.env.GRAPHQL_SERVICE_URL
};

// Detailed health check endpoint
router.get('/health/detailed', async (req, res) => {
  const healthStatus = {
    gateway: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    },
    services: {},
    timestamp: new Date().toISOString()
  };
  
  // Check each service health
  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      healthStatus.services[name] = {
        status: 'healthy',
        url,
        responseTime: response.data.responseTime || 'N/A'
      };
    } catch (error) {
      healthStatus.services[name] = {
        status: 'unhealthy',
        url,
        error: error.message
      };
    }
  }
  
  // Calculate overall status
  const unhealthyCount = Object.values(healthStatus.services).filter(s => s.status === 'unhealthy').length;
  healthStatus.overall = unhealthyCount === 0 ? 'healthy' : 'degraded';
  
  const statusCode = unhealthyCount === Object.keys(services).length ? 503 : 200;
  res.status(statusCode).json(healthStatus);
});

// Simple health check
router.get('/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;