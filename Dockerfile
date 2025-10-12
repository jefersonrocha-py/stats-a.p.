# ---------- Base: Node 20 ----------
FROM node:20-alpine AS base
ENV NODE_ENV=production
WORKDIR /app

# ---------- Builder ----------
FROM base AS builder
# Dependências nativas mínimas (se alguma lib precisar)
RUN apk add --no-cache python3 make g++ openssl

# Copia manifestos e tenta instalar com ci; se lock estiver desatualizado, corrige-o e repete
COPY package.json package-lock.json ./
# evita ruído e auditorias em build
RUN npm config set fund false && npm config set audit false
RUN npm ci || (npm install --package-lock-only --no-audit --no-fund && npm ci)

# Copia o restante do projeto (inclui tsconfig, next.config, scripts, etc.)
COPY . .

# Prisma + build do Next
RUN npx prisma generate
RUN npm run build

# ⚠️ NÃO remover devDependencies,
# pois o entrypoint usa `npx prisma migrate deploy` em runtime (precisa do CLI)
# Se quiser imagem mais enxuta: mova as migrações para um job separado.

# ---------- Runner ----------
FROM base AS runner
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
COPY --from=builder /app/styles ./styles

# Garante que o entrypoint tem permissão de execução
RUN chmod +x scripts/docker-entrypoint.sh

# Porta padrão conforme seu .env (PORT=3000)
EXPOSE 3000

# Usa o seu entrypoint
CMD ["scripts/docker-entrypoint.sh"]
