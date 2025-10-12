# ---------- Base: Node 20 ----------
FROM node:20-alpine AS base
ENV NODE_ENV=production
WORKDIR /app

# ---------- Builder ----------
FROM base AS builder
# Instala dependências nativas mínimas (se alguma lib precisar)
RUN apk add --no-cache python3 make g++ openssl

# Copia manifestos e instala deps em modo "clean"
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do projeto e gera o build
COPY . .
# Gera o client do Prisma e o build do Next
RUN npx prisma generate
RUN npm run build

# Remove dependências de dev para otimizar a imagem final
RUN npm prune --omit=dev

# ---------- Runner ----------
FROM base AS runner
# Runtime mínimo
RUN apk add --no-cache openssl curl

WORKDIR /app

# Copia apenas o necessário do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
# (Se você usa mapas/estilos locais)
COPY --from=builder /app/styles ./styles

# Porta do Next
ENV HOST=0.0.0.0
ENV PORT=63000
EXPOSE 63000

# Banco SQLite persistido no volume (ver docker-compose)
# DATABASE_URL deve apontar pra "file:/data/app.sqlite"
# Exemplo: DATABASE_URL=file:/data/app.sqlite

# Script de entrada: aplica migrações e (opcional) seed
# SEED_ON_BOOT=true executa scripts/seed-local.mjs se existir
RUN printf '%s\n' \
'#!/bin/sh' \
'set -e' \
'echo "[entrypoint] Applying Prisma migrations..."' \
'npx prisma migrate deploy' \
'if [ "$SEED_ON_BOOT" = "true" ] && [ -f ./scripts/seed-local.mjs ]; then' \
'  echo "[entrypoint] Running seed..."' \
'  node ./scripts/seed-local.mjs || echo "[entrypoint] Seed skipped/failure (continuing)"' \
'fi' \
'echo "[entrypoint] Starting Next.js on $HOST:$PORT..."' \
'npm run start -- -p $PORT -H $HOST' \
> /app/entrypoint.sh && chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
