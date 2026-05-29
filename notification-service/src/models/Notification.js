const mongoose = require('mongoose');

//notification schema
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['email', 'system', 'webhook', 'push', 'sms'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: Date,
  deliveryError: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: '30d' } // Auto-delete after 30 days
  }
}, {
  timestamps: true
});

//indexes for performance
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, delivered: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;