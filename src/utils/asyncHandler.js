const { toHttpError } = require('./httpError');

module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => next(toHttpError(err)));
