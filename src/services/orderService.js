const db = require('../db');
const { buildCheckoutPlan } = require('../domain/checkout');
const { assertTransition, STATUS } = require('../domain/orderStatus');
const { HttpError } = require('../utils/httpError');

async function attachItems(orders) {
  if (orders.length === 0) return orders;
  const items = await db('order_items')
    .whereIn('order_id', orders.map((o) => o.id))
    .orderBy('id');
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}

/**
 * Checkout: semua dalam satu transaksi.
 * Baris menu dikunci (FOR UPDATE) agar dua checkout bersamaan tidak membuat stok minus.
 */
async function checkout({ customerName, items }) {
  return db.transaction(async (trx) => {
    const menuIds = [...new Set((Array.isArray(items) ? items : []).map((i) => Number(i && i.menu_id)))]
      .filter((id) => Number.isInteger(id) && id > 0)
      .sort((a, b) => a - b); // urutan konsisten -> hindari deadlock

    const menus = menuIds.length
      ? await trx('menus').whereIn('id', menuIds).orderBy('id').forUpdate()
      : [];

    const plan = buildCheckoutPlan(items, menus);

    // Kurangi stok; klausa WHERE menjadi pengaman kedua agar tidak pernah minus.
    for (const { menuId, quantity } of plan.stockUpdates) {
      const affected = await trx('menus')
        .where('id', menuId)
        .andWhere('daily_stock', '>=', quantity)
        .update({ daily_stock: trx.raw('daily_stock - ?', [quantity]), updated_at: trx.fn.now() });
      if (affected !== 1) {
        throw Object.assign(new Error('Stok tidak mencukupi'), { code: 'INSUFFICIENT_STOCK' });
      }
    }

    const created = [];
    for (const o of plan.orders) {
      const [order] = await trx('orders')
        .insert({
          tenant_id: o.tenant_id,
          customer_name: customerName,
          status: STATUS.PENDING,
          total_price: o.total_price,
        })
        .returning('*');
      const rows = o.items.map((i) => ({ ...i, order_id: order.id }));
      const insertedItems = await trx('order_items').insert(rows).returning('*');
      created.push({ ...order, items: insertedItems });
    }
    return created;
  });
}

async function getOrder(orderId) {
  const order = await db('orders')
    .join('tenants', 'tenants.id', 'orders.tenant_id')
    .where('orders.id', orderId)
    .first('orders.*', 'tenants.name as tenant_name');
  if (!order) throw new HttpError(404, 'Order tidak ditemukan', 'NOT_FOUND');
  const [withItems] = await attachItems([order]);
  return withItems;
}

async function listTenantOrders(tenantId, status) {
  const q = db('orders').where('tenant_id', tenantId).orderBy('id', 'desc');
  if (status) q.andWhere('status', status);
  return attachItems(await q);
}

/**
 * Ubah status. Order wajib milik tenant yang bersangkutan (kalau tidak -> 404).
 * Jika dibatalkan, stok dikembalikan.
 */
async function changeStatus({ orderId, tenantId, newStatus }) {
  return db.transaction(async (trx) => {
    let q = trx('orders').where('id', orderId).forUpdate();
    if (tenantId !== undefined) q = q.andWhere('tenant_id', tenantId);
    const order = await q.first();
    if (!order) throw new HttpError(404, 'Order tidak ditemukan', 'NOT_FOUND');

    assertTransition(order.status, newStatus); // lompatan status ditolak

    const [updated] = await trx('orders')
      .where('id', orderId)
      .update({ status: newStatus, updated_at: trx.fn.now() })
      .returning('*');

    if (newStatus === STATUS.DIBATALKAN) {
      const items = await trx('order_items').where('order_id', orderId);
      for (const item of items) {
        await trx('menus')
          .where('id', item.menu_id)
          .update({ daily_stock: trx.raw('daily_stock + ?', [item.quantity]) });
      }
    }
    const [withItems] = await attachItems([updated]);
    return withItems;
  });
}

module.exports = { checkout, getOrder, listTenantOrders, changeStatus };
