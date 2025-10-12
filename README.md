Etherium Antennas — Map + Dashboard (Next.js)

Aplicação full-stack para cadastrar e mapear antenas Wi-Fi com mapa satélite (centrado em Mogi Mirim/SP), dashboard dinâmico, tema light/dark, tempo real (SSE), Docker e SQLite/Prisma.
Integra com o GDMS (GWN Cloud) para importar APs, redes e status online/offline a cada 5 minutos (worker) e renova o token OAuth automaticamente a cada 1 hora.

✨ Recursos

Mapa (Leaflet + Esri World Imagery) com limites da cidade, painel lateral de filtros e pins UP/DOWN.

Dashboard com cards + donut, filtro por rede e export CSV/PDF.

Settings para inserir Latitude/Longitude/Observações (posiciona os APs no mapa).

Integração GDMS: paginação de networks → APs, normalização de latitude/longitude, status e histórico.

Auth com JWT (cookie HttpOnly) + /admin para criar, bloquear e excluir usuários (apenas SUPERADMIN).

SSE para atualizar UI ao vivo (criação/edição/status).

Docker (web + worker) com SQLite em volume.

🧱 Arquitetura (alto nível)

Next.js 14 (App Router, TS) – UI e rotas API.

Prisma + SQLite – persistência (Antennas, StatusHistory, Users, GdmsToken).

GDMS Service – client HTTP assinado, paginação, pooling/cron.

Worker (scripts/gdms-cron.mjs) – sincronismo 5 min (status) + 60 min (token).

SSE – stream de eventos para UI (dashboard/mapa).

🗂️ Estrutura de Pastas (resumo)
etherium-antennas/
├─ app/
│  ├─ (app)/
│  │  ├─ admin/            # Painel admin (CRUD de usuários)
│  │  ├─ dashboard/        # Cards, donut, lista com filtros e export
│  │  ├─ settings/         # Inserir lat/lon/obs e sincronizar GDMS
│  │  ├─ layout.tsx
│  │  └─ page.tsx          # Mapa
│  ├─ (auth)/
│  │  └─ login/            # Tela de login com animação/particles
│  ├─ api/
│  │  ├─ antennas/         # GET/POST e /[id]/coords PATCH
│  │  ├─ events/           # SSE
│  │  ├─ health/           # Healthcheck
│  │  ├─ history/          # GET histórico por antennaId
│  │  ├─ integrations/gdms/sync # Sync manual
│  │  ├─ stats/            # Totais up/down
│  │  ├─ auth/             # login/logout
│  │  ├─ me/               # quem sou (JWT)
│  │  └─ users/            # CRUD admin
│  ├─ layout.tsx
│  └─ page.tsx             # (se aplicável)
├─ components/             # MapClient, DashboardCards, DonutChart, Sidebar, etc.
├─ lib/                    # auth, prisma, sse, csv, validators, gdmsToken
├─ services/               # api client, sse client, gdms client
├─ store/                  # zustand (theme/ui)
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/          # geradas pelo prisma
├─ public/
│  └─ icons.svg
├─ styles/
│  └─ globals.css
├─ scripts/
│  ├─ gdms-cron.mjs        # worker do GDMS
│  └─ seed-local.mjs       # cria SUPERADMIN
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
├─ tailwind.config.ts
├─ tsconfig.json
├─ next.config.js
├─ postcss.config.js
└─ package.json

🧬 Modelos (Prisma – resumo)

Antenna: id, name, lat, lon, description, status ("UP"|"DOWN"),
gdmsApId?, networkId?, networkName?, lastSyncAt?, lastStatusChange?, timestamps.

StatusHistory: mudanças de status por antennaId.

User: role ("SUPERADMIN"|"ADMIN"|"USER"), isBlocked (boolean), email, passwordHash, timestamps.

GdmsToken: singleton com accessToken, expiresAt.

🔧 Variáveis de Ambiente

