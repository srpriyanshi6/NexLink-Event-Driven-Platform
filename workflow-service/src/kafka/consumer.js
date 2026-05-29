const { Kafka } = require('kafkajs');
const Workflow = require('../models/Workflow');
const WorkflowEngine = require('../services/workflowEngine');

/**
 * Kafka Consumer for Workflow Service
 * Listens to user and workflow events
 */
class WorkflowConsumer {
  constructor(workflowEngine) {
    this.kafka = new Kafka({
      clientId: 'workflow-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: { retries: 5 }
    });
    this.consumer = null;
    this.workflowEngine = workflowEngine;
  }

  /**
   * Connect and start consuming events
   */
  async connect() {
    this.consumer = this.kafka.consumer({ 
      groupId: 'workflow-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    await this.consumer.connect();
    console.log('✅ Kafka consumer connected for Workflow Service');
    
    // Subscribe to topics
    await this.consumer.subscribe({ topic: 'user-events', fromBeginning: false });
    await this.consumer.subscribe({ topic: 'workflow-events', fromBeginning: false });
    
    // Start consuming
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value.toString());
        console.log(`📨 Workflow Service received: ${event.type} from ${topic}`);
        
        await this.handleEvent(event);
      }
    });
  }

  /**
   * Handle incoming events
   */
  async handleEvent(event) {
    try {
      switch (event.type) {
        case 'USER_CREATED':
          await this.createOnboardingWorkflow(event);
          break;
          
        case 'WORKFLOW_TRIGGERED':
          await this.workflowEngine.executeWorkflow(event.workflowId);
          break;
          
        case 'USER_UPDATED':
          console.log(`User ${event.userId} updated, checking workflows...`);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error handling event ${event.type}:`, error);
    }
  }

  /**
   * Create onboarding workflow for new users
   */
  async createOnboardingWorkflow(event) {
    try {
      const workflow = new Workflow({
        name: `Onboarding: ${event.name}`,
        description: 'Automated onboarding workflow for new users',
        steps: [
          {
            order: 1,
            type: 'notification',
            config: {
              message: `Welcome ${event.name}! Complete your profile to get started.`,
              type: 'email'
            },
            status: 'pending'
          },
          {
            order: 2,
            type: 'task',
            config: {
              task: 'Complete profile setup',
              duration: 2000
            },
            status: 'pending'
          },
          {
            order: 3,
            type: 'webhook',
            config: {
              url: `${process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004'}/api/analytics/track`,
              method: 'POST',
              data: { 
                event: 'onboarding_started',
                userId: event.userId,
                userName: event.name
              }
            },
            status: 'pending'
          }
        ],
        createdBy: event.userId,
        status: 'active',
        priority: 'high'
      });
      
      await workflow.save();
      console.log(`✅ Onboarding workflow created for user ${event.userId}`);
      
      // Trigger the workflow
      await this.workflowEngine.executeWorkflow(workflow._id);
      
    } catch (error) {
      console.error('Failed to create onboarding workflow:', error);
    }
  }

  /**
   * Disconnect consumer
   */
  async disconnect() {
    if (this.consumer) {
      await this.consumer.disconnect();
      console.log('Kafka consumer disconnected');
    }
  }
}

module.exports = WorkflowConsumer;