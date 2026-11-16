const menusByTenant = {
  'Warung Nusantara': [
    { name: 'Nasi Goreng Spesial', description: 'Nasi goreng telur dan ayam suwir', price: 22000, daily_stock: 30 },
    { name: 'Soto Ayam', description: 'Soto ayam kuah kuning dengan nasi', price: 18000, daily_stock: 25 },
    { name: 'Es Teh Manis', description: 'Teh manis dingin', price: 5000, daily_stock: 60 },
  ],
  'Ayam Geprek Juara': [
    { name: 'Ayam Geprek Level 1', description: 'Ayam crispy sambal level 1', price: 20000, daily_stock: 40 },
    { name: 'Ayam Geprek Level 5', description: 'Ayam crispy sambal level 5', price: 22000, daily_stock: 30 },
    { name: 'Es Jeruk', description: 'Jeruk peras dingin', price: 7000, daily_stock: 50 },
  ],
  'Bakso Pak Kumis': [
    { name: 'Bakso Urat', description: 'Bakso urat kuah sapi', price: 20000, daily_stock: 35 },
    { name: 'Mie Ayam Bakso', description: 'Mie ayam dengan 3 bakso', price: 17000, daily_stock: 30 },
    { name: 'Es Campur', description: 'Es campur segar', price: 12000, daily_stock: 20 },
  ],
};

exports.seed = async function (knex) {
  const tenants = await knex('tenants').select('id', 'name');

  for (const tenant of tenants) {
    const menus = menusByTenant[tenant.name];
    if (!menus) continue;

    const existing = await knex('menus').where({ tenant_id: tenant.id }).pluck('name');
    const missing = menus
      .filter((menu) => !existing.includes(menu.name))
      .map((menu) => ({ ...menu, tenant_id: tenant.id }));

    if (missing.length > 0) {
      await knex('menus').insert(missing);
    }
  }
};