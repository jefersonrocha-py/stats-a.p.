# -------- Base de build --------
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

# Manifestos
COPY package.json package-lock.json ./
# Use install (tolerante ao lock desatualizado)
RUN npm install --no-audit --no-fund

# Prisma (melhora cache)
COPY prisma ./prisma
RUN npx prisma generate

# Código (inclui a pasta scripts/)
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build do Next (gera .next)
RUN npm run build

# -------- Runtime --------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

# node_modules (inclui devDeps -> npx prisma disponível no entrypoint)
COPY --from=builder /app/node_modules ./node_modules

# Artefatos necessários em runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma

# 📌 Copia a PASTA de scripts (onde está docker-entrypoint.sh e os .mjs)
COPY --from=builder /app/scripts ./scripts

# normaliza CRLF e garante permissão no entrypoint
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
 && chmod +x ./scripts/docker-entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Banco SQLite persistente
VOLUME ["/data"]

EXPOSE 3000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
