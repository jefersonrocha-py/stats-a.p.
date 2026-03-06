# Etherium Antennas — Map + Dashboard (Next.js)

Aplicação **full-stack** para cadastrar e mapear antenas Wi-Fi com mapa satélite (centrado em **Mogi Mirim/SP**), dashboard dinâmico, **tema light/dark**, **tempo real (SSE)**, **Docker** e **MySQL**.

Integra com o **GDMS (GWN Cloud)** para importar APs, redes e status online/offline a cada **5 minutos** (worker) e **renova o token OAuth automaticamente** a cada **1 hora**.

---

## Sumário

* [Recursos](#-recursos)
* [Arquitetura (alto nível)](#-arquitetura-alto-nível)
* [Estrutura de Pastas](#️-estrutura-de-pastas-resumo)
* [Modelos](#-modelos--resumo)
* [Variáveis de Ambiente](#-variáveis-de-ambiente)
* [Setup Local (dev)](#️-setup-local-dev)
* [Rodando com Docker](#-rodando-com-docker)
* [Autenticação](#-autenticação)
* [Integração GDMS](#-integração-gdms-gwn-cloud)
* [Mapa](#️-mapa-mapclient)
* [Dashboard](#-dashboard)
* [Settings](#-settings)
* [API (resumo)](#-api-resumo)
* [Testes rápidos (curl)](#-testes-rápidos-curl)
* [Build de Produção (sem Docker)](#-build-de-produção-sem-docker)
* [Troubleshooting](#-troubleshooting)
* [Checagens úteis (Docker)](#-checagens-úteis-docker)
* [Licença](#-licença)
* [Créditos](#-créditos)

---

## ✨ Recursos

* **Mapa** (Leaflet + Esri World Imagery) com limites da cidade, painel lateral de filtros e pins **UP/DOWN**.
* **Dashboard** com cards + donut, filtro por rede e **export CSV/PDF**.
* **Settings** para inserir Latitude/Longitude/Observações (posiciona os APs no mapa).
* **Integração GDMS**: paginação de networks → APs, normalização de latitude/longitude, status e histórico.
* **Auth** com **JWT** (cookie **HttpOnly**) + `/admin` para criar, bloquear e excluir usuários (**apenas SUPERADMIN**).
* **SSE** para atualizar UI ao vivo (criação/edição/status).
* **Docker** (web + worker) com **SQLite em volume**.

---

## 🧱 Arquitetura (alto nível)

* **Next.js 14** (App Router, TypeScript) – UI e rotas API.
* **MySQL + mysql2** – persistência (**Antenna**, **StatusHistory**, **User**, **gdms_token**).
* **GDMS Service** – client HTTP assinado, paginação, pooling/cron.
* **Worker** (`scripts/gdms-cron.mjs`) – sincronismo **5 min** (status) + **60 min** (token).
* **SSE** – stream de eventos para UI (dashboard/mapa).

---

## 🗂️ Estrutura de Pastas (resumo)

```text
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
├─ lib/                    # auth, mysql, sse, csv, validators, gdmsToken
├─ services/               # api client, sse client, gdms client
├─ store/                  # zustand (theme/ui)
├─ db/
│  └─ schema.sql           # estrutura inicial do MySQL
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
```

---

## 🧬 Modelos (resumo)

**Antenna**: `id`, `name`, `lat`, `lon`, `description`, `status` ("UP"|"DOWN"),
`gdmsApId?`, `networkId?`, `networkName?`, `lastSyncAt?`, `lastStatusChange?`, timestamps.

**StatusHistory**: mudanças de status por `antennaId`.

**User**: `role` ("SUPERADMIN"|"ADMIN"|"USER"), `isBlocked` (boolean), `email`, `passwordHash`, timestamps.

**GdmsToken**: singleton com `accessToken`, `expiresAt`.

---

## 🔧 Variáveis de Ambiente

Crie seu `.env` a partir do `.env.example`. Campos principais:

```ini
# App
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
JWT_SECRET=troque-por-um-segredo-forte
JWT_EXPIRES_DAYS=7
COOKIE_SECURE=false        # true em produção HTTPS
FORCE_HTTP=false           # true em dev por trás de proxy sem TLS

# Banco
DATABASE_URL=mysql://app:app123@127.0.0.1:3306/monitoring

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
```

> **Produção (Docker):** o `docker-compose.yml` aponta `DATABASE_URL` para o container `mysql` e persiste os dados no volume `mysql_data`.

---

## ▶️ Setup Local (dev)

```bash
# 1) Dependências
npm i

# 2) Banco (criar/atualizar estrutura)
npm run db:init

# 3) (opcional) Seed do SUPERADMIN
node scripts/seed-local.mjs
# ou:
SUPERADMIN_EMAIL="admin@local.test" SUPERADMIN_PASSWORD="Admin123!" node scripts/seed-local.mjs

# 4) Subir app
npm run dev
```

Abra: [http://localhost:3000](http://localhost:3000)

Login com o SUPERADMIN criado no seed.

---

## 🐳 Rodando com Docker

**Compose** (incluído no repo)

* **web**: Next.js em produção.
* **worker**: job de sync GDMS (5 min) + renovação de token (1 h).
* **mysql**: banco MySQL 8 com volume `mysql_data`.

**Passos**

```bash
# build
docker compose build

# subir
docker compose up -d

# logs
docker compose logs -f
```

**Inicialização do banco (primeira subida)**

```bash
docker compose exec web npm run db:init
```

**Seed (opcional – se SEED_ON_BOOT=false)**

```bash
docker compose exec web node ./scripts/seed-local.mjs
```

**Healthcheck**

```text
GET /api/health
```

O compose já faz o health dos serviços; aguarde **healthy** antes do worker iniciar.

**Reverse Proxy / HTTPS (Nginx Proxy Manager)**

* Publique `web:63000` atrás de um host **HTTPS**.
* Use `COOKIE_SECURE=true` no `.env`.
* Se seu proxy não propagar `secure`, pode temporariamente definir `FORCE_HTTP=true` para **depurar login (cookies)**.

---

## 🔐 Autenticação

* **Login**: `POST /api/auth/login` (cookie **HttpOnly**)
* **Logout**: `POST /api/auth/logout`
* **Perfil**: `GET /api/me`
* `/admin`: somente **SUPERADMIN** (criar, bloquear/desbloquear, excluir usuários via UI)

**Curl de exemplo (teste de login)**

```bash
curl -i -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  --data '{"email":"admin@local.test","password":"Admin123!"}'
```

---

## 🌐 Integração GDMS (GWN Cloud)

* **Token OAuth** (`client_credentials`) renovado a cada **1h** e guardado em `GdmsToken`.
* **Sync (5 min)**: lista networks paginadas → lista APs paginados.
* **Normalização**: lat/lon (várias chaves possíveis), status, `networkName`, `lastSyncAt`.
* **Coordenadas**: se houver lat/lon do usuário, **mantém** (não sobrescreve).
* **Histórico**: grava em `StatusHistory` quando status muda.
* **Sync manual**: `POST /api/integrations/gdms/sync`.

> Dica: Se seu Postman/Insomnia interceptar cookies, ative **Enable cookies** e mantenha o domínio correto (ou use `curl`).

---

## 🗺️ Mapa (MapClient)

* **Tiles**: Esri World Imagery (**atribuição exibida** na UI).
* **Limites**: aprox. de Mogi Mirim (maxBounds) e botão “Cidade”.
* **Painel lateral**: busca, filtro por status e rede + contagens.
* **Pins**: **UP** (verde) / **DOWN** (vermelho).
* **Adicionar antena**: modal com lat/lon (clique no mapa preenche).
* **Tempo real**: SSE e polling leve para manter os dados atualizados.

---

## 📊 Dashboard

* **Cards**: total, UP, DOWN e percentuais.
* **Donut** (Recharts).
* **Lista** filtrável por nome e rede.
* **Export**: CSV e PDF (com as estatísticas visíveis).

---

## ⚙️ Settings

* Lista todos os APs importados **sem coordenadas** para você posicionar (lat/lon) e preencher observações.
* Após salvar, o AP **sai da lista** (mostra apenas os que faltam posicionar).
* **Botão** “Sincronizar GDMS agora” para import manual.

---

## 🔌 API (resumo)

* `GET /api/antennas?take=...&placed=0|1` – lista antenas
  *Formato*: `{ ok, total, items: Antenna[] }`
* `POST /api/antennas` – cria antena manual.
* `PATCH /api/antennas/[id]/coords` – atualiza lat/lon/description.
* `GET /api/history/[id]` – histórico de status.
* `GET /api/stats` – totais up/down.
* `POST /api/integrations/gdms/sync` – sync manual.
* `GET /api/events` – **SSE**.
* `POST /api/auth/login` / `POST /api/auth/logout`.

**Admin (exige SUPERADMIN)**

* `GET /api/users`
* `POST /api/users` (criar)
* `PATCH /api/users/[id]` (bloquear/desbloquear)
* `DELETE /api/users/[id]`

---

## 🧪 Testes rápidos (curl)

**Health**

```bash
curl -s http://localhost:3000/api/health
```

**Stats**

```bash
curl -s http://localhost:3000/api/stats
```

**Antenas colocadas (com lat/lon)**

```bash
curl -s 'http://localhost:3000/api/antennas?placed=1&take=5000'
```

**Sync GDMS**

```bash
curl -i -X POST http://localhost:3000/api/integrations/gdms/sync
```

---

## 🪪 Build de Produção (sem Docker)

```bash
# instalar deps
npm ci

# build
npm run build

# inicializar banco
npm run db:init

# start
npm run start
```

> Em servidores atrás de proxy **HTTP** (sem TLS direto na app), se o login não persistir, teste `FORCE_HTTP=true` (apenas para depurar). Em produção com **HTTPS**, mantenha `COOKIE_SECURE=true`.

---

## Troubleshooting

**Estrutura do banco ausente ou desatualizada**
Se aparecer erro de tabela ou coluna inexistente, reaplique o schema:

```bash
# local
npm run db:init

# docker
docker compose exec web npm run db:init
```

```bash
# status containers
docker compose ps

# logs
docker compose logs -f web
docker compose logs -f worker

# testar conexão com a app
curl http://localhost:3000/api/health
```

---

## 📜 Licença

Consulte **LICENSE**.

---

## 🙌 Créditos

* **Esri World Imagery** (tiles) – atribuição incluída no mapa.
* Ícones **FontAwesome**, **TailwindCSS**, **Zustand**, **mysql2**, **Recharts**.
