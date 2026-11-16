const express = require('express');
const healthRouter = require('./routes/health');

const app = express();

app.use(express.json());
app.use('/health', healthRouter);

// Endpoint bisnis (tenant, menu, cart, order) didaftarkan di sini pada PR fitur berikutnya.

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Endpoint tidak ditemukan' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: status < 500 ? err.message : 'Terjadi kesalahan pada server',
  });
});

module.exports = app;