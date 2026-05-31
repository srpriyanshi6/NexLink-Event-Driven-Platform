const { Kafka } = require('kafkajs');
const MetricsAggregator = require('../aggregators/metricsAggregator');

//Kafka Consumer for Analytics Service
 //listens to all events and processes them for analytics
class AnalyticsConsumer {
  constructor(metricsAggregator) {
    this.kafka = new Kafka({
      clientId: 'analytics-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: { retries: 5 }
    });
    this.consumer = null;
    this.metricsAggregator = metricsAggregator;
  }

  async connect() {
    this.consumer = this.kafka.consumer({ 
      groupId: 'analytics-service-group',
      sessionTimeout: 30000
    });
    
    await this.consumer.connect();
    console.log('kafka consumer connected for Analytics Service');
    
    //subscribe to all relevant topics
    await this.consumer.subscribe({ topic: 'user-events', fromBeginning: false });
    await this.consumer.subscribe({ topic: 'workflow-events', fromBeginning: false });
    await this.consumer.subscribe({ topic: 'notification-events', fromBeginning: false });
    
    //start consuming
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value.toString());
        console.log(`analytics service received: ${event.type}`);
        
        //process for analytics
        await this.metricsAggregator.processEvent(event);
      }
    });
  }

  async disconnect() {
    if (this.consumer) {
      await this.consumer.disconnect();
      console.log('Kafka consumer disconnected');
    }
  }
}

module.exports = AnalyticsConsumer;