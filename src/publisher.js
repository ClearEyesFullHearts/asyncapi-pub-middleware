/*!
 * asyncapi-middleware
 * Copyright(c) 2023 MFT
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */
const { parse, AsyncAPIDocument } = require('@asyncapi/parser');
const debug = require('debug')('asyncapi-pub-middleware:publisher');
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

    debug(`Publisher created with ${Object.keys(plugins).length > 0 ? Object.keys(plugins).join(', ') : 'no'} custom plugins`);

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
      const {
        type, format, enum: enumValues, pattern,
      } = channel.parameter(pName).schema().json();
      return {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...properties,
          [pName]: {
            type, format, enum: enumValues, pattern,
          },
        },
        required: [...required, pName],
      };
    }, {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    });
    this.getNamedConnections = async (api, connections) => {
      const serverNames = api.serverNames();

      debug(`Found named servers ${serverNames}`);

      const l = serverNames.length;
      let conns = [];
      for (let i = 0; i < l; i += 1) {
        const sn = serverNames[i];
        const protocol = api.server(sn).protocol();

        debug(`Protocol for ${sn} is ${protocol}`);

        const plugin = this.plugins[protocol];
        if (!plugin) throw new Error(`No plugin available for protocol ${protocol}`);

        if (connections[sn]) {
          conns.push(Promise.resolve(connections[sn]));
        } else {
          const PluginClass = require(plugin); // eslint-disable-line
          conns.push(PluginClass.getConnection(api.server(sn).json()));
        }
      }
      conns = await Promise.all(conns);
      const namedConnections = {};
      for (let j = 0; j < l; j += 1) {
        const sn = serverNames[j];
        namedConnections[sn] = conns[j];
      }

      return namedConnections;
    };
  }

  async loadAPI(apiDocument, options = {}) {
    let api = apiDocument;
    if (!(api instanceof AsyncAPIDocument)) {
      api = await parse(apiDocument);
    }

    const {
      tag = '',
      connections = {},
    } = options;

    this.connections = await this.getNamedConnections(api, connections);

    debug(`Found ${Object.keys(this.connections).length} named connections`);

    const apiChannelNames = api.channelNames();

    debug(`Found ${apiChannelNames.length} channels`);

    const channels = [];
    const l = apiChannelNames.length;
    for (let i = 0; i < l; i += 1) {
      const channelName = apiChannelNames[i];
      const chan = api.channel(channelName);
      if (chan.hasSubscribe() && (!tag || chan.subscribe().hasTag(tag))) {
        let serverNames = chan.servers();
        if (serverNames.length < 1) serverNames = api.serverNames();

        const operation = chan.subscribe();
        const opeMsg = operation.message();

        const servers = serverNames.map(async (sn) => {
          const protocol = api.server(sn).protocol();
          const plugin = this.plugins[protocol];
          if (!plugin) throw new Error(`No plugin available for protocol ${protocol}`);

          const channelBindings = chan.binding(protocol) || {};

          const PluginClass = require(plugin); // eslint-disable-line

          const operationBindings = operation.binding(protocol) || {};

          const publisher = new PluginClass(this.connections[sn]);
          await publisher.bind(channelBindings, operationBindings);

          let messageBindings = {};
          if (opeMsg && opeMsg.binding(protocol)) {
            messageBindings = opeMsg.binding(protocol);
          }

          return { publisher, messageBindings };
        });

        const publishers = await Promise.all(servers); // eslint-disable-line

        const paramsSchema = this.getParamsSchema(chan);
        let headersSchema = {};
        if (opeMsg && opeMsg.headers()) {
          headersSchema = opeMsg.headers().json();
        }

        let payloadSchema = {};
        if (opeMsg) {
          payloadSchema = opeMsg.originalPayload();
        }
        const c = new Channel(channelName, publishers, paramsSchema, headersSchema, payloadSchema);
        channels.push(c);
        debug(`Channel ${channelName} is ready`);
      }
    }

    this.channels = channels;
  }

  async publish(topic, msg, headers = {}, options = {}) {
    const { channel, params } = this.getChannelAndParams(topic);
    if (!channel) throw new Error(`No channel found for topic ${topic}`);

    channel.validateParams(params);
    channel.validateHeaders(headers);
    channel.validateMessage(msg);

    debug(`Publish on topic ${topic}`);

    await channel.publish(topic, headers, msg, options);
  }
}

module.exports = { Publisher };
