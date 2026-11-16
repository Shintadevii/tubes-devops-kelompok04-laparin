require('dotenv').config();

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'laparin',
  password: process.env.POSTGRES_PASSWORD || 'laparin',
  database: process.env.POSTGRES_DB || 'laparin',
};

const config = {
  client: 'pg',
  connection,
  migrations: {
    directory: './db/migrations',
  },
  seeds: {
    directory: './db/seeds',
  },
};

module.exports = {
  development: config,
  test: config,
  production: config,
};