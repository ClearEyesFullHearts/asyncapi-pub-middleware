const amqplib = require('amqplib');

class AmqpConnection {
  static async getConnection(connectionInfo) {
    const { url, protocol, protocolVersion } = connectionInfo;
    if (protocol !== 'amqp') throw new Error('Protocol should be amqp');
    if (protocolVersion !== '0.9.1') throw new Error('Only the 0.9.1 protocol is supported');

    const conn = await amqplib.connect(url);
    return conn;
  }

  constructor(conn) {
    this.connection = conn;
    this.boundChannel = null;
    this.isQ = false;
    this.exchangeName = '';
    this.queueName = '';
    this.operationBindings = {};

    this.getPublishOptions = (infos) => {
      const publishOptions = {};
      const {
        timestamp, deliveryMode, cc, bcc, messageType, ...opeOptions
      } = infos;

      if (timestamp) {
        publishOptions.timestamp = Date.now();
      }
      if (deliveryMode) {
        if (deliveryMode === 1) publishOptions.persistent = false;
        if (deliveryMode === 2) publishOptions.persistent = true;
      }
      if (cc) {
        publishOptions.CC = cc;
      }
      if (bcc) {
        publishOptions.BCC = bcc;
      }
      if (messageType) {
        publishOptions.type = messageType;
      }

      ['expiration', 'userId', 'priority', 'mandatory', 'replyTo', 'contentEncoding'].forEach((opt) => {
        if (opeOptions[opt]) publishOptions[opt] = opeOptions[opt];
      });

      return publishOptions;
    };
  }

  async bind(channelInfo, operationInfo) {
    this.operationBindings = operationInfo;

    const {
      is,
      exchange,
      queue,
    } = channelInfo;
    this.isQ = (is === 'queue');

    this.boundChannel = await this.connection.createChannel();

    if (!this.isQ && exchange && exchange.name) {
      const { name: exName, type: exType, ...exOptions } = exchange;
      this.exchangeName = exName;
      const options = {
        durable: true,
        internal: false,
        autoDelete: false,
        ...exOptions,
      };
      await this.boundChannel.assertExchange(exName, exType, options);
    }

    if (this.isQ && (!queue || !queue.name)) throw new Error('Channel type "queue" should have a queue name defined');

    if (queue && queue.name) {
      const { name: qName, ...qOptions } = queue;
      this.queueName = qName;
      const options = {
        durable: true,
        exclusive: false,
        autoDelete: false,
        ...qOptions,
      };
      await this.boundChannel.assertQueue(qName, options);
    }
  }

  async publish(topic, headers, msg, infos, options = {}) {
    let strContent = msg;
    if (Object.prototype.toString.call(msg) !== '[object String]') {
      try {
        strContent = JSON.stringify(msg);
      } catch (err) {
        throw new Error('The message content could not be stringified');
      }
    }
    const bufContent = Buffer.from(strContent);

    const publishOptions = this.getPublishOptions({
      ...this.operationBindings,
      ...infos,
    });

    const fullOptions = {
      ...publishOptions, ...options, headers: { ...headers },
    };

    if (this.isQ) {
      return new Promise((resolve, reject) => {
        try {
          const result = this.boundChannel.sendToQueue(
            this.queueName,
            bufContent,
            fullOptions,
          );
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    }
    return new Promise((resolve, reject) => {
      try {
        const result = this.boundChannel.publish(
          this.exchangeName,
          topic,
          bufContent,
          fullOptions,
        );
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = AmqpConnection;
