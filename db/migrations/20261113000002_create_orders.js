exports.up = function (knex) {
  return knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table
      .integer('tenant_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('RESTRICT');
    table.string('customer_name').notNullable();
    table.string('status', 20).notNullable().defaultTo('PENDING');
    table.integer('total_price').notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.index(['tenant_id', 'status']);
    table.check(
      '?? in (\'PENDING\', \'DIPROSES\', \'SIAP\', \'SELESAI\', \'DIBATALKAN\')',
      ['status'],
      'orders_status_valid'
    );
    table.check('?? >= 0', ['total_price'], 'orders_total_non_negative');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('orders');
};