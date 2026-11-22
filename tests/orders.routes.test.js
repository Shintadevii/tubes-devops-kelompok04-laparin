const request = require('supertest');

jest.mock('../src/db', () => ({ raw: jest.fn() }));
jest.mock('../src/services/orderService');

const orderService = require('../src/services/orderService');
const app = require('../src/app');

afterEach(() => jest.clearAllMocks());

describe('POST /api/orders/checkout', () => {
  it('hanya meneruskan menu_id & quantity ke service (total dari klien diabaikan)', async () => {
    orderService.checkout.mockResolvedValueOnce([{ id: 1, total_price: 44000, items: [] }]);

    const res = await request(app)
      .post('/api/orders/checkout')
      .send({
        customer_name: 'Budi',
        total: 1,
        total_price: 1,
        items: [{ menu_id: 1, quantity: 2, price: 1, subtotal: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.grand_total).toBe(44000);
    expect(orderService.checkout).toHaveBeenCalledWith({
      customerName: 'Budi',
      items: [{ menu_id: 1, quantity: 2 }],
    });
  });

  it('400 untuk keranjang kosong dan nama pelanggan kosong', async () => {
    const r1 = await request(app).post('/api/orders/checkout').send({ customer_name: 'Budi', items: [] });
    expect(r1.status).toBe(400);
    expect(r1.body.code).toBe('EMPTY_CART');
    const r2 = await request(app).post('/api/orders/checkout').send({ items: [{ menu_id: 1, quantity: 1 }] });
    expect(r2.status).toBe(400);
    expect(orderService.checkout).not.toHaveBeenCalled();
  });

  it('409 saat stok tidak cukup', async () => {
    orderService.checkout.mockRejectedValueOnce(
      Object.assign(new Error('Stok "Geprek" tidak cukup'), { code: 'INSUFFICIENT_STOCK' })
    );
    const res = await request(app)
      .post('/api/orders/checkout')
      .send({ customer_name: 'Budi', items: [{ menu_id: 3, quantity: 99 }] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });
});

describe('PATCH /api/tenants/:id/orders/:id/status', () => {
  it('409 untuk lompatan status (PENDING -> SELESAI)', async () => {
    orderService.changeStatus.mockRejectedValueOnce(
      Object.assign(new Error('Status tidak boleh berpindah dari PENDING ke SELESAI'), {
        code: 'INVALID_STATUS_TRANSITION',
      })
    );
    const res = await request(app).patch('/api/tenants/1/orders/5/status').send({ status: 'SELESAI' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('400 untuk status tidak dikenal dan 200 untuk transisi valid', async () => {
    const bad = await request(app).patch('/api/tenants/1/orders/5/status').send({ status: 'TERBANG' });
    expect(bad.status).toBe(400);

    orderService.changeStatus.mockResolvedValueOnce({ id: 5, status: 'DIPROSES' });
    const ok = await request(app).patch('/api/tenants/1/orders/5/status').send({ status: 'DIPROSES' });
    expect(ok.status).toBe(200);
    expect(orderService.changeStatus).toHaveBeenCalledWith({ orderId: 5, tenantId: 1, newStatus: 'DIPROSES' });
  });
});
