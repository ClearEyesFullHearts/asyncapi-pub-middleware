const Amqp = require('../../src/plugins/amqp');
const connectionObject = require('./amqpConnection');

class MockAmqp extends Amqp {
  static async getConnection(connectionInfo) {
    const { protocol, protocolVersion } = connectionInfo;
    if (protocol !== 'amqp') throw new Error('Protocol should be amqp');
    if (protocolVersion !== '0.9.1') throw new Error('Only the 0.9.1 protocol is supported');

    return Promise.resolve(connectionObject);
  }
}

module.exports = MockAmqp;
