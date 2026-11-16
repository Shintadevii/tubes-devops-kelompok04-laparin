const { STATUS, canTransition, assertTransition, nextStatuses } = require('../src/domain/orderStatus');

describe('aturan status order', () => {
  it('mengizinkan alur normal PENDING -> DIPROSES -> SIAP -> SELESAI', () => {
    expect(canTransition(STATUS.PENDING, STATUS.DIPROSES)).toBe(true);
    expect(canTransition(STATUS.DIPROSES, STATUS.SIAP)).toBe(true);
    expect(canTransition(STATUS.SIAP, STATUS.SELESAI)).toBe(true);
  });

  it('mengizinkan pembatalan hanya dari PENDING', () => {
    expect(canTransition(STATUS.PENDING, STATUS.DIBATALKAN)).toBe(true);
    expect(canTransition(STATUS.DIPROSES, STATUS.DIBATALKAN)).toBe(false);
    expect(canTransition(STATUS.SIAP, STATUS.DIBATALKAN)).toBe(false);
  });

  it('menolak lompatan status', () => {
    expect(canTransition(STATUS.PENDING, STATUS.SIAP)).toBe(false);
    expect(canTransition(STATUS.PENDING, STATUS.SELESAI)).toBe(false);
    expect(canTransition(STATUS.DIPROSES, STATUS.SELESAI)).toBe(false);
    expect(() => assertTransition(STATUS.PENDING, STATUS.SELESAI)).toThrow(
      expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' })
    );
  });

  it('menolak mundur dan menganggap SELESAI/DIBATALKAN sebagai status final', () => {
    expect(canTransition(STATUS.SIAP, STATUS.DIPROSES)).toBe(false);
    expect(nextStatuses(STATUS.SELESAI)).toEqual([]);
    expect(nextStatuses(STATUS.DIBATALKAN)).toEqual([]);
  });

  it('menolak status yang tidak dikenal', () => {
    expect(() => assertTransition('PENDING', 'RANDOM')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATUS' })
    );
  });
});