Crie seu .env a partir do .env.example. Campos principais:

# App
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
JWT_SECRET=troque-por-um-segredo-forte
JWT_EXPIRES_DAYS=7
COOKIE_SECURE=false        # true em produção HTTPS
FORCE_HTTP=false           # true em dev por trás de proxy sem TLS

# Banco (em dev)
DATABASE_URL=file:./dev.sqlite

# GDMS (GWN Cloud)
GDMS_BASE_URL=https://www.gwn.cloud
GDMS_OAUTH_URL=https://www.gwn.cloud/oauth/token
GDMS_APP_ID=SEU_CLIENT_ID
GDMS_CLIENT_SECRET=SEU_CLIENT_SECRET
GDMS_PAGE_SIZE=500
GDMS_SYNC_INTERVAL_MS=300000   # 5 min
GDMS_SHOW=all

# Seed opcional
SEED_ON_BOOT=false
SUPERADMIN_EMAIL=admin@local.test
SUPERADMIN_PASSWORD=Admin123!
SUPERADMIN_NAME=Root


Produção em Docker: o docker-compose.yml sobrescreve DATABASE_URL para file:/data/app.sqlite (volume).

▶️ Setup Local (dev)
# 1) Dependências
npm i

# 2) Banco (gerar/rodar migrações)
npx prisma migrate dev

# 3) (opcional) Seed do SUPERADMIN
node scripts/seed-local.mjs
# ou:
SUPERADMIN_EMAIL="admin@local.test" SUPERADMIN_PASSWORD="Admin123!" node scripts/seed-local.mjs

# 4) Subir app
npm run dev


Abra: http://localhost:3000

Login com o SUPERADMIN criado no seed.

🐳 Rodando com Docker
Compose (incluído no repo)

web: Next.js em produção.

worker: job de sync GDMS (5 min) + renovação de token (1 h).

Volume appdata para o SQLite /data/app.sqlite.

Passos
# build
docker compose build

# subir
docker compose up -d

# logs
docker compose logs -f


Migrations (primeira subida)

docker compose exec web npx prisma migrate deploy


Seed (opcional – se SEED_ON_BOOT=false)

docker compose exec web node ./scripts/seed-local.mjs


Healthcheck

GET /api/health

O compose já faz o health dos serviços; aguarde healthy antes do worker iniciar.

Reverse Proxy / HTTPS (Nginx Proxy Manager)

Publique web:63000 atrás de um host HTTPS.

Use COOKIE_SECURE=true no .env.

Se seu proxy não propagar secure, pode temporariamente definir FORCE_HTTP=true para depurar login (cookies).

🔐 Autenticação

Login: POST /api/auth/login (cookie auth HttpOnly).

Logout: POST /api/auth/logout.

Perfil: GET /api/me.

/admin: somente SUPERADMIN.
Permite criar, bloquear/desbloquear e excluir usuários via UI.

Curl de exemplo (teste de login):

curl -i -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  --data '{"email":"admin@local.test","password":"Admin123!"}'

🌐 Integração GDMS (GWN Cloud)

Token OAuth (client_credentials) renovado a cada 1h e guardado em GdmsToken.

Sync:

A cada 5 min (worker): lista networks paginadas → lista APs paginados.

Normaliza lat/lon (várias chaves possíveis), atualiza status, networkName, lastSyncAt, mantém lat/lon do usuário.

Registra histórico em StatusHistory quando status muda.

Sync manual: POST /api/integrations/gdms/sync.

Dica: Se seu Postman/Insomnia interceptar cookies, ative “Enable cookies” e mantenha o domínio correto (ou use curl).

🗺️ Mapa (MapClient)

Tiles Esri World Imagery (respeite a atribuição exibida).

Limites aproximados de Mogi Mirim (maxBounds) e botão “Cidade”.

Painel lateral com busca, filtro por status e rede + contagens.

