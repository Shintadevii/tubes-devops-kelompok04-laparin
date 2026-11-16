exports.up = function (knex) {
  return knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary();
    table
      .integer('order_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('orders')
      .onDelete('CASCADE');
    table
      .integer('menu_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('menus')
      .onDelete('RESTRICT');
    // Snapshot nama & harga saat checkout, supaya riwayat tidak berubah jika menu diedit.
    table.string('menu_name').notNullable();
    table.integer('unit_price').notNullable();
    table.integer('quantity').notNullable();
    table.integer('subtotal').notNullable();
    table.timestamps(true, true);

    table.index('order_id');
    table.check('?? > 0', ['quantity'], 'order_items_quantity_positive');
    table.check('?? >= 0', ['unit_price'], 'order_items_price_non_negative');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('order_items');
};