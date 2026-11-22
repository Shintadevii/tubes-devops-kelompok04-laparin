const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const v = require('../utils/validate');

const router = express.Router();

// Katalog untuk pelanggan: semua menu aktif dari tenant yang buka.
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db('menus')
    .join('tenants', 'tenants.id', 'menus.tenant_id')
    .where('menus.is_active', true)
    .andWhere('tenants.is_open', true)
    .orderBy(['tenants.id', 'menus.id'])
    .select('menus.*', 'tenants.name as tenant_name', 'tenants.booth as tenant_booth');
  res.json({ data: rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = await db('menus').where('id', v.parseId(req.params.id)).first();
  if (!row) throw new HttpError(404, 'Menu tidak ditemukan', 'NOT_FOUND');
  res.json({ data: row });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = v.parseId(req.params.id);
  const b = req.body || {};
  const patch = { updated_at: db.fn.now() };
  if (b.name !== undefined) patch.name = v.requireString(b.name, 'name');
  if (b.description !== undefined) patch.description = v.optionalString(b.description, 'description');
  if (b.price !== undefined) patch.price = v.nonNegativeInt(b.price, 'price');
  if (b.daily_stock !== undefined) patch.daily_stock = v.nonNegativeInt(b.daily_stock, 'daily_stock');
  if (b.is_active !== undefined) patch.is_active = v.optionalBool(b.is_active, 'is_active');
  const [row] = await db('menus').where('id', id).update(patch).returning('*');
  if (!row) throw new HttpError(404, 'Menu tidak ditemukan', 'NOT_FOUND');
  res.json({ data: row });
}));

// Reset / set stok harian
router.patch('/:id/stock', asyncHandler(async (req, res) => {
  const id = v.parseId(req.params.id);
  const stock = v.nonNegativeInt(req.body && req.body.daily_stock, 'daily_stock');
  const [row] = await db('menus').where('id', id).update({ daily_stock: stock, updated_at: db.fn.now() }).returning('*');
  if (!row) throw new HttpError(404, 'Menu tidak ditemukan', 'NOT_FOUND');
  res.json({ data: row });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const n = await db('menus').where('id', v.parseId(req.params.id)).del();
  if (!n) throw new HttpError(404, 'Menu tidak ditemukan', 'NOT_FOUND');
  res.status(204).end();
}));

module.exports = router;
