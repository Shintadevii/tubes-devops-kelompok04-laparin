/* Laparin — tampilan web (vanilla JS, tanpa build step). Semua data lewat REST API /api/*. */
'use strict';

const $view = document.getElementById('view');
const NEXT = { PENDING: ['DIPROSES', 'DIBATALKAN'], DIPROSES: ['SIAP'], SIAP: ['SELESAI'], SELESAI: [], DIBATALKAN: [] };
const FLOW = ['PENDING', 'DIPROSES', 'SIAP', 'SELESAI'];
const ACTION_LABEL = { DIPROSES: 'Proses', SIAP: 'Tandai siap', SELESAI: 'Selesai', DIBATALKAN: 'Batalkan' };
const POLL_MS = 5000;
let pollTimer = null;

/* ---------- util ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } },
};

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Permintaan gagal (${res.status})`);
  return json;
}

let toastTimer;
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}
const fail = (e) => toast(e.message, true);

function startPolling(fn) { stopPolling(); pollTimer = setInterval(fn, POLL_MS); }
function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

/* dialog form generik */
function openForm({ title, fields, values = {}, submitLabel = 'Simpan', onSubmit }) {
  const dlg = document.getElementById('dlg');
  const form = document.getElementById('dlgForm');
  form.innerHTML = `<h2>${esc(title)}</h2>` + fields.map((f) => {
    const v = values[f.name];
    if (f.type === 'checkbox') {
      return `<div class="field row"><input type="checkbox" id="f_${f.name}" name="${f.name}" ${v ?? f.default ? 'checked' : ''}><label for="f_${f.name}">${esc(f.label)}</label></div>`;
    }
    const input = f.type === 'textarea'
      ? `<textarea id="f_${f.name}" name="${f.name}" rows="3">${esc(v ?? '')}</textarea>`
      : `<input id="f_${f.name}" name="${f.name}" type="${f.type || 'text'}" ${f.min !== undefined ? `min="${f.min}"` : ''} value="${esc(v ?? '')}" ${f.required ? 'required' : ''}>`;
    return `<div class="field"><label for="f_${f.name}">${esc(f.label)}</label>${input}</div>`;
  }).join('') + `<div class="err" id="dlgErr"></div>
    <div class="dlg-actions"><button type="button" class="btn ghost" id="dlgCancel">Batal</button><button class="btn primary">${esc(submitLabel)}</button></div>`;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const data = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      if (f.type === 'checkbox') data[f.name] = el.checked;
      else if (f.type === 'number') data[f.name] = el.value === '' ? undefined : Number(el.value);
      else data[f.name] = el.value;
    }
    try { await onSubmit(data); dlg.close(); } catch (e) { document.getElementById('dlgErr').textContent = e.message; }
  };
  form.querySelector('#dlgCancel').onclick = () => dlg.close();
  dlg.showModal();
}

/* ---------- health ---------- */
async function checkHealth() {
  const el = document.getElementById('health');
  try {
    const r = await fetch('/health');
    const j = await r.json();
    el.className = 'health ' + (r.ok ? 'ok' : 'bad');
    el.textContent = `db: ${j.database}`;
  } catch { el.className = 'health bad'; el.textContent = 'server tidak terjangkau'; }
}

/* =====================================================================
   HALAMAN PESAN (pelanggan): katalog, keranjang, checkout, lacak order
   ===================================================================== */
const cart = new Map(store.get('laparin.cart', []).map(([id, l]) => [Number(id), l])); // menuId -> {menu, qty}
let menusCache = [];
let customerName = store.get('laparin.name', '');
let myOrderIds = store.get('laparin.orders', []);
let ticketsCache = [];

const saveCart = () => store.set('laparin.cart', [...cart.entries()]);
const cartTotalEstimate = () => [...cart.values()].reduce((s, l) => s + l.menu.price * l.qty, 0);

async function renderPesan() {
  $view.innerHTML = '<h1 class="page-title">Mau makan apa hari ini?</h1><p class="lede">Pilih menu dari beberapa tenant sekaligus. Pesanan dipecah per tenant, dan stok harian diperiksa saat checkout.</p><div id="pesanBody">Memuat menu…</div>';
  try { menusCache = (await api('GET', '/api/menus')).data; } catch (e) { fail(e); $view.querySelector('#pesanBody').textContent = 'Gagal memuat menu.'; return; }
  // buang item keranjang yang menunya sudah hilang/nonaktif
  for (const id of [...cart.keys()]) if (!menusCache.find((m) => m.id === id)) cart.delete(id);
  await loadTickets();
  drawPesan();
  startPolling(async () => { await loadTickets(); drawTickets(); });
}

