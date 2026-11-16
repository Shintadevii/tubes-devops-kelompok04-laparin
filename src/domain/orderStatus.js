const STATUS = Object.freeze({
  PENDING: 'PENDING',
  DIPROSES: 'DIPROSES',
  SIAP: 'SIAP',
  SELESAI: 'SELESAI',
  DIBATALKAN: 'DIBATALKAN',
});

// Alur yang diizinkan: PENDING -> DIPROSES -> SIAP -> SELESAI, atau PENDING -> DIBATALKAN.
const TRANSITIONS = Object.freeze({
  [STATUS.PENDING]: [STATUS.DIPROSES, STATUS.DIBATALKAN],
  [STATUS.DIPROSES]: [STATUS.SIAP],
  [STATUS.SIAP]: [STATUS.SELESAI],
  [STATUS.SELESAI]: [],
  [STATUS.DIBATALKAN]: [],
});

function isValidStatus(status) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, status);
}

function nextStatuses(from) {
  return isValidStatus(from) ? [...TRANSITIONS[from]] : [];
}

function canTransition(from, to) {
  return nextStatuses(from).includes(to);
}

function assertTransition(from, to) {
  if (!isValidStatus(from) || !isValidStatus(to)) {
    const error = new Error(`Status tidak dikenal: ${from} -> ${to}`);
    error.code = 'INVALID_STATUS';
    throw error;
  }
  if (!canTransition(from, to)) {
    const error = new Error(`Status tidak boleh berpindah dari ${from} ke ${to}`);
    error.code = 'INVALID_STATUS_TRANSITION';
    throw error;
  }
}

module.exports = { STATUS, TRANSITIONS, isValidStatus, nextStatuses, canTransition, assertTransition };