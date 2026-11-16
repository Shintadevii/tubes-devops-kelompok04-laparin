const tenants = [
  { name: 'Warung Nusantara' },
  { name: 'Ayam Geprek Juara' },
  { name: 'Bakso Pak Kumis' },
];

exports.seed = async function (knex) {
  const names = tenants.map((tenant) => tenant.name);
  const existing = await knex('tenants').whereIn('name', names).pluck('name');
  const missing = tenants.filter((tenant) => !existing.includes(tenant.name));

  if (missing.length > 0) {
    await knex('tenants').insert(missing);
  }
};