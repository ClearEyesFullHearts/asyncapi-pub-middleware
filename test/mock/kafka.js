const Kafka = require('../../src/plugins/kafka');
const connectionObject = require('./kafkaConnection');

class MockKafka extends Kafka {
  async bind(channelInfo, operationInfo) {
    this.client = connectionObject;
    this.isConnected = true;
    const { topic, partitions } = channelInfo;
    this.topic = topic;
    this.partitionsNb = partitions;
  }
}

module.exports = MockKafka;
