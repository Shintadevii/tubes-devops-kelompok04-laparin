const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const orderService = require('../services/orderService');
const { isValidStatus } = require('../domain/orderStatus');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: await db('tenants').orderBy('id') });
}));

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const [row] = await db('tenants')
    .insert({
      name: v.requireString(b.name, 'name'),
      booth: v.optionalString(b.booth, 'booth', 20),
      description: v.optionalString(b.description, 'description'),
      is_open: b.is_open === undefined ? true : v.optionalBool(b.is_open, 'is_open'),
    })
    .returning('*');
  res.status(201).json({ data: row });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = await db('tenants').where('id', v.parseId(req.params.id)).first();
  if (!row) throw new HttpError(404, 'Tenant tidak ditemukan', 'NOT_FOUND');
  res.json({ data: row });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = v.parseId(req.params.id);
  const b = req.body || {};
  const patch = { updated_at: db.fn.now() };
  if (b.name !== undefined) patch.name = v.requireString(b.name, 'name');
  if (b.booth !== undefined) patch.booth = v.optionalString(b.booth, 'booth', 20);
  if (b.description !== undefined) patch.description = v.optionalString(b.description, 'description');
  if (b.is_open !== undefined) patch.is_open = v.optionalBool(b.is_open, 'is_open');
  const [row] = await db('tenants').where('id', id).update(patch).returning('*');
  if (!row) throw new HttpError(404, 'Tenant tidak ditemukan', 'NOT_FOUND');
  res.json({ data: row });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const n = await db('tenants').where('id', v.parseId(req.params.id)).del();
  if (!n) throw new HttpError(404, 'Tenant tidak ditemukan', 'NOT_FOUND');
  res.status(204).end();
}));

// ---- Menu milik tenant ----
router.get('/:tenantId/menus', asyncHandler(async (req, res) => {
  const tenantId = v.parseId(req.params.tenantId, 'tenantId');
  const q = db('menus').where('tenant_id', tenantId).orderBy('id');
  if (req.query.all !== '1') q.andWhere('is_active', true);
  res.json({ data: await q });
}));

router.post('/:tenantId/menus', asyncHandler(async (req, res) => {
  const tenantId = v.parseId(req.params.tenantId, 'tenantId');
  const tenant = await db('tenants').where('id', tenantId).first();
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan', 'NOT_FOUND');
  const b = req.body || {};
  const [row] = await db('menus')
    .insert({
      tenant_id: tenantId,
      name: v.requireString(b.name, 'name'),
      description: v.optionalString(b.description, 'description'),
      price: v.nonNegativeInt(b.price, 'price'),
      daily_stock: b.daily_stock === undefined ? 0 : v.nonNegativeInt(b.daily_stock, 'daily_stock'),
      is_active: b.is_active === undefined ? true : v.optionalBool(b.is_active, 'is_active'),
    })
    .returning('*');
  res.status(201).json({ data: row });
}));

// ---- Order milik tenant (tenant hanya melihat/mengubah order miliknya) ----
router.get('/:tenantId/orders', asyncHandler(async (req, res) => {
  const tenantId = v.parseId(req.params.tenantId, 'tenantId');
  const { status } = req.query;
  if (status && !isValidStatus(status)) throw new HttpError(400, 'Filter status tidak dikenal', 'INVALID_STATUS');
  res.json({ data: await orderService.listTenantOrders(tenantId, status) });
}));

router.patch('/:tenantId/orders/:orderId/status', asyncHandler(async (req, res) => {
  const tenantId = v.parseId(req.params.tenantId, 'tenantId');
  const orderId = v.parseId(req.params.orderId, 'orderId');
  const newStatus = req.body && req.body.status;
  if (typeof newStatus !== 'string' || !isValidStatus(newStatus)) {
    throw new HttpError(400, 'status tidak valid', 'INVALID_STATUS');
  }
  res.json({ data: await orderService.changeStatus({ orderId, tenantId, newStatus }) });
}));

module.exports = router;
