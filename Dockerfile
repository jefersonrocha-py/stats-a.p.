# syntax=docker/dockerfile:1

# Base Debian (OpenSSL 3) — compatível com binaryTarget "debian-openssl-3.0.x"
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# OpenSSL 3 e certificados (necessários para o engine do Prisma)
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates libssl3 \
 && rm -rf /var/lib/apt/lists/*

# Prisma CLI global (para o seu entrypoint poder rodar `prisma ...` se precisar)
RUN npm i -g prisma@^5

# Instala deps de produção com cache otimizado
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copia apenas o schema e gera o client já com o alvo correto (OpenSSL 3)
COPY prisma ./prisma
RUN prisma generate --schema=prisma/schema.prisma

# Agora copia o restante do app (inclui scripts/)
COPY . .

# Garantir permissão de execução no seu entrypoint
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Build da aplicação
RUN npm run build

EXPOSE 3000

# Usa o seu entrypoint (não adiciono lógica aqui)
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

# O entrypoint faz o preparo (migrations, etc). Aqui apenas iniciamos a app.
CMD ["npm","run","start"]
