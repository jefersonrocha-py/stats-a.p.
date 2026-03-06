#!/bin/sh
set -eu

echo "Applying database schema..."
node scripts/init-db.mjs

if [ -n "${SUPERADMIN_EMAIL:-}" ] && [ -n "${SUPERADMIN_PASSWORD:-}" ]; then
  echo "Ensuring superadmin user exists..."
  node scripts/seed-superadmin.mjs
fi

echo "Starting Next.js on ${HOST:-0.0.0.0}:${PORT:-3000}"
exec npm run start -- -H "${HOST:-0.0.0.0}" -p "${PORT:-3000}"
