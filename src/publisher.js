/*!
 * asyncapi-middleware
 * Copyright(c) 2023 MFT
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */
const { parse } = require('@asyncapi/parser');
const { Channel } = require('./channel');

class Publisher {
  constructor(plugins = {}) {
    this.connections = {};
    this.channels = [];
    this.plugins = {
      amqp: './plugins/amqp',
      kafka: './plugins/kafka',
      ...plugins,
    };

    this.getChannelAndParams = (topic) => {
      const l = this.channels.length;
      for (let i = 0; i < l; i += 1) {
        const channel = this.channels[i];

        const match = channel.regexp.exec(topic);
        if (match) {
          const params = {};
          for (let j = 1; j < match.length; j += 1) {
            const key = channel.keys[j - 1];
            const prop = key.name;
            const val = this.decode_param(match[j]);

            if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
              params[prop] = val;
            }
          }

          return { channel, params };
        }
      }
      return {};
    };
    this.decode_param = (val) => {
      if (typeof val !== 'string' || val.length === 0) {
        return val;
      }

      return decodeURIComponent(val);
    };
    this.getParamsSchema = (channel) => Object.keys(channel.parameters()).reduce((prevP, pName) => {
      const { properties, required } = prevP;
      const { type } = channel.parameter(pName).schema().json();
      return {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...properties,
          [pName]: { type },
        },
        required: [...required, pName],
      };
    }, {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    });
  }

  async loadAPI(apiDocument, connections = {}) {
    const api = await parse(apiDocument);
    const apiChannelNames = api.channelNames();
    const channels = await apiChannelNames.reduce(async (prev, channelName) => {
      const chan = api.channel(channelName);
      if (chan.hasSubscribe()) {
        let serverNames = chan.servers();
        if (serverNames.length < 1) serverNames = api.serverNames();

        const servers = serverNames.map(async (sn) => {
          const protocol = api.server(sn).protocol();
          const plugin = this.plugins[protocol];
          if (!plugin) throw new Error(`No plugin available for protocol ${protocol}`);

          const bindings = chan.binding(protocol) || {};

          const PluginClass = require(plugin); // eslint-disable-line

          let conn;
          if (connections[sn]) {
            this.connections[sn] = connections[sn];
            conn = this.connections[sn];
          } else if (this.connections[sn]) {
            conn = this.connections[sn];
          } else {
            conn = await PluginClass.getConnection(api.server(sn).json());
          }

          const publisher = new PluginClass(conn);
          await publisher.bind(bindings);

          const operationInfo = chan.subscribe().binding(protocol);
          const messageInfo = chan.subscribe().message().binding(protocol);

          return { publisher, infos: { ...operationInfo, ...messageInfo } };
        });

        const publishers = await Promise.all(servers);

        const paramsSchema = this.getParamsSchema(chan);
        const payloadSchema = chan.subscribe().message().originalPayload();
        prev.push(new Channel(channelName, publishers, paramsSchema, payloadSchema));
      }
      return prev;
    }, []);

    this.channels = await Promise.all(channels);
  }

  async publish(topic, msg, options) {
    const { channel, params } = this.getChannelAndParams(topic);
    if (!channel) throw new Error(`No channel found for topic ${topic}`);

    channel.validateParams(params);
    channel.validateMessage(msg);

    await channel.publish(topic, msg, options);
  }
}

module.exports = { Publisher };
