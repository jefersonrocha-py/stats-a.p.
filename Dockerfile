# syntax=docker/dockerfile:1

#############################
# BUILDER (instala tudo e builda)
#############################
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# OpenSSL 3 (Prisma engines) + certificados
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates libssl3 \
 && rm -rf /var/lib/apt/lists/*

# Copia manifestos e instala TODAS as deps (inclui dev: tailwind/postcss/autoprefixer)
COPY package.json package-lock.json* ./
RUN npm ci

# Prisma Client (precisa do schema presente)
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Copia o restante do projeto (inclui scripts/, public/, etc.)
COPY . .

# Garantir permissão do seu entrypoint
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Build de produção do Next (usa tailwind/postcss)
RUN npm run build

#############################
# RUNNER (runtime leve, mas com node_modules)
#############################
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# OpenSSL 3 (runtime do Prisma) + certificados
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates libssl3 \
 && rm -rf /var/lib/apt/lists/*

# Prisma CLI (seu entrypoint pode rodar migrate/seed)
RUN npm i -g prisma@^5

# Copia SOMENTE o que o runtime precisa:
# - node_modules (inclui "next" e "bcryptjs")
COPY --from=builder /app/node_modules ./node_modules
# - artefatos de build do Next
COPY --from=builder /app/.next ./.next
# - fontes estáticas e scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
# - schema do Prisma (necessário para migrate/seed)
COPY --from=builder /app/prisma ./prisma
# - package.json e lock (para logs / metadados)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Permissão do entrypoint
RUN chmod +x /app/scripts/docker-entrypoint.sh

EXPOSE 3000

# Usa o SEU entrypoint (não altero lógica)
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

# Teu entrypoint chama "npm run start"; manter assim.
CMD ["npm","run","start"]
