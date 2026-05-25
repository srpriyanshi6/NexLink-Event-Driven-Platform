const { Kafka } = require('kafkajs');

class UserEventProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'user-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 300,
        retries: 10
      }
    });
    this.producer = null;
    this.isConnected = false;
  }

  async connect() {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000
      });
      await this.producer.connect();
      this.isConnected = true;
      console.log('YAY Kafka producer connected for User Service');
    }
    return this.producer;
  }

  async userCreated(user) {
    try {
      await this.ensureConnection();
      
      const event = {
        type: 'USER_CREATED',
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        timestamp: new Date().toISOString(),
        source: 'user-service',
        version: '1.0'
      };
      
      await this.producer.send({
        topic: 'user-events',
        messages: [{
          key: user._id.toString(),
          value: JSON.stringify(event),
          headers: {
            'event-type': 'USER_CREATED',
            'source-service': 'user-service'
          }
        }]
      });
      
      console.log(`USER_CREATED event published: ${user.email}`);
      return true;
    } catch (error) {
      console.error('Failed to publish USER_CREATED event:', error);
      return false;
    }
  }

  async userUpdated(userId, changes) {
    try {
      await this.ensureConnection();
      
      const event = {
        type: 'USER_UPDATED',
        userId,
        changes,
        timestamp: new Date().toISOString(),
        source: 'user-service',
        version: '1.0'
      };
      
      await this.producer.send({
        topic: 'user-events',
        messages: [{
          key: userId.toString(),
          value: JSON.stringify(event),
          headers: {
            'event-type': 'USER_UPDATED',
            'source-service': 'user-service'
          }
        }]
      });
      
      console.log(`USER_UPDATED event published for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to publish USER_UPDATED event:', error);
      return false;
    }
  }

  async ensureConnection() {
    if (!this.isConnected || !this.producer) {
      await this.connect();
    }
  }

  async disconnect() {
    if (this.producer) {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log('Kafka producer disconnected');
    }
  }
}

module.exports = UserEventProducer;