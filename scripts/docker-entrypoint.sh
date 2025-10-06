#!/bin/sh
set -e

echo "▶️  DATABASE_URL=$DATABASE_URL"
npx prisma migrate deploy || npx prisma db push

# 🔐 seed de superadmin (se variáveis existirem)
if [ -n "$SUPERADMIN_EMAIL" ] && [ -n "$SUPERADMIN_PASSWORD" ]; then
  echo "🔐 seeding superadmin..."
  node scripts/seed-superadmin.mjs || true
fi

echo "🚀 starting Next.js on port ${PORT:-3000}"
npm run start -- -p ${PORT:-3000}
