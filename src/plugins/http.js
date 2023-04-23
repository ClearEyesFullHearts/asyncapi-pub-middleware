const axios = require('axios');
const debug = require('debug')('asyncapi-pub-middleware:plugins:http');

class HttpConnection {
  static async getConnection(serverInfoFromSpec) {
    debug('Creating http connection');
    const { url, protocol } = serverInfoFromSpec;
    if (protocol !== 'http') throw new Error('Protocol should be http');
    const instance = axios.create({
      baseURL: url,
    });
    return Promise.resolve(instance);
  }

  constructor(conn) {
    this.instance = conn;
    this.method = null;
  }

  async bind(channelBindingsFromSpec, operationBindingsFromSpec) {
    const { type, method } = operationBindingsFromSpec;
    if (type !== 'request') throw new Error('Protocol only support request operation');

    this.method = method;
    return Promise.resolve();
  }

  async publish(topic, headers, msg) {
    const response = await this.instance.request({
      url: topic,
      method: this.method,
      headers,
      data: msg,
    });

    const { data, status, headers: respHeaders } = response;
    return { data, status, headers: respHeaders };
  }

  async stop() {
    this.instance = null;
    this.method = null;
    return Promise.resolve();
  }
}

module.exports = HttpConnection;
