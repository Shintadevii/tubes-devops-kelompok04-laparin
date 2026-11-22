const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const orderService = require('../services/orderService');
const { STATUS } = require('../domain/orderStatus');

const router = express.Router();

/**
 * Checkout. Body: { customer_name, items: [{ menu_id, quantity }] }
 * Field lain (price, total, dst.) DIABAIKAN: harga & total dihitung server dari DB.
 */
router.post('/checkout', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const customerName = v.requireString(b.customer_name, 'customer_name');
  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw new HttpError(400, 'Keranjang kosong', 'EMPTY_CART');
  }
  // hanya teruskan menu_id & quantity
  const items = b.items.map((i) => ({ menu_id: i && i.menu_id, quantity: i && i.quantity }));
  const orders = await orderService.checkout({ customerName, items });
  res.status(201).json({
    data: orders,
    grand_total: orders.reduce((s, o) => s + o.total_price, 0),
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ data: await orderService.getOrder(v.parseId(req.params.id)) });
}));

// Pelanggan membatalkan pesanan (hanya jika masih PENDING).
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const orderId = v.parseId(req.params.id);
  res.json({ data: await orderService.changeStatus({ orderId, newStatus: STATUS.DIBATALKAN }) });
}));

module.exports = router;