function drawPesan() {
  const byTenant = new Map();
  for (const m of menusCache) {
    if (!byTenant.has(m.tenant_id)) byTenant.set(m.tenant_id, { name: m.tenant_name, booth: m.tenant_booth, menus: [] });
    byTenant.get(m.tenant_id).menus.push(m);
  }
  const booths = [...byTenant.values()].map((t) => `
    <section class="booth">
      <div class="booth-sign">${t.booth ? `<span class="no">${esc(t.booth)}</span>` : ''}<h2>${esc(t.name)}</h2></div>
      <div class="menu-list">${t.menus.map(menuRow).join('')}</div>
    </section>`).join('') || '<p class="empty">Belum ada menu tersedia.</p>';

  $view.querySelector('#pesanBody').innerHTML = `
    <div class="order-layout">
      <div>${booths}</div>
      <aside>${receiptHTML()}</aside>
    </div>
    <section class="tickets" id="tickets"></section>`;
  bindPesan();
  drawTickets();
}

function menuRow(m) {
  const inCart = cart.get(m.id)?.qty || 0;
  const left = m.daily_stock - inCart;
  const cls = m.daily_stock === 0 ? 'out' : m.daily_stock <= 5 ? 'low' : '';
  return `<div class="menu-row">
    <div><div class="menu-name">${esc(m.name)}</div><div class="menu-desc">${esc(m.description || '')}</div></div>
    <div style="text-align:right"><div class="price">${rupiah(m.price)}</div><span class="stock ${cls}">${m.daily_stock === 0 ? 'habis' : 'stok ' + m.daily_stock}</span></div>
    <div class="menu-actions"><button class="btn small" data-add="${m.id}" ${left <= 0 ? 'disabled' : ''}>${m.daily_stock === 0 ? 'Habis' : 'Tambah'}</button></div>
  </div>`;
}

function receiptHTML() {
  const lines = [...cart.values()];
  const body = lines.length ? lines.map(({ menu, qty }) => `
    <div class="line">
      <span class="nm">${esc(menu.name)}</span><span>${rupiah(menu.price * qty)}</span>
      <span class="tenant">${esc(menu.tenant_name)}</span>
      <span class="qty"><button data-dec="${menu.id}" aria-label="Kurangi ${esc(menu.name)}">−</button>${qty}<button data-inc="${menu.id}" aria-label="Tambah ${esc(menu.name)}" ${qty >= menu.daily_stock ? 'disabled' : ''}>+</button></span>
      <button class="btn danger small" data-del="${menu.id}">Hapus</button>
    </div>`).join('') : '<p class="empty">Keranjang masih kosong.</p>';
  return `<div class="receipt">
    <h2>Keranjang</h2><div class="sub">struk sementara</div>
    <hr>${body}<hr>
    <div class="total-row"><span>Estimasi</span><span>${rupiah(cartTotalEstimate())}</span></div>
    <p class="note">Total final dihitung ulang oleh server dari harga terbaru.</p>
    <label for="cust">Nama pemesan</label>
    <input type="text" id="cust" maxlength="100" value="${esc(customerName)}" placeholder="mis. Budi">
    <button class="btn primary" id="btnCheckout" ${lines.length ? '' : 'disabled'}>Checkout</button>
  </div>`;
}

function redrawReceiptAndMenus() {
  // gambar ulang seluruh bagian atas tanpa fetch ulang; tiket dipertahankan
  drawPesan();
}

function bindPesan() {
  const root = $view;
  root.querySelectorAll('[data-add],[data-inc]').forEach((b) => b.onclick = () => {
    const id = Number(b.dataset.add || b.dataset.inc);
    const menu = menusCache.find((m) => m.id === id);
    const cur = cart.get(id)?.qty || 0;
    if (cur >= menu.daily_stock) return toast('Stok tidak cukup', true);
    cart.set(id, { menu, qty: cur + 1 });
    saveCart(); redrawReceiptAndMenus();
  });
  root.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => {
    const id = Number(b.dataset.dec); const l = cart.get(id);
    if (l.qty <= 1) cart.delete(id); else l.qty -= 1;
    saveCart(); redrawReceiptAndMenus();
  });
  root.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { cart.delete(Number(b.dataset.del)); saveCart(); redrawReceiptAndMenus(); });
  const cust = root.querySelector('#cust');
  if (cust) cust.oninput = () => { customerName = cust.value; store.set('laparin.name', customerName); };
  const btn = root.querySelector('#btnCheckout');
  if (btn) btn.onclick = checkout;
}

