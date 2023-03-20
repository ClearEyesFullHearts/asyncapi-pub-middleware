const {
  describe, expect, test,
} = require('@jest/globals');
const fs = require('fs');

const { Publisher } = require('../src/publisher');

describe('Publisher tests', () => {
  test('my test', async () => {
    const pub = new Publisher({ amqp: '../test/mock/amqp' });
    const text = fs.readFileSync(`${__dirname}/documents/servers.yaml`, 'utf8');

    await pub.loadAPI(text);

    await pub.publish('events/3', { jobId: '3', status: 'started' });
  });
});
