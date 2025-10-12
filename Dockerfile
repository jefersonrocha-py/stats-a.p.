# =========================
#   STAGE 1: BUILDER
# =========================
FROM node:20-alpine AS builder
WORKDIR /app

# Dependências nativas (Prisma/SSL)
RUN apk add --no-cache libc6-compat openssl ca-certificates

# DB temporário p/ build (evita falhas no prerender)
ARG DATABASE_URL=file:/tmp/build.db
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 1) Instalar deps (sem depender de lock sincronizado)
COPY package.json package-lock.json ./
RUN npm install --omit=optional --no-audit --no-fund

# 2) Prisma Client + aplicar schema no DB do build
COPY prisma ./prisma
RUN npx prisma generate
RUN npx prisma db push --skip-generate

# 3) Código da aplicação (inclui scripts/)
COPY . .

# 4) Build do Next.js
RUN npm run build

# =========================
#   STAGE 2: RUNNER
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl ca-certificates

# Copiar artefatos
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Normaliza CRLF e garante permissão
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
 && chmod +x ./scripts/docker-entrypoint.sh

# Remover devDeps em runtime (opcional)
RUN npm prune --omit=dev --no-audit --no-fund || true

# Vars default (as reais virão do compose/.env)
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL virá do docker-compose (ex.: file:/data/app.db)

# Persistência do SQLite
VOLUME ["/data"]

EXPOSE 3000 3001 63000 443

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
# CMD ["npm","run","start"]  # opcional
