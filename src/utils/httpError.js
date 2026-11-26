class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Memetakan error domain (code) ke status HTTP.
const CODE_TO_STATUS = {
  INVALID_QUANTITY: 400,
  EMPTY_CART: 400,
  INVALID_STATUS: 400,
  VALIDATION_ERROR: 400,
  MENU_NOT_FOUND: 404,
  NOT_FOUND: 404,
  MENU_UNAVAILABLE: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_STATUS_TRANSITION: 409,
  CONFLICT: 409,
};

function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err && CODE_TO_STATUS[err.code]) {
    return Object.assign(new HttpError(CODE_TO_STATUS[err.code], err.message, err.code), {
      details: err.details,
    });
  }
  // PostgreSQL: foreign key violation / unique violation / check violation
  if (err && err.code === '23503') {
    return new HttpError(409, 'Data masih dipakai data lain sehingga tidak bisa dihapus', 'CONFLICT');
  }
  if (err && err.code === '23505') {
    return new HttpError(409, 'Data dengan nama tersebut sudah ada', 'CONFLICT');
  }
  if (err && err.code === '23514') {
    return new HttpError(400, 'Nilai melanggar batasan data (mis. stok/harga minus)', 'VALIDATION_ERROR');
  }
  return err;
}

module.exports = { HttpError, toHttpError };
