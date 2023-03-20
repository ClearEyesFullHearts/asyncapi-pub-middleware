const Amqp = require('../../src/plugins/amqp');

class MockAmqp extends Amqp {
  static async getConnection(connectionInfo) {
    const { protocol, protocolVersion } = connectionInfo;
    if (protocol !== 'amqp') throw new Error('Protocol should be amqp');
    if (protocolVersion !== '0.9.1') throw new Error('Only the 0.9.1 protocol is supported');

    // for tests
    const conn = {
      createChannel: () => ({
        assertExchange: () => Promise.resolve(true),
        assertQueue: () => Promise.resolve(true),
        sendToQueue: (q, buffer, opts) => {
          console.log(q, buffer.toString(), opts);
        },
      }),
    };
    return Promise.resolve(conn);
  }
}

module.exports = MockAmqp;
