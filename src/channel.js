const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const pathRegexp = require('path-to-regexp');
const ValidationError = require('./validationError');

class Channel {
  constructor(topic, publishers, paramsSchema, headerSchema, bodySchema, options) {
    this.topic = topic.replace(/{/g, ':').replace(/}/g, '');
    this.keys = [];
    this.regexp = pathRegexp(this.topic, this.keys, options);
    this.publishers = publishers;

    const ajvP = new Ajv({ coerceTypes: true });
    this.paramsValidator = ajvP.compile(paramsSchema);

    const ajvB = new Ajv();
    addFormats(ajvB);
    this.headerValidator = ajvB.compile(headerSchema);
    this.bodyValidator = ajvB.compile(bodySchema);
  }

  validateParams(params) {
    const valid = this.paramsValidator(params);
    if (!valid) {
      const [err] = this.paramsValidator.errors;
      throw new ValidationError(
        ValidationError.PARAMS_VALIDATION_FAILURE,
        `Parameter validation error on ${err.schemaPath}: ${err.message}`,
        err,
      );
    }
  }

  validateHeaders(headers) {
    const valid = this.headerValidator(headers);
    if (!valid) {
      const [err] = this.bodyValidator.errors;
      throw new ValidationError(
        ValidationError.HEADER_VALIDATION_FAILURE,
        `Header validation error on ${err.schemaPath}: ${err.message}`,
        err,
      );
    }
  }

  validateMessage(message) {
    const valid = this.bodyValidator(message);
    if (!valid) {
      const [err] = this.bodyValidator.errors;
      throw new ValidationError(
        ValidationError.BODY_VALIDATION_FAILURE,
        `Body validation error on ${err.schemaPath}: ${err.message}`,
        err,
      );
    }
  }

  async publish(topic, header, message, options) {
    const l = this.publishers.length;
    const results = [];
    for (let i = 0; i < l; i += 1) {
      const { messageBindings, publisher } = this.publishers[i];
      results.push(publisher.publish(topic, header, message, messageBindings, options));
    }

    await Promise.all(results);
  }
}

module.exports = { Channel };
