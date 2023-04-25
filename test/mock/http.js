const Http = require('../../src/plugins/http');
const connectionObject = require('./httpConnection');

class MockHttp extends Http {
  static async getConnection(connectionInfo) {
    const { protocol } = connectionInfo;
    if (protocol !== 'http') throw new Error('Protocol should be http');

    return Promise.resolve(connectionObject);
  }
}

module.exports = MockHttp;
