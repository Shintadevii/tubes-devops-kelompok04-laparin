#!/bin/sh
set -e

echo "Menjalankan migrasi database..."
npx knex migrate:latest

echo "Memulai aplikasi Laparin..."
exec "$@"