async function checkout() {
  const name = customerName.trim();
  if (!name) { toast('Isi nama pemesan dulu', true); document.getElementById('cust').focus(); return; }
  const btn = document.getElementById('btnCheckout');
  btn.disabled = true;
  try {
    // Hanya kirim menu_id & quantity — harga/total TIDAK dikirim, server yang menghitung.
    const res = await api('POST', '/api/orders/checkout', {
      customer_name: name,
      items: [...cart.entries()].map(([menu_id, l]) => ({ menu_id, quantity: l.qty })),
    });
    myOrderIds = [...res.data.map((o) => o.id), ...myOrderIds].slice(0, 30);
    store.set('laparin.orders', myOrderIds);
    cart.clear(); saveCart();
    toast(`Checkout berhasil — ${res.data.length} pesanan, total ${rupiah(res.grand_total)}`);
    menusCache = (await api('GET', '/api/menus')).data; // stok terbaru
    await loadTickets();
    drawPesan();
  } catch (e) {
    fail(e);
    // stok mungkin berubah; segarkan katalog agar pelanggan melihat kondisi terbaru
    try { menusCache = (await api('GET', '/api/menus')).data; for (const [id, l] of cart) { const m = menusCache.find((x) => x.id === id); if (!m) cart.delete(id); else { l.menu = m; l.qty = Math.min(l.qty, m.daily_stock); if (l.qty <= 0) cart.delete(id); } } saveCart(); drawPesan(); } catch { /* abaikan */ }
  }
}

async function loadTickets() {
  const out = [];
  for (const id of myOrderIds) {
    try { out.push((await api('GET', `/api/orders/${id}`)).data); } catch { /* order tak ditemukan */ }
  }
  ticketsCache = out;
}

function drawTickets() {
  const el = document.getElementById('tickets');
  if (!el) return;
  el.innerHTML = `<h2>Pesanan saya</h2>
    <div class="track"><input type="text" id="trackId" inputmode="numeric" placeholder="No. pesanan" aria-label="Nomor pesanan"><button class="btn ghost" id="trackBtn">Lacak</button></div>
    <div class="ticket-grid">${ticketsCache.map(ticketHTML).join('') || '<p class="empty">Belum ada pesanan.</p>'}</div>`;
  el.querySelector('#trackBtn').onclick = () => {
    const id = Number(el.querySelector('#trackId').value);
    if (!Number.isInteger(id) || id <= 0) return toast('Nomor pesanan tidak valid', true);
    if (!myOrderIds.includes(id)) { myOrderIds.unshift(id); store.set('laparin.orders', myOrderIds); }
    loadTickets().then(() => { if (!ticketsCache.find((t) => t.id === id)) toast('Pesanan tidak ditemukan', true); drawTickets(); });
  };
  el.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = async () => {
    if (!confirm('Batalkan pesanan ini?')) return;
    try { await api('POST', `/api/orders/${b.dataset.cancel}/cancel`); toast('Pesanan dibatalkan, stok dikembalikan'); menusCache = (await api('GET', '/api/menus')).data; await loadTickets(); drawPesan(); } catch (e) { fail(e); }
  });
}

function stepperHTML(status) {
  if (status === 'DIBATALKAN') return '<div class="cancelled">Pesanan dibatalkan</div>';
  const idx = FLOW.indexOf(status);
  return `<ol class="steps">${FLOW.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'done now' : ''}">${s.charAt(0) + s.slice(1).toLowerCase()}</li>`).join('')}</ol>`;
}

function ticketHTML(o) {
  return `<article class="ticket">
    <div class="ticket-head"><span class="id">#${o.id}</span><strong>${esc(o.tenant_name || '')}</strong></div>
    <div class="who">atas nama ${esc(o.customer_name)}</div>
    ${stepperHTML(o.status)}
    <ul class="items">${(o.items || []).map((i) => `<li><span>${i.quantity}× ${esc(i.menu_name)}</span><span>${rupiah(i.subtotal)}</span></li>`).join('')}</ul>
    <div class="sum"><span>Total</span><span>${rupiah(o.total_price)}</span></div>
    ${o.status === 'PENDING' ? `<button class="btn danger small" data-cancel="${o.id}">Batalkan pesanan</button>` : ''}
  </article>`;
}

/* =====================================================================
   HALAMAN DAPUR (tenant): daftar order per tenant + ubah status
   ===================================================================== */
let dapurTenant = store.get('laparin.dapurTenant', null);
let dapurFilter = '';

async function renderDapur() {
  let tenants;
  try { tenants = (await api('GET', '/api/tenants')).data; } catch (e) { fail(e); return; }
  if (!tenants.length) { $view.innerHTML = '<h1 class="page-title">Dapur tenant</h1><p class="lede">Belum ada tenant. Tambahkan dulu di halaman Kelola.</p>'; return; }
  if (!tenants.find((t) => t.id === dapurTenant)) dapurTenant = tenants[0].id;

  $view.innerHTML = `<h1 class="page-title">Dapur tenant</h1>
    <p class="lede">Hanya pesanan milik tenant terpilih yang tampil. Status hanya bisa maju berurutan; pembatalan hanya saat PENDING.</p>
    <div class="toolbar">
      <label for="selTenant"><strong>Tenant</strong></label>
      <select id="selTenant">${tenants.map((t) => `<option value="${t.id}" ${t.id === dapurTenant ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <div class="filters" id="filters"></div>
    </div>
    <div id="orderList" class="ticket-grid"></div>`;
  $view.querySelector('#selTenant').onchange = (e) => { dapurTenant = Number(e.target.value); store.set('laparin.dapurTenant', dapurTenant); loadDapur(); };
  const filters = $view.querySelector('#filters');
  filters.innerHTML = ['', ...Object.keys(NEXT)].map((s) => `<button data-f="${s}" class="${s === dapurFilter ? 'on' : ''}">${s || 'Semua'}</button>`).join('');
  filters.querySelectorAll('button').forEach((b) => b.onclick = () => { dapurFilter = b.dataset.f; filters.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); loadDapur(); });
  await loadDapur();
  startPolling(loadDapur);
}

