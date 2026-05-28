const mongoose = require('mongoose');

const workflowStepSchema = new mongoose.Schema({
  order: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['task', 'approval', 'notification', 'webhook', 'condition', 'delay', 'parallel'],
    required: true
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
    default: 'pending'
  },
  startedAt: Date,
  completedAt: Date,
  error: String,
  output: mongoose.Schema.Types.Mixed,
  retryCount: {
    type: Number,
    default: 0
  }
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workflow name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters']
  },
  description: {
    type: String,
    default: '',
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  steps: [workflowStepSchema],
  status: {
    type: String,
    enum: ['draft', 'active', 'in_progress', 'completed', 'failed', 'paused', 'cancelled'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  startedAt: Date,
  completedAt: Date,
  executionTime: Number,
  error: String,
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

workflowSchema.index({ createdBy: 1, status: 1 });
workflowSchema.index({ createdAt: -1 });
workflowSchema.index({ status: 1, priority: 1 });
workflowSchema.index({ tags: 1 });

// Virtual for step completion percentage
workflowSchema.virtual('completionPercentage').get(function() {
  if (this.steps.length === 0) return 0;
  const completed = this.steps.filter(s => s.status === 'completed').length;
  return (completed / this.steps.length) * 100;
});

const Workflow = mongoose.model('Workflow', workflowSchema);
module.exports = Workflow;