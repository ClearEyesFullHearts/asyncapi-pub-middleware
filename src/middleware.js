const { Publisher } = require('./publisher');

async function getPublisherMiddleware(doc, connections = {}) {
  const publisher = new Publisher();
  await publisher.loadAPI(doc, connections);

  return (req, res, next) => {
    if (!req.api) req.api = {};
    req.api.publisher = {
      publish: async (topic, msg, headers, options) => {
        await publisher.publish(topic, msg, headers, options);
      },
    };
    next();
  };
}

module.exports = getPublisherMiddleware;