Pins UP (verde) / DOWN (vermelho).

Adicionar antena: modal com lat/lon (preenchimento por clique no mapa).

Atualiza via SSE e polling leve.

📊 Dashboard

Cards: total, UP, DOWN e percentuais.

Donut (Recharts).

Lista filtrável por nome e rede.

Export CSV e Export PDF (com as estatísticas visíveis).

⚙️ Settings

Lista todos os APs importados (ainda sem coordenadas) para você posicionar (lat/lon) e preencher observações.

Após salvar, o AP sai da lista (só mostra os que faltam posicionar).

Botão “Sincronizar GDMS agora” para import manual.

🔌 API (resumo)

GET /api/antennas?take=...&placed=0|1 – lista antenas
(formato: { ok, total, items: Antenna[] })

POST /api/antennas – cria antena manual.

PATCH /api/antennas/[id]/coords – atualiza lat/lon/description.

GET /api/history/[id] – histórico de status.

GET /api/stats – totais up/down.

POST /api/integrations/gdms/sync – sync manual.

GET /api/events – SSE.

POST /api/auth/login / POST /api/auth/logout

Admin:

GET /api/users

POST /api/users (criar)

PATCH /api/users/[id] (bloquear/desbloquear)

DELETE /api/users/[id]

Todas as rotas /api/users exigem SUPERADMIN (via JWT em cookie).

🧪 Testes rápidos (curl)

Health

curl -s http://localhost:3000/api/health


Stats

curl -s http://localhost:3000/api/stats


Antenas colocadas (com lat/lon)

curl -s 'http://localhost:3000/api/antennas?placed=1&take=5000'


Sync GDMS

curl -i -X POST http://localhost:3000/api/integrations/gdms/sync

🪪 Build de Produção (sem Docker)
# instalar deps
npm ci

# gerar prisma client
npx prisma generate

# build
npm run build

# migrações
npx prisma migrate deploy

# start
npm run start


Dica: em servidores por trás de proxy HTTP (sem TLS direto na app), se o login não persistir, teste FORCE_HTTP=true (apenas para depurar). Em produção com HTTPS, mantenha COOKIE_SECURE=true.

🧰 Troubleshooting

Tela branca / “client-side exception”
Veja o Console do navegador. Geralmente é erro de import/rota/variável.
Garanta que styles/globals.css é importado corretamente em app/layout.tsx
(ex.: import "../styles/globals.css"; dependendo do nível).

401 no login

Verifique se o seed do SUPERADMIN foi executado.

Cookies: em produção com HTTPS, use COOKIE_SECURE=true. Atrás de proxy sem TLS direto, pode precisar temporariamente FORCE_HTTP=true.

“Module not found: jsonwebtoken / leaflet / …”
Rode npm i jsonwebtoken @types/jsonwebtoken leaflet @types/leaflet e faça build novamente.
Em Docker, atualize o package-lock.json local e rebuild (docker compose build --no-cache).

“The column … does not exist” (Prisma)
Execute as migrações:

# local
npx prisma migrate dev
# docker
docker compose exec web npx prisma migrate deploy


GDMS trouxe só 1 AP
Confirme token válido, paginação de networks/APs, GDMS_PAGE_SIZE, e verifique o POST /api/integrations/gdms/sync (resumo retorna networks, totalFetched, perNetwork[]).

Mapa fora da cidade / bounds
Os limites são aproximados. Ajuste CITY_BOUNDS no components/MapClient.tsx se necessário.

🧪 Checagens úteis (Docker)
# status containers
docker compose ps

# logs
docker compose logs -f web
docker compose logs -f worker

# prisma dentro do container
docker compose exec web npx prisma studio

📜 Licença

Veja LICENSE.

🙌 Créditos

Esri World Imagery (tiles) – atribuição incluída no mapa.

Ícones FontAwesome, TailwindCSS, Zustand, Prisma, Recharts.