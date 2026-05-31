const mongoose = require('mongoose');

//Analytics Event Schema
 //Stores individual analytics events
const analyticsEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: ['USER_CREATED', 'USER_UPDATED', 'WORKFLOW_CREATED', 'WORKFLOW_COMPLETED', 
           'WORKFLOW_FAILED', 'WORKFLOW_TRIGGERED', 'NOTIFICATION_SENT'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

//Daily Metrics Schema
 //Stores aggregated daily metrics for fast queries
const dailyMetricsSchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true,
    index: true
  },
  metrics: {
    users: {
      total: { type: Number, default: 0 },
      new: { type: Number, default: 0 },
      active: { type: Number, default: 0 }
    },
    workflows: {
      total: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      averageExecutionTime: { type: Number, default: 0 }
    },
    notifications: {
      total: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    },
    system: {
      avgResponseTime: { type: Number, default: 0 },
      errorRate: { type: Number, default: 0 }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

//indexes
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ workflowId: 1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
const DailyMetrics = mongoose.model('DailyMetrics', dailyMetricsSchema);

module.exports = { AnalyticsEvent, DailyMetrics };