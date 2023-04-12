const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const pathRegexp = require('path-to-regexp');
const debug = require('debug')('asyncapi-pub-middleware:channel');
const ValidationError = require('./validationError');

function cleanHeaders(headers) {
  const {
    'x-parser-schema-id': ignore,
    ...restHeaders
  } = headers;

  Object.keys(restHeaders).forEach((k) => {
    if (Object.prototype.toString.call(restHeaders[k]) === '[object Object]') {
      restHeaders[k] = cleanHeaders(restHeaders[k]);
    }
  });

  return restHeaders;
}

class Channel {
  constructor(topic, publishers, paramsSchema, headerSchema, bodySchema, options) {
    this.topic = topic.replace(/{/g, ':').replace(/}/g, '');
    this.keys = [];
    this.regexp = pathRegexp(this.topic, this.keys, options);
    this.publishers = publishers;

    const ajvP = new Ajv({ coerceTypes: true });
    addFormats(ajvP);
    this.paramsValidator = ajvP.compile(paramsSchema);

    const ajvB = new Ajv();
    addFormats(ajvB);
    this.headerValidator = ajvB.compile(cleanHeaders(headerSchema));
    this.bodyValidator = ajvB.compile(bodySchema);

    debug(`Channel created for topic ${this.topic} with ${this.publishers.length} connections`);
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
    debug(`Channel published ${results.length} messages`);
  }
}

module.exports = { Channel };
