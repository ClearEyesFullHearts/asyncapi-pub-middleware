const {
  describe, expect, test,
} = require('@jest/globals');
const fs = require('fs');

const { Publisher } = require('../src/publisher');

describe('Publisher tests', () => {
  test.only('my test amqp', async () => {
    const pub = new Publisher({ amqp: '../test/mock/amqp' });
    const text = fs.readFileSync(`${__dirname}/documents/servers.yaml`, 'utf8');

    await pub.loadAPI(text);

    await pub.publish('events/3', { jobId: '3', status: 'started' });
  });
  test('my test kafka', async () => {
    const pub = new Publisher();
    const text = fs.readFileSync(`${__dirname}/documents/kafka-brokers.yaml`, 'utf8');

    await pub.loadAPI(text);

    // await pub.publish('events/3', { jobId: '3', status: 'started' });
  });
});