async function loadDapur() {
  const list = document.getElementById('orderList');
  if (!list) return;
  try {
    const q = dapurFilter ? `?status=${dapurFilter}` : '';
    const orders = (await api('GET', `/api/tenants/${dapurTenant}/orders${q}`)).data;
    list.innerHTML = orders.map((o) => `
      <article class="ticket">
        <div class="ticket-head"><span class="id">#${o.id}</span><span class="badge ${o.status}">${o.status}</span></div>
        <div class="who">${esc(o.customer_name)} · ${new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
        <ul class="items">${o.items.map((i) => `<li><span>${i.quantity}× ${esc(i.menu_name)}</span><span>${rupiah(i.subtotal)}</span></li>`).join('')}</ul>
        <div class="sum"><span>Total</span><span>${rupiah(o.total_price)}</span></div>
        <div class="actions">${NEXT[o.status].map((s) => `<button class="btn small ${s === 'DIBATALKAN' ? 'danger' : 'primary'}" data-o="${o.id}" data-s="${s}">${ACTION_LABEL[s]}</button>`).join('') || '<span class="who">Status final</span>'}</div>
      </article>`).join('') || '<p class="empty">Tidak ada pesanan.</p>';
    list.querySelectorAll('[data-o]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { await api('PATCH', `/api/tenants/${dapurTenant}/orders/${b.dataset.o}/status`, { status: b.dataset.s }); toast(`Pesanan #${b.dataset.o} → ${b.dataset.s}`); loadDapur(); } catch (e) { fail(e); b.disabled = false; }
    });
  } catch (e) { fail(e); }
}

/* =====================================================================
   HALAMAN KELOLA: CRUD tenant & menu (harga, stok harian)
   ===================================================================== */
let kelolaTenant = null;

