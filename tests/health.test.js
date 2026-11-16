const request = require('supertest');

jest.mock('../src/db', () => ({
  raw: jest.fn(),
}));

const db = require('../src/db');
const app = require('../src/app');

describe('GET /health', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('mengembalikan 200 ketika database terhubung', async () => {
    db.raw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    expect(db.raw).toHaveBeenCalledWith('SELECT 1');
  });

  it('mengembalikan 503 ketika koneksi database gagal', async () => {
    db.raw.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      database: 'disconnected',
    });
  });
});