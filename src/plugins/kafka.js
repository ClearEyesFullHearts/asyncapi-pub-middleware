const { Kafka } = require('kafkajs');
const Ajv = require('ajv');
const debug = require('debug')('asyncapi-pub-middleware:plugins:kafka');
const ValidationError = require('../validationError');

class KafkaConnection {
  static kafkas = {};

  static tags = {};

  static async getConnection(connectionInfo) {
    const { url, protocol } = connectionInfo;
    if (protocol !== 'kafka') throw new Error('Protocol should be kafka');
    let tagName = 'no-tag';
    if (connectionInfo && connectionInfo.tags && connectionInfo.tags.length === 1) {
      const { tags: [{ name }] } = connectionInfo;
      tagName = name;
    }
    if (!KafkaConnection.tags[tagName]) {
      KafkaConnection.tags[tagName] = { brokerList: [url], producer: null, kafkas: {} };
    } else {
      KafkaConnection.tags[tagName].brokerList.push(url);
    }
    return Promise.resolve(tagName);
  }

  constructor(tagOrClient) {
    this.client = null;
    this.brokersList = null;
    this.isConnected = false;
    this.tag = null;

    if (Object.prototype.toString.call(tagOrClient) !== '[object String]') {
      this.client = tagOrClient;
      this.isConnected = true;
    } else {
      this.tag = tagOrClient;
    }

    this.topic = null;
    this.partitionsNb = 0;
    this.keyValidator = null;
  }

  async bind(channelInfo, operationInfo) {
    if (!this.isConnected) {
      debug('Creating connection');
      let clientId;
      if (operationInfo
        && operationInfo.clientId
        && operationInfo.clientId.enum
        && operationInfo.clientId.enum.length === 1) {
        const [val] = operationInfo.clientId.enum;
        clientId = val;
      }

      if (!clientId || clientId.length !== 1) {
        if (KafkaConnection.tags[this.tag].producer) {
          this.client = KafkaConnection.tags[this.tag].producer;
          debug(`Re-using existing connection for server '${this.tag}'`);
        } else {
          const kafka = new Kafka({ brokers: KafkaConnection.tags[this.tag].brokerList });
          this.client = kafka.producer();
          debug(`Connecting to cluster '${this.tag}'...`);
          await this.client.connect();
          debug('Connected');
          KafkaConnection.tags[this.tag].producer = this.client;
        }
      } else if (KafkaConnection.tags[this.tag].kafkas[clientId]) {
        this.client = KafkaConnection.tags[this.tag].kafkas[clientId];
        debug(`Re-using existing connection for cluster '${this.tag}' and clientId ${clientId}`);
      } else {
        const kafka = new Kafka({
          clientId,
          brokers: KafkaConnection.tags[this.tag].brokerList,
        });

        this.client = kafka.producer();
        debug(`Connecting to cluster '${this.tag}' with clientId ${clientId}...`);
        await this.client.connect();
        debug('Connected');
        KafkaConnection.tags[this.tag].kafkas[clientId] = this.client;
      }
    }
    this.isConnected = true;
    const { topic, partitions } = channelInfo;
    this.topic = topic;
    this.partitionsNb = partitions;
    debug('Connection ready');
  }

  async publish(topic, headers, msg, infos, options) {
    const { key: keySchema } = infos;
    if (!this.keyValidator && keySchema) {
      const ajvP = new Ajv({ coerceTypes: true });
      this.keyValidator = ajvP.compile(keySchema);
    }

    const { key, partition } = options;

    if (this.partitionsNb && partition && this.partitionsNb < partition) {
      throw new Error(`Partition mismatch: asked for partition ${partition} but only ${this.partitionsNb} partitions are set`);
    }

    if (key && this.keyValidator) {
      const validKey = this.keyValidator(key);
      if (!validKey) {
        const [err] = this.keyValidator.errors;
        throw new ValidationError(
          ValidationError.PARAMS_VALIDATION_FAILURE,
          `Kafka key validation error on ${err.schemaPath}: ${err.message}`,
          err,
        );
      }
    }

    let strContent = msg;
    if (Object.prototype.toString.call(msg) !== '[object String]') {
      try {
        strContent = JSON.stringify(msg);
      } catch (err) {
        throw new Error('The message content could not be stringified');
      }
    }

    const sendTopic = this.topic || topic;

    debug(`Publishing on topic '${sendTopic}'`);
    await this.client.send({
      topic: sendTopic,
      messages: [{
        key, value: strContent, partition, headers,
      }],
    });
  }
}

module.exports = KafkaConnection;
