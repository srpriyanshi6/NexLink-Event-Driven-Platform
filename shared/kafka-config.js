const { Kafka } = require('kafkajs');

class KafkaClient {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.kafka = new Kafka({
      clientId: serviceName,
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      retry: { retries: 3, initialRetryTime: 300 }
    });
  }
  
  async createProducer() {
    const producer = this.kafka.producer();
    await producer.connect();
    console.log(`yay Producer connected: ${this.serviceName}`);
    return producer;
  }
  
  async createConsumer(groupId) {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    console.log(`yay yay Consumer connected: ${groupId}`);
    return consumer;
  }
}

module.exports = KafkaClient;