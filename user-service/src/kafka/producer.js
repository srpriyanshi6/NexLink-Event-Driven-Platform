const { Kafka } = require('kafkajs');

class UserEventProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'user-service',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
    });
    this.producer = null;
  }

  async connect() {
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log('yay Kafka producer ready');
  }

  async userCreated(user) {
    await this.producer.send({
      topic: 'user-events',
      messages: [{
        value: JSON.stringify({
          type: 'USER_CREATED',
          userId: user._id,
          email: user.email,
          name: user.name,
          timestamp: new Date().toISOString()
        })
      }]
    });
    console.log(`USER_CREATED event sent: ${user.email}`);
  }

  async userUpdated(userId, changes) {
    await this.producer.send({
      topic: 'user-events',
      messages: [{
        value: JSON.stringify({
          type: 'USER_UPDATED',
          userId,
          changes,
          timestamp: new Date().toISOString()
        })
      }]
    });
  }
}

module.exports = UserEventProducer;