const { HttpError } = require('./httpError');

function bad(message) {
  return new HttpError(400, message, 'VALIDATION_ERROR');
}

function parseId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw bad(`${label} tidak valid`);
  return n;
}

function requireString(value, label, max = 255) {
  if (typeof value !== 'string' || value.trim() === '') throw bad(`${label} wajib diisi`);
  if (value.trim().length > max) throw bad(`${label} maksimal ${max} karakter`);
  return value.trim();
}

function optionalString(value, label, max = 1000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw bad(`${label} harus berupa teks`);
  if (value.trim().length > max) throw bad(`${label} maksimal ${max} karakter`);
  return value.trim();
}

function nonNegativeInt(value, label) {
  if (!Number.isInteger(value) || value < 0) throw bad(`${label} harus bilangan bulat >= 0`);
  return value;
}

function optionalBool(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw bad(`${label} harus true/false`);
  return value;
}

module.exports = { parseId, requireString, optionalString, nonNegativeInt, optionalBool };
