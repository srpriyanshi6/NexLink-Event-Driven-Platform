const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const typeDefs = require('./schema');
const resolvers = require('./resolvers');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

//health check
app.get('/health', (req, res) => {
  res.json({
    service: 'graphql-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

//Apollo Server setup
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers.authorization?.split(' ')[1] || '';
    let userId = null;
    let userRole = null;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      userRole = decoded.role;
    } catch (e) {
      //invalid token, proceed without user context
    }
    
    return {
      userId,
      role: userRole,
      token
    };
  },
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      code: error.extensions?.code || 'INTERNAL_ERROR',
      path: error.path
    };
  },
  playground: {
    settings: {
      'editor.theme': 'dark',
      'request.credentials': 'include'
    }
  },
  introspection: process.env.NODE_ENV !== 'production'
});

async function startServer() {
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });
  
  const PORT = process.env.PORT || 3005;
  app.listen(PORT, () => {
    console.log(`GraphQL Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`GraphQL Playground: http://localhost:${PORT}/graphql`);
    console.log(`Apollo Studio: ${server.graphqlPath}`);
  });
}

startServer().catch(console.error);

module.exports = app;