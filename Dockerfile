# ---------- Deps: instala dependências (inclui dev) ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package.json package-lock.json ./
# inclui dev deps; se lock estiver fora de sincronia, corrige e tenta de novo
RUN npm config set fund false && npm config set audit false
RUN npm ci --include=dev || (npm install --include=dev --package-lock-only --no-audit --no-fund && npm ci --include=dev)

# ---------- Builder: gera .next ----------
FROM node:20-alpine AS builder
WORKDIR /app
# Reaproveita node_modules já com devDeps
COPY --from=deps /app/node_modules ./node_modules
# Copia o projeto
COPY . .
# Prisma client + build do Next
RUN npx prisma generate
RUN npm run build

# ---------- Runner: executa a app (com Prisma CLI disponível) ----------
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Mantemos node_modules da fase "deps" para ter o Prisma CLI no entrypoint
# (Aceitamos Tailwind/other dev deps no runtime; custo: imagem maior)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/styles ./styles

# entrypoint seu
RUN chmod +x scripts/docker-entrypoint.sh
EXPOSE 3000 3001 443 80 63000
CMD ["scripts/docker-entrypoint.sh"]
