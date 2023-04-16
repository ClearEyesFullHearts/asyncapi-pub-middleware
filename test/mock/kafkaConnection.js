module.exports = {
  send: (obj) => {
    const { topic, messages } = obj;
    console.log('kafka send message');
    console.log(topic, messages);
  },
  disconnect: () => Promise.resolve(),
};