async function renderKelola() {
  let tenants;
  try { tenants = (await api('GET', '/api/tenants')).data; } catch (e) { fail(e); return; }
  if (!tenants.find((t) => t.id === kelolaTenant)) kelolaTenant = tenants[0]?.id ?? null;

  $view.innerHTML = `<h1 class="page-title">Kelola tenant &amp; menu</h1>
    <p class="lede">Tambah, ubah, atau hapus tenant dan menu. Stok harian bisa diatur per menu.</p>
    <div class="split">
      <div class="panel">
        <div class="panel-head"><h2>Tenant</h2><button class="btn small" id="addTenant">Tambah</button></div>
        <div>${tenants.map((t) => `<div class="tenant-item ${t.id === kelolaTenant ? 'sel' : ''}" data-t="${t.id}" tabindex="0" role="button">
          <div><strong>${esc(t.name)}</strong><div class="small">${esc(t.booth || 'tanpa booth')} · ${t.is_open ? 'buka' : 'tutup'}</div></div>
          <span class="actions"><button class="btn ghost small" data-te="${t.id}">Ubah</button><button class="btn danger small" data-td="${t.id}">Hapus</button></span>
        </div>`).join('') || '<p class="empty" style="padding:12px 16px">Belum ada tenant.</p>'}</div>
      </div>
      <div class="panel" id="menuPanel"></div>
    </div>`;

  $view.querySelector('#addTenant').onclick = () => tenantForm();
  $view.querySelectorAll('[data-t]').forEach((el) => {
    const pick = () => { kelolaTenant = Number(el.dataset.t); renderKelola(); };
    el.onclick = (e) => { if (!e.target.closest('button')) pick(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' && !e.target.closest('button')) pick(); };
  });
  $view.querySelectorAll('[data-te]').forEach((b) => b.onclick = () => tenantForm(tenants.find((t) => t.id === Number(b.dataset.te))));
  $view.querySelectorAll('[data-td]').forEach((b) => b.onclick = async () => {
    if (!confirm('Hapus tenant beserta menunya? (ditolak jika sudah punya pesanan)')) return;
    try { await api('DELETE', `/api/tenants/${b.dataset.td}`); toast('Tenant dihapus'); renderKelola(); } catch (e) { fail(e); }
  });
  await renderMenuPanel(tenants.find((t) => t.id === kelolaTenant));
}

function tenantForm(t) {
  openForm({
    title: t ? 'Ubah tenant' : 'Tenant baru',
    values: t || {},
    fields: [
      { name: 'name', label: 'Nama tenant', required: true },
      { name: 'booth', label: 'No. booth (mis. A1)' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
      { name: 'is_open', label: 'Sedang buka', type: 'checkbox', default: true },
    ],
    onSubmit: async (d) => { await (t ? api('PUT', `/api/tenants/${t.id}`, d) : api('POST', '/api/tenants', d)); toast('Tenant tersimpan'); renderKelola(); },
  });
}

async function renderMenuPanel(tenant) {
  const panel = document.getElementById('menuPanel');
  if (!tenant) { panel.innerHTML = '<p class="empty" style="padding:16px">Pilih atau tambahkan tenant.</p>'; return; }
  let menus;
  try { menus = (await api('GET', `/api/tenants/${tenant.id}/menus?all=1`)).data; } catch (e) { fail(e); return; }
  panel.innerHTML = `<div class="panel-head"><h2>Menu — ${esc(tenant.name)}</h2><button class="btn small" id="addMenu">Tambah menu</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Menu</th><th class="num">Harga</th><th class="num">Stok harian</th><th>Status</th><th></th></tr></thead>
      <tbody>${menus.map((m) => `<tr>
        <td><strong>${esc(m.name)}</strong><div class="menu-desc">${esc(m.description || '')}</div></td>
        <td class="num">${rupiah(m.price)}</td>
        <td class="num">${m.daily_stock}</td>
        <td>${m.is_active ? '<span class="badge SIAP">aktif</span>' : '<span class="badge">nonaktif</span>'}</td>
        <td><span class="actions"><button class="btn ghost small" data-me="${m.id}">Ubah</button><button class="btn danger small" data-md="${m.id}">Hapus</button></span></td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty">Belum ada menu.</td></tr>'}</tbody>
    </table></div>`;
  panel.querySelector('#addMenu').onclick = () => menuForm(tenant, null);
  panel.querySelectorAll('[data-me]').forEach((b) => b.onclick = () => menuForm(tenant, menus.find((m) => m.id === Number(b.dataset.me))));
  panel.querySelectorAll('[data-md]').forEach((b) => b.onclick = async () => {
    if (!confirm('Hapus menu ini? Jika sudah pernah dipesan, nonaktifkan saja.')) return;
    try { await api('DELETE', `/api/menus/${b.dataset.md}`); toast('Menu dihapus'); renderKelola(); } catch (e) { fail(e); }
  });
}

function menuForm(tenant, m) {
  openForm({
    title: m ? 'Ubah menu' : `Menu baru — ${tenant.name}`,
    values: m || {},
    fields: [
      { name: 'name', label: 'Nama menu', required: true },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
      { name: 'price', label: 'Harga (Rp)', type: 'number', min: 0, required: true },
      { name: 'daily_stock', label: 'Stok harian', type: 'number', min: 0, required: true },
      { name: 'is_active', label: 'Aktif dijual', type: 'checkbox', default: true },
    ],
    onSubmit: async (d) => { await (m ? api('PUT', `/api/menus/${m.id}`, d) : api('POST', `/api/tenants/${tenant.id}/menus`, d)); toast('Menu tersimpan'); renderKelola(); },
  });
}

/* ---------- router ---------- */
const routes = { pesan: renderPesan, dapur: renderDapur, kelola: renderKelola };
function route() {
  stopPolling();
  const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const key = routes[name] ? name : 'pesan';
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
  routes[key]();
}
window.addEventListener('hashchange', route);
route();
checkHealth();
setInterval(checkHealth, 30000);
