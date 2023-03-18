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
const { Channel } = require('./channel');
const { Connection } = require('./connection');

class Publisher {
  constructor() {
    this.connections = {};
    this.channels = [];

    this.getChannelAndParams = (topic) => {
      const l = this.channels.length;
      for (let i = 0; i < l; i += 1) {
        const channel = this.channels[i];
        const match = channel.regexp.exec(topic);
        if (match) {
          const params = {};
          for (let j = 1; i < match.length; j += 1) {
            const key = channel.keys[i - 1];
            const prop = key.name;
            const val = this.decode_param(match[i]);

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
  }

  async loadAPI(apiDocument, connections) {
    const api = await parse(apiDocument);
    const apiChannelNames = api.channelNames();
    this.channels = apiChannelNames.reduce(async (prev, channelName) => {
      const chan = api.channel(channelName);
      if (chan.hasSubscribe()) {
        const ope = chan.subscribe();
        let serverNames = chan.servers();
        if (serverNames.length < 1) serverNames = api.serverNames();
        const servers = await serverNames.map(async (sn) => {
          if (this.connections[sn]) return this.connections[sn];
          if (connections[sn]) {
            this.connections[sn] = connections[sn];
            return this.connections[sn];
          }
          const conn = new Connection(api.server(sn));
          await conn.connect();
          this.connections[sn] = conn;
          return conn;
        });

        const c = new Channel(channelName, ope, servers);
        await c.run();
        prev.push(c);
      }

      return prev;
    }, []);
  }

  async publish(topic, msg, options) {
    const { channel, params } = this.getChannelAndParams(topic);
    if (!channel) throw new Error(`No channel found for topic ${topic}`);

    channel.validateParams(params);
    channel.validateMessage(msg);

    await channel.publish(msg, options);
  }
}

module.exports = { Publisher };
