const { calculateOrderTotal, validateQuantity } = require('../src/domain/pricing');

describe('perhitungan total di server', () => {
  it('menjumlahkan harga satuan x qty dari data server', () => {
    const total = calculateOrderTotal([
      { unitPrice: 15000, quantity: 2 },
      { unitPrice: 5000, quantity: 3 },
    ]);
    expect(total).toBe(45000);
  });

  it('mengabaikan field harga/total kiriman klien', () => {
    // klien mencoba menyisipkan price/total palsu; hanya unitPrice dari DB yang dipakai
    const lines = [{ unitPrice: 20000, quantity: 1, price: 1, total: 1 }];
    expect(calculateOrderTotal(lines)).toBe(20000);
  });

  it('menolak qty nol, negatif, atau bukan bilangan bulat', () => {
    expect(() => validateQuantity(0)).toThrow(expect.objectContaining({ code: 'INVALID_QUANTITY' }));
    expect(() => validateQuantity(-2)).toThrow(expect.objectContaining({ code: 'INVALID_QUANTITY' }));
    expect(() => validateQuantity(1.5)).toThrow(expect.objectContaining({ code: 'INVALID_QUANTITY' }));
  });

  it('menolak keranjang kosong', () => {
    expect(() => calculateOrderTotal([])).toThrow(expect.objectContaining({ code: 'EMPTY_CART' }));
  });
});