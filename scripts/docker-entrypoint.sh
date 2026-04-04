#!/bin/sh
set -eu

echo "Applying database schema..."
node scripts/init-db.mjs

if [ "${SEED_SUPERADMIN_ON_STARTUP:-false}" = "true" ] && [ -n "${SUPERADMIN_EMAIL:-}" ] && [ -n "${SUPERADMIN_PASSWORD:-}" ]; then
  echo "Ensuring superadmin user exists..."
  node scripts/seed-superadmin.mjs
else
  echo "Skipping automatic superadmin seed."
fi

echo "Starting Next.js on ${HOST:-0.0.0.0}:${PORT:-3000}"
export HOSTNAME="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec node server.js
