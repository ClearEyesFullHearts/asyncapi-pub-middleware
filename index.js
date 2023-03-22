const { Publisher } = require('./src/publisher');
const ValidationError = require('./src/validationError');
const getPublisherMiddleware = require('./src/middleware');

module.exports = getPublisherMiddleware;
module.exports.Publisher = Publisher;
module.exports.ValidationError = ValidationError;
