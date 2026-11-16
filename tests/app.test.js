const request = require('supertest');

jest.mock('../src/db', () => ({ raw: jest.fn() }));

const app = require('../src/app');

describe('penanganan error aplikasi', () => {
  it('mengembalikan 404 JSON untuk endpoint yang tidak ada', async () => {
    const res = await request(app).get('/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  it('mengembalikan 400 JSON untuk body JSON yang rusak', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{rusak');
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});