exports.up = function (knex) {
  return knex.schema.createTable('menus', (table) => {
    table.increments('id').primary();
    table
      .integer('tenant_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.integer('price').notNullable();
    table.integer('daily_stock').notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['tenant_id', 'name']);
    table.index('tenant_id');
    // Pengaman terakhir di level database: harga & stok tidak boleh minus.
    table.check('?? >= 0', ['price'], 'menus_price_non_negative');
    table.check('?? >= 0', ['daily_stock'], 'menus_daily_stock_non_negative');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('menus');
};