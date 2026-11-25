#!/bin/sh
set -e

npx knex migrate:latest

exec node src/server.js
