const {
  describe, expect, test,
} = require('@jest/globals');
const fs = require('fs');

const { Publisher } = require('../src/publisher');
const amqpMockConnection = require('./mock/amqpConnection');
const kafkaMockConnection = require('./mock/kafkaConnection');

describe('Publisher tests', () => {
  test('my test amqp', async () => {
    const pub = new Publisher({ amqp: '../test/mock/amqp' });
    const text = fs.readFileSync(`${__dirname}/documents/servers.yaml`, 'utf8');

    await pub.loadAPI(text);

    await pub.publish('events/3', { jobId: '3', status: 'started' });
  });
  test('my test kafka', async () => {
    const pub = new Publisher({ kafka: '../test/mock/kafka' });
    const text = fs.readFileSync(`${__dirname}/documents/kafka-brokers.yaml`, 'utf8');

    await pub.loadAPI(text);

    const msg = { name: 'john smith', address: 'john.smith@example.com' };
    await pub.publish('my.topic.of.choice', msg, {}, { key: 'test', partition: 1 });
  });
  test('my test', async () => {
    const pub = new Publisher();
    const text = fs.readFileSync(`${__dirname}/documents/logger.yaml`, 'utf8');

    const opts = {
      connections: { logger: amqpMockConnection, garbage: kafkaMockConnection },
    };
    await pub.loadAPI(text, opts);

    const event = {
      sessionId: 'uuid-session',
      eventId: 'uuid-event',
      type: 'printJobEvent',
      duration: 32,
      result: 'OK',
      input: {
        jobId: 'testPrint',
        status: 'created',
      },
    };
    await pub.publish('event.test.info', event);

    const garbage = {
      receiver: 'test',
      routing: 'garbage.out',
    };
    await pub.publish('garbage.in', garbage, { 'x-session-id': 'myuniqueid' }, { key: 'test', partition: 1 });
  });

  test('my test no message', async () => {
    const pub = new Publisher({ amqp: '../test/mock/amqp' });
    const text = fs.readFileSync(`${__dirname}/documents/amqp-no-msg.yaml`, 'utf8');

    await pub.loadAPI(text);

    await pub.publish('events/3');
  });
});
