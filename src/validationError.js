class ValidationError extends Error {
  static PARAMS_VALIDATION_FAILURE = 'PARAMS_VALIDATION_FAILURE';

  static HEADER_VALIDATION_FAILURE = 'HEADER_VALIDATION_FAILURE';

  static BODY_VALIDATION_FAILURE = 'BODY_VALIDATION_FAILURE';

  constructor(type, message, details) {
    super(message);
    this.type = type;
    this.details = details;
  }
}

module.exports = ValidationError;
