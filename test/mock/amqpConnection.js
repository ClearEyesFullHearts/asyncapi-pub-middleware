module.exports = {
  createChannel: () => Promise.resolve({
    assertExchange: () => Promise.resolve(true),
    assertQueue: () => Promise.resolve(true),
    sendToQueue: (q, buffer, opts) => {
      console.log('queue message');
      console.log(q, buffer.toString(), opts);
    },
    publish: (exc, topic, buffer, opts) => {
      console.log('routingKey message');
      console.log(exc, topic, buffer.toString(), opts);
    },
  }),
};
