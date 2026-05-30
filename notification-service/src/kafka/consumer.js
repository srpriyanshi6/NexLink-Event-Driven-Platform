const { Kafka } = require('kafkajs');
const Notification = require('../models/Notification');
const EmailService = require('../services/emailService');

//kafka consumer for notification : listens to user and workflow events and sends appropriate notification
class NotificationConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'notification-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: { retries: 5 }
    });
    this.consumer = null;
    this.emailService = new EmailService();
  }

  async connect() {
    this.consumer = this.kafka.consumer({ 
      groupId: 'notification-service-group',
      sessionTimeout: 30000
    });
    
    await this.consumer.connect();
    console.log('kafka consumer connected for Notification Service');
    
    //subscribe to topics
    await this.consumer.subscribe({ topic: 'user-events', fromBeginning: false });
    await this.consumer.subscribe({ topic: 'workflow-events', fromBeginning: false });
    await this.consumer.subscribe({ topic: 'notification-events', fromBeginning: false });
    
    //start consuming
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value.toString());
        console.log(`Notification service received: ${event.type}`);
        
        await this.handleEvent(event);
      }
    });
  }

  async handleEvent(event) {
    try {
      switch (event.type) {
        case 'USER_CREATED':
          await this.handleUserCreated(event);
          break;
          
        case 'WORKFLOW_COMPLETED':
          await this.handleWorkflowCompleted(event);
          break;
          
        case 'WORKFLOW_FAILED':
          await this.handleWorkflowFailed(event);
          break;
          
        case 'WORKFLOW_TRIGGERED':
          await this.handleWorkflowTriggered(event);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error handling event ${event.type}:`, error);
    }
  }

  async handleUserCreated(event) {
    //create notification in database
    const notification = new Notification({
      userId: event.userId,
      type: 'email',
      title: 'Welcome to NexLink!',
      message: `Welcome ${event.name}! Your account has been created successfully.`,
      data: { email: event.email, name: event.name },
      priority: 'high'
    });
    
    await notification.save();
    
    //send welcome email
    if (event.email) {
      await this.emailService.sendWelcomeEmail(event.email, event.name);
      notification.delivered = true;
      notification.deliveredAt = new Date();
      await notification.save();
    }
    
    console.log(`Welcome notification sent to ${event.name}`);
  }

  async handleWorkflowCompleted(event) {
    //create notification
    const notification = new Notification({
      userId: event.userId || event.userId,
      type: 'system',
      title: 'Workflow Completed',
      message: `Workflow completed in ${event.executionTime}ms`,
      data: {
        workflowId: event.workflowId,
        executionTime: event.executionTime,
        completedAt: event.completedAt
      },
      priority: 'medium'
    });
    
    await notification.save();
    
    console.log(`workflow completion notification saved for ${event.workflowId}`);
  }

  async handleWorkflowFailed(event) {
    //create failure notification
    const notification = new Notification({
      userId: event.userId,
      type: 'system',
      title: 'Workflow Failed',
      message: `Workflow failed: ${event.error}`,
      data: {
        workflowId: event.workflowId,
        error: event.error,
        failedAt: event.timestamp
      },
      priority: 'urgent'
    });
    
    await notification.save();
    
    console.log(`Workflow failure notification saved for ${event.workflowId}`);
  }

  async handleWorkflowTriggered(event) {
    //create trigger notification
    const notification = new Notification({
      userId: event.userId,
      type: 'system',
      title: 'Workflow Triggered',
      message: `Workflow ${event.workflowId} has been triggered`,
      data: { workflowId: event.workflowId, triggeredAt: event.timestamp },
      priority: 'low'
    });
    
    await notification.save();
    
    console.log(`Workflow trigger notification saved for ${event.workflowId}`);
  }

  async disconnect() {
    if (this.consumer) {
      await this.consumer.disconnect();
      console.log('Kafka consumer disconnected');
    }
  }
}

module.exports = NotificationConsumer;