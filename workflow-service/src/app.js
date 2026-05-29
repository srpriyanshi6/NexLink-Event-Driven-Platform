const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { Kafka } = require('kafkajs');
require('dotenv').config();

const Workflow = require('./models/Workflow');
const WorkflowEngine = require('./services/workflowEngine');
const WorkflowConsumer = require('./kafka/consumer');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Workflow Service - MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// Kafka setup
const kafka = new Kafka({
  clientId: 'workflow-service',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

let producer;

async function initKafka() {
  producer = kafka.producer();
  await producer.connect();
  console.log('✅ Kafka producer connected');
}

// Initialize workflow engine
const workflowEngine = new WorkflowEngine(producer);
const workflowConsumer = new WorkflowConsumer(workflowEngine);

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'workflow-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Create workflow
app.post('/workflows', async (req, res) => {
  try {
    const { name, description, steps, priority, tags } = req.body;
    const createdBy = req.headers['x-user-id'];
    console.log('User ID:', createdBy);

    if (!createdBy) {
      return res.status(401).json({
        error: 'User not authenticated'
      });
    }
    
    const workflow = new Workflow({
      name,
      description,
      steps: steps.map((step, index) => ({
        ...step,
        order: step.order || index + 1,
        status: 'pending'
      })),
      createdBy,
      priority: priority || 'medium',
      tags: tags || [],
      status: 'active'
    });
    
    await workflow.save();
    
    // Emit workflow created event
    await producer.send({
      topic: 'workflow-events',
      messages: [{
        value: JSON.stringify({
          type: 'WORKFLOW_CREATED',
          workflowId: workflow._id,
          userId: createdBy,
          workflowName: workflow.name,
          stepCount: workflow.steps.length,
          timestamp: new Date().toISOString()
        })
      }]
    });
    
    res.status(201).json({
      success: true,
      data: { workflow }
    });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workflows
app.get('/workflows', async (req, res) => {
  try {
    const { userId, status, priority, page = 1, limit = 10 } = req.query;
    const query = {};
    
    if (userId) query.createdBy = userId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    const workflows = await Workflow.find(query)
      .sort({ createdAt: -1, priority: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Workflow.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        workflows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single workflow
app.get('/workflows/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({
      success: true,
      data: { workflow }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update workflow
app.put('/workflows/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({
      success: true,
      data: { workflow }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger workflow
app.post('/workflows/:id/trigger', async (req, res) => {
  try {
    const workflowId = req.params.id;
    const workflow = await Workflow.findById(workflowId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    if (workflow.status !== 'active') {
      return res.status(400).json({ error: 'Workflow is not active' });
    }
    
    // Emit trigger event
    await producer.send({
      topic: 'workflow-events',
      messages: [{
        value: JSON.stringify({
          type: 'WORKFLOW_TRIGGERED',
          workflowId,
          timestamp: new Date().toISOString()
        })
      }]
    });
    
    // Execute asynchronously
    workflowEngine.executeWorkflow(workflowId).catch(error => {
      console.error(`Workflow ${workflowId} execution failed:`, error);
    });
    
    res.json({
      success: true,
      message: 'Workflow triggered successfully',
      data: { workflowId }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete workflow
app.delete('/workflows/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndDelete(req.params.id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start service
const PORT = process.env.PORT || 3002;

async function start() {
  await initKafka();
  await workflowConsumer.connect();
  
  app.listen(PORT, () => {
    console.log(`🚀 Workflow Service running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 Endpoints:`);
    console.log(`   POST   /workflows              - Create workflow`);
    console.log(`   GET    /workflows              - List workflows`);
    console.log(`   GET    /workflows/:id          - Get workflow`);
    console.log(`   PUT    /workflows/:id          - Update workflow`);
    console.log(`   DELETE /workflows/:id          - Delete workflow`);
    console.log(`   POST   /workflows/:id/trigger  - Trigger workflow`);
  });
}

start().catch(console.error);

module.exports = app;