const { validateQuantity, calculateOrderTotal } = require('./pricing');

function domainError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

/**
 * Menyusun rencana checkout dari isi keranjang + data menu yang dibaca dari DB.
 * Fungsi murni (tanpa I/O) supaya aturan bisnisnya mudah dites.
 *
 * Aturan:
 *  - qty harus bilangan bulat > 0
 *  - menu harus ada & aktif
 *  - stok tidak boleh minus: qty > stok => ditolak
 *  - harga/total SELALU dari DB (field price/total dari klien diabaikan)
 *  - 1 order = 1 tenant, keranjang multi-tenant dipecah per tenant
 *
 * @param {Array<{menu_id:number, quantity:number}>} cartItems
 * @param {Array<{id,tenant_id,name,price,daily_stock,is_active}>} menus data dari DB
 * @returns {{orders: Array, stockUpdates: Array<{menuId:number, quantity:number}>}}
 */
function buildCheckoutPlan(cartItems, menus) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw domainError('EMPTY_CART', 'Keranjang kosong');
  }

  // Gabungkan baris yang menu-nya sama agar pengecekan stok akurat.
  const qtyByMenu = new Map();
  for (const item of cartItems) {
    const quantity = validateQuantity(item && item.quantity);
    const menuId = Number(item && item.menu_id);
    if (!Number.isInteger(menuId) || menuId <= 0) {
      throw domainError('VALIDATION_ERROR', 'menu_id tidak valid');
    }
    qtyByMenu.set(menuId, (qtyByMenu.get(menuId) || 0) + quantity);
  }

  const menuById = new Map(menus.map((m) => [m.id, m]));
  const byTenant = new Map();
  const stockUpdates = [];

  for (const [menuId, quantity] of qtyByMenu) {
    const menu = menuById.get(menuId);
    if (!menu) throw domainError('MENU_NOT_FOUND', `Menu #${menuId} tidak ditemukan`);
    if (!menu.is_active) {
      throw domainError('MENU_UNAVAILABLE', `Menu "${menu.name}" sedang tidak tersedia`);
    }
    if (quantity > menu.daily_stock) {
      throw domainError(
        'INSUFFICIENT_STOCK',
        `Stok "${menu.name}" tidak cukup (tersisa ${menu.daily_stock}, diminta ${quantity})`,
        { menu_id: menuId, available: menu.daily_stock, requested: quantity }
      );
    }

    if (!byTenant.has(menu.tenant_id)) byTenant.set(menu.tenant_id, []);
    byTenant.get(menu.tenant_id).push({
      menu_id: menu.id,
      menu_name: menu.name,
      unit_price: menu.price,
      quantity,
      subtotal: menu.price * quantity,
    });
    stockUpdates.push({ menuId, quantity });
  }

  const orders = [...byTenant.entries()].map(([tenantId, items]) => ({
    tenant_id: tenantId,
    items,
    total_price: calculateOrderTotal(items.map((i) => ({ unitPrice: i.unit_price, quantity: i.quantity }))),
  }));

  return { orders, stockUpdates };
}

module.exports = { buildCheckoutPlan };
