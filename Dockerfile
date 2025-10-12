# =========================
#   STAGE 1: BUILDER
# =========================
FROM node:20-alpine AS builder
WORKDIR /app

# Dependências nativas necessárias (Prisma/SSL)
RUN apk add --no-cache libc6-compat openssl ca-certificates

# --- Evita falhas de DB no build ---
# Valor temporário para o build (descartável)
ARG DATABASE_URL=file:/tmp/build.db
ENV DATABASE_URL=$DATABASE_URL

# Telemetria off no build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copia manifests primeiro para cache eficiente
COPY package.json package-lock.json ./

# ⬇️ AQUI ESTÁ A CORREÇÃO: tenta `npm ci`; se falhar, usa `npm install`
RUN if [ -f package-lock.json ]; then \
      (npm ci --no-audit --no-fund) || (echo "npm ci falhou, usando npm install..." && npm install --no-audit --no-fund); \
    else \
      npm install --no-audit --no-fund; \
    fi

# Prisma antes do código para aproveitar cache do generate
COPY prisma ./prisma
RUN npx prisma generate

# Copia o restante do código (inclui scripts/)
COPY . .

# Build do Next
RUN npm run build

# =========================
#   STAGE 2: RUNNER
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl ca-certificates

# Copia deps e artefatos do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Normaliza CRLF e garante permissão no entrypoint
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
 && chmod +x ./scripts/docker-entrypoint.sh

# Variáveis padrão (as reais virão do docker-compose)
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# ⚠ DATABASE_URL virá do docker-compose (environment)

# Volume para SQLite
VOLUME ["/data"]

# Portas (o compose mapeia HOST_PORT:PORT)
EXPOSE 3000 3001 63000 443

# O entrypoint deve terminar com: exec "$@"
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
# CMD ["npm","run","start"]  # (opcional)
