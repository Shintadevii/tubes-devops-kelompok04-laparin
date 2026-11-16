exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.string('booth', 20).nullable();
    table.text('description').nullable();
    table.boolean('is_open').notNullable().defaultTo(true);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('booth');
    table.dropColumn('description');
    table.dropColumn('is_open');
  });
};