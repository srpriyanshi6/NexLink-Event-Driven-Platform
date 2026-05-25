const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const { validateJWT } = require('./middleware/auth');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);
app.use(validateJWT);

app.get('/health', (req, res) => {
  res.json({ service: 'api-gateway', status: 'healthy' });
});

const proxyConfigs = [
  { route: '/api/auth', target: process.env.USER_SERVICE_URL, pathRewrite: { '^/api/auth': '/auth' } },
  { route: '/api/users', target: process.env.USER_SERVICE_URL, pathRewrite: { '^/api/users': '/users' } },
  { route: '/api/workflows', target: process.env.WORKFLOW_SERVICE_URL },
  { route: '/api/analytics', target: process.env.ANALYTICS_SERVICE_URL },
  { route: '/graphql', target: process.env.GRAPHQL_SERVICE_URL }
];

proxyConfigs.forEach(config => {
  app.use(config.route, createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite
  }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`yay API Gateway on port ${PORT}`));