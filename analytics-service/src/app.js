const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { AnalyticsEvent, DailyMetrics } = require('./models/Analytics');
const MetricsAggregator = require('./aggregators/metricsAggregator');
const AnalyticsConsumer = require('./kafka/consumer');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

//MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Analytics Service , MongoDB connected'))
.catch(err => console.error('MongoDB error:', err));

//initialize services
const metricsAggregator = new MetricsAggregator();
const consumer = new AnalyticsConsumer(metricsAggregator);

//health check
app.get('/health', (req, res) => {
  res.json({
    service: 'analytics-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

//get user analytics
app.get('/api/analytics/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const analytics = await metricsAggregator.getUserAnalytics(userId, parseInt(days));
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

//get system metrics
app.get('/api/analytics/system', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const metrics = await metricsAggregator.getSystemMetrics(parseInt(days));
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

//get real time dashboard
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const [realtime, system] = await Promise.all([
      metricsAggregator.getRealtimeMetrics(),
      metricsAggregator.getSystemMetrics(1)
    ]);
    
    res.json({
      success: true,
      data: {
        realtime,
        summary: system.summary,
        performance: system.performance
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

//get workflow analytics
app.get('/api/analytics/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    
    const events = await AnalyticsEvent.find({ workflowId })
      .sort({ timestamp: 1 });
    
    const executionTime = events.find(e => e.eventType === 'WORKFLOW_COMPLETED')?.data.executionTime;
    
    res.json({
      success: true,
      data: {
        workflowId,
        events: events.length,
        executionTime: executionTime || null,
        timeline: events.map(e => ({
          type: e.eventType,
          timestamp: e.timestamp,
          data: e.data
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching workflow analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

//track custom event
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { eventType, userId, workflowId, data } = req.body;
    
    const event = {
      type: eventType,
      userId,
      workflowId,
      ...data,
      timestamp: new Date().toISOString(),
      source: 'api'
    };
    
    await metricsAggregator.processEvent(event);
    
    res.status(201).json({
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: error.message });
  }
});

//get event logs
app.get('/api/analytics/events', async (req, res) => {
  try {
    const { eventType, userId, limit = 100, offset = 0 } = req.query;
    const query = {};
    
    if (eventType) query.eventType = eventType;
    if (userId) query.userId = userId;
    
    const events = await AnalyticsEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await AnalyticsEvent.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        events,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3004;

async function start() {
  await consumer.connect();
  
  app.listen(PORT, () => {
    console.log(`Analytics Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Endpoints:`);
    console.log(`   GET    /api/analytics/users/:userId    - User analytics`);
    console.log(`   GET    /api/analytics/system           - System metrics`);
    console.log(`   GET    /api/analytics/dashboard        - Real-time dashboard`);
    console.log(`   GET    /api/analytics/workflows/:id    - Workflow analytics`);
    console.log(`   POST   /api/analytics/track            - Track custom event`);
    console.log(`   GET    /api/analytics/events           - Event logs`);
  });
}

start().catch(console.error);

module.exports = app;