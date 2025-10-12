# syntax=docker/dockerfile:1

########################
#   DEPS (cacheable)   #
########################
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma em Alpine precisa dessas libs em runtime e build
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
# Reprodutível e rápido no cache
RUN npm ci --no-audit --no-fund

########################
#      BUILDER         #
########################
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# node_modules com devDeps para build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Prisma (gera client o quanto antes p/ aproveitar cache quando schema não muda)
COPY prisma ./prisma
RUN npx prisma generate

# Código da app (inclui scripts/)
COPY . .

# Garante que o client está atualizado caso o schema tenha mudado após a etapa anterior
RUN npx prisma generate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build do Next (gera .next)
RUN npm run build

########################
#       RUNNER         #
########################
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=3000

# Se você precisa rodar `npx prisma migrate deploy` no entrypoint,
# mantenha devDeps (copiando node_modules inteiro do builder).
# Caso NÃO precise, veja nota "Slim (opcional)" abaixo.
COPY --from=builder /app/node_modules ./node_modules

# Artefatos necessários em runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Normaliza CRLF e garante permissão de execução
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
 && chmod +x ./scripts/docker-entrypoint.sh

# Persistência do SQLite
VOLUME ["/app/data"]

# Exponha somente o que usa (3000 é o padrão do next start)
EXPOSE 3000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
