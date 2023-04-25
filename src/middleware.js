const { Publisher } = require('./publisher');

async function getPublisherMiddleware(doc, connections = {}, plugins = {}) {
  const publisher = new Publisher(plugins);
  await publisher.loadAPI(doc, connections);

  return (req, res, next) => {
    if (!req.api) req.api = {};
    req.api.publisher = {
      publish: async (topic, msg, headers, options) => {
        const resultArray = await publisher.publish(topic, msg, headers, options)
        return resultArray;
      },
      stop: async (closeConnection = true) => {
        await publisher.stop(closeConnection);
      },
    };
    next();
  };
}

module.exports = getPublisherMiddleware;
