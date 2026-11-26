/**
 * Test integrasi dengan PostgreSQL ASLI. Dilewati otomatis kecuali RUN_DB_TESTS=1
 * (supaya `npm test` di Jenkins/Docker tanpa DB tetap hijau).
 *   RUN_DB_TESTS=1 POSTGRES_DB=laparin_test npm test -- integration
 */
const run = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

run('alur checkout & status (PostgreSQL)', () => {
  const request = require('supertest');
  let app; let db; let tenantId; let menuId;

  beforeAll(async () => {
    db = require('../../src/db');
    await db.migrate.latest();
    app = require('../../src/app');
    const t = await request(app).post('/api/tenants').send({ name: `T-${Date.now()}` });
    tenantId = t.body.data.id;
    const m = await request(app).post(`/api/tenants/${tenantId}/menus`).send({ name: 'Uji', price: 10000, daily_stock: 5 });
    menuId = m.body.data.id;
  });
  afterAll(async () => { await db.destroy(); });

  it('stok berkurang saat checkout, total dari server, stok tak boleh minus', async () => {
    const ok = await request(app).post('/api/orders/checkout').send({
      customer_name: 'Ani', items: [{ menu_id: menuId, quantity: 2, price: 1 }], total: 1,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data[0].total_price).toBe(20000);
    expect((await request(app).get(`/api/menus/${menuId}`)).body.data.daily_stock).toBe(3);

    const over = await request(app).post('/api/orders/checkout').send({
      customer_name: 'Ani', items: [{ menu_id: menuId, quantity: 4 }],
    });
    expect(over.status).toBe(409);
    expect((await request(app).get(`/api/menus/${menuId}`)).body.data.daily_stock).toBe(3);
  });

  it('status berurutan, lompatan ditolak, batal mengembalikan stok, tenant lain tak bisa akses', async () => {
    const o = await request(app).post('/api/orders/checkout').send({
      customer_name: 'Budi', items: [{ menu_id: menuId, quantity: 1 }],
    });
    const id = o.body.data[0].id;
    const patch = (tid, status) => request(app).patch(`/api/tenants/${tid}/orders/${id}/status`).send({ status });

    expect((await patch(tenantId, 'SELESAI')).status).toBe(409);
    expect((await patch(tenantId + 9999, 'DIPROSES')).status).toBe(404);
    expect((await patch(tenantId, 'DIPROSES')).status).toBe(200);
    expect((await request(app).post(`/api/orders/${id}/cancel`)).status).toBe(409);
    expect((await patch(tenantId, 'SIAP')).status).toBe(200);
    expect((await patch(tenantId, 'SELESAI')).status).toBe(200);
  });

  it('pembatalan saat PENDING mengembalikan stok', async () => {
    const before = (await request(app).get(`/api/menus/${menuId}`)).body.data.daily_stock;
    const o = await request(app).post('/api/orders/checkout').send({
      customer_name: 'Cici', items: [{ menu_id: menuId, quantity: 1 }],
    });
    expect((await request(app).post(`/api/orders/${o.body.data[0].id}/cancel`)).status).toBe(200);
    expect((await request(app).get(`/api/menus/${menuId}`)).body.data.daily_stock).toBe(before);
  });
});
