const path = require('path');
const express = require('express');
const healthRouter = require('./routes/health');
const tenantsRouter = require('./routes/tenants');
const menusRouter = require('./routes/menus');
const ordersRouter = require('./routes/orders');
const { toHttpError } = require('./utils/httpError');

const app = express();

app.use(express.json());
app.use('/health', healthRouter);

app.use('/api/tenants', tenantsRouter);
app.use('/api/menus', menusRouter);
app.use('/api/orders', ordersRouter);

// Tampilan web (HTML/CSS/JS statis)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Endpoint tidak ditemukan' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const e = toHttpError(err);
  const status = e.status || 500;
  if (status >= 500) console.error(err);
  const body = {
    status: 'error',
    message: status < 500 ? e.message : 'Terjadi kesalahan pada server',
  };
  if (e.code && status < 500) body.code = e.code;
  if (e.details && status < 500) body.details = e.details;
  res.status(status).json(body);
});

module.exports = app;
