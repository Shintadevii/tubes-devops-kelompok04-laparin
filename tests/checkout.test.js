const { buildCheckoutPlan } = require('../src/domain/checkout');

const menus = [
  { id: 1, tenant_id: 1, name: 'Nasi Goreng', price: 22000, daily_stock: 5, is_active: true },
  { id: 2, tenant_id: 1, name: 'Es Teh', price: 5000, daily_stock: 10, is_active: true },
  { id: 3, tenant_id: 2, name: 'Geprek', price: 20000, daily_stock: 2, is_active: true },
  { id: 4, tenant_id: 2, name: 'Nonaktif', price: 1000, daily_stock: 9, is_active: false },
];

describe('aturan bisnis checkout', () => {
  it('menolak checkout bila qty melebihi stok (stok tidak boleh minus)', () => {
    expect(() => buildCheckoutPlan([{ menu_id: 3, quantity: 3 }], menus)).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_STOCK' })
    );
  });

  it('mengizinkan checkout tepat sebesar stok dan mengurangi stok sejumlah qty', () => {
    const plan = buildCheckoutPlan([{ menu_id: 3, quantity: 2 }], menus);
    expect(plan.stockUpdates).toEqual([{ menuId: 3, quantity: 2 }]);
  });

  it('menggabungkan baris menu yang sama sebelum cek stok', () => {
    expect(() =>
      buildCheckoutPlan([{ menu_id: 3, quantity: 1 }, { menu_id: 3, quantity: 2 }], menus)
    ).toThrow(expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }));
  });

  it('menghitung total di server dari harga DB, mengabaikan price/total dari klien', () => {
    const cart = [
      { menu_id: 1, quantity: 2, price: 1, total: 1, unit_price: 1 },
      { menu_id: 2, quantity: 3, subtotal: 1 },
    ];
    const plan = buildCheckoutPlan(cart, menus);
    expect(plan.orders).toHaveLength(1);
    expect(plan.orders[0].total_price).toBe(2 * 22000 + 3 * 5000);
    expect(plan.orders[0].items.map((i) => i.unit_price)).toEqual([22000, 5000]);
  });

  it('memecah keranjang multi-tenant menjadi satu order per tenant', () => {
    const plan = buildCheckoutPlan(
      [{ menu_id: 1, quantity: 1 }, { menu_id: 3, quantity: 1 }],
      menus
    );
    expect(plan.orders.map((o) => o.tenant_id).sort()).toEqual([1, 2]);
  });

  it('menolak menu tidak ada, nonaktif, qty <= 0, dan keranjang kosong', () => {
    expect(() => buildCheckoutPlan([{ menu_id: 99, quantity: 1 }], menus)).toThrow(
      expect.objectContaining({ code: 'MENU_NOT_FOUND' })
    );
    expect(() => buildCheckoutPlan([{ menu_id: 4, quantity: 1 }], menus)).toThrow(
      expect.objectContaining({ code: 'MENU_UNAVAILABLE' })
    );
    expect(() => buildCheckoutPlan([{ menu_id: 1, quantity: 0 }], menus)).toThrow(
      expect.objectContaining({ code: 'INVALID_QUANTITY' })
    );
    expect(() => buildCheckoutPlan([], menus)).toThrow(expect.objectContaining({ code: 'EMPTY_CART' }));
  });
});
