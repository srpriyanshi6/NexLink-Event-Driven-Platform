const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const Notification = require('./models/Notification');
const NotificationConsumer = require('./kafka/consumer');
const EmailService = require('./services/emailService');

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
.then(() => console.log('Notification Service , YAY MongoDB connected'))
.catch(err => console.error('SHITT MongoDB error:', err));

//initialize services
const consumer = new NotificationConsumer();
const emailService = new EmailService();

//health check
app.get('/health', (req, res) => {
  res.json({
    service: 'notification-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

//get user notifications
app.get('/notifications', async (req, res) => {
  try {
    const { userId, read, page = 1, limit = 20 } = req.query;
    const query = { userId };
    
    if (read !== undefined) query.read = read === 'true';
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1, priority: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    
    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
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

//mark notification as read
app.put('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//mark all notifications as read
app.put('/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    
    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//send notification (for testing)
app.post('/notifications/send', async (req, res) => {
  try {
    const { userId, title, message, type, priority, email } = req.body;
    
    const notification = new Notification({
      userId,
      type: type || 'system',
      title,
      message,
      priority: priority || 'medium',
      data: { ...req.body, source: 'api' }
    });
    
    await notification.save();
    
    //send email if requested
    if (email && process.env.EMAIL_ENABLED === 'true') {
      email="sabpriyanshi0604@gmail.com"; //here email should be the recipient but i have hard coded my mail since free tier of resend only allows to send mails to registered mail id
      // the correct code for production :
      //email=to;
      await emailService.sendEmail(email, title, message);
      notification.delivered = true;
      notification.deliveredAt = new Date();
      await notification.save();
    }
    
    res.status(201).json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//delete notification
app.delete('/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3003;

async function start() {
  await consumer.connect();
  
  app.listen(PORT, () => {
    console.log(`Notification Service running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    // console.log(`Endpoints:`);
    // console.log(`   GET    /api/notifications          - Get user notifications`);
    // console.log(`   PUT    /api/notifications/:id/read - Mark as read`);
    // console.log(`   PUT    /api/notifications/read-all - Mark all as read`);
    // console.log(`   POST   /api/notifications/send     - Send notification`);
    // console.log(`   DELETE /api/notifications/:id      - Delete notification`);
  });
}

start().catch(console.error);

module.exports = app;