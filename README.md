<p align="center">
  <img src="./public/logo_etherium.png" alt="Etherium" width="170" />
</p>

<h1 align="center">Monitoring Grandstream</h1>

<p align="center">
  Plataforma full-stack para monitoramento operacional de APs Grandstream/Etherium com mapa georreferenciado,
  dashboard executivo, integração GDMS, trilha histórica de status e atualização em tempo real via SSE.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker_Compose-Deploy-2496ED?logo=docker&logoColor=white" />
  <img alt="JWT" src="https://img.shields.io/badge/JWT-Cookie_Auth-000000?logo=jsonwebtokens&logoColor=white" />
  <img alt="SSE" src="https://img.shields.io/badge/SSE-Tempo_Real-FF6A00" />
</p>

## Sumario

- [Visao Executiva](#visao-executiva)
- [Stack e Capacidades](#stack-e-capacidades)
- [Arquitetura da Solucao](#arquitetura-da-solucao)
- [Fluxos Criticos](#fluxos-criticos)
- [Dominios Funcionais](#dominios-funcionais)
- [Modelo de Dados](#modelo-de-dados)
- [Estrutura Completa do Repositorio](#estrutura-completa-do-repositorio)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [Execucao Local](#execucao-local)
- [Deploy com Docker Compose](#deploy-com-docker-compose)
- [Operacao e Observabilidade](#operacao-e-observabilidade)
- [Endpoints Principais](#endpoints-principais)
- [Scripts Disponiveis](#scripts-disponiveis)
- [Troubleshooting](#troubleshooting)
- [Licenca](#licenca)

## Visao Executiva

O projeto entrega uma camada operacional completa para inventario, monitoramento e manutencao de access points Grandstream:

- autenticacao com JWT em cookie `HttpOnly`, protecao CSRF, validacao de origem e rate limit;
- mapa operacional com APs posicionados, filtros, busca e fallback automatico para OpenStreetMap;
- dashboard com totais locais e consolidacao de clientes por rede via GDMS;
- fila de pendencias para APs sem coordenadas, com sincronizacao manual e tratamento em lotes;
- area administrativa para gestao de usuarios com separacao por papeis `USER`, `ADMIN` e `SUPERADMIN`;
- worker dedicado para sincronizacao periodica com o GDMS usando `x-internal-api-key`;
- stream SSE para refletir alteracoes de APs e status em tempo real nas telas principais.

## Stack e Capacidades

| Camada | Implementacao | Papel no sistema |
| --- | --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Framer Motion | Shell autenticado, mapa, dashboard, formularios e navegacao |
| Mapa | `maplibre-gl` com tiles ArcGIS e fallback para OSM | Visualizacao geografica dos APs e operacao em campo |
| Backend | Route Handlers em `app/api/*` | API interna, autenticacao, RBAC, integracoes e healthcheck |
| Seguranca | `jose`, `bcryptjs`, middleware customizado, `zod` | JWT, cookies, validacao de origem, CSRF e validacao de payload |
| Banco | MySQL 8 + `mysql2/promise` + SQL direto | Persistencia de `Antenna`, `StatusHistory`, `User` e `gdms_token` |
| Integracao | GDMS OAuth Client Credentials + APIs de redes/APs | Importacao de inventario, status e clientes por rede |
| Tempo real | Server-Sent Events em `/api/events` | Atualizacao assíncrona da UI sem polling agressivo |
| Infra | Docker multi-stage + Docker Compose | Servicos `mysql`, `web` e `worker` com healthchecks |

## Arquitetura da Solucao

```mermaid
flowchart LR
  subgraph Browser["Cliente Web"]
    UI["Paginas App Router<br/>Mapa, Dashboard, Clients, Settings, Admin"]
    FE["components/ + services/api.ts + services/sseClient.ts"]
  end

  subgraph Web["Container web"]
    MW["middleware.ts<br/>Auth de pagina + headers + RBAC"]
    API["Route Handlers em app/api/*"]
    CORE["lib/*<br/>auth, mysql, gdmsToken, rateLimit, sse"]
  end

  subgraph Data["Persistencia"]
    DB[("MySQL 8<br/>Antenna, StatusHistory, User, gdms_token")]
  end

  subgraph External["Integracoes externas"]
    GDMS["GDMS<br/>OAuth + inventory APIs"]
  end

  Worker["Container worker<br/>scripts/gdms-cron.mjs"]

  UI --> FE
  FE --> MW
  FE --> API
  MW --> API
  API --> CORE
  CORE --> DB
  API --> GDMS
  Worker -->|POST interno| API
  API -->|SSE events| FE
```

### Caracteristicas arquiteturais

- `middleware.ts` protege paginas privadas, aplica headers de seguranca e bloqueia acessos por papel.
- As rotas `/api/*` nao sao bloqueadas pelo middleware, mas endpoints sensiveis exigem `requireRequestAuth(...)` ou `requireRequestAuthOrInternal(...)`.
- O schema do banco esta em [`db/schema.sql`](./db/schema.sql), sem ORM ativo em producao.
- O container `web` inicializa o banco e garante o superadmin via [`scripts/docker-entrypoint.sh`](./scripts/docker-entrypoint.sh).
- O container `worker` nao fala direto com o GDMS em nome da UI; ele chama a API interna de sincronizacao, preservando a mesma regra de negocio do backend.

## Fluxos Criticos

### 1. Autenticacao e autorizacao

```mermaid
sequenceDiagram
  actor U as Usuario
  participant B as Browser
  participant L as POST /api/auth/login
  participant DB as MySQL
  participant M as Middleware

  U->>B: Preenche /login
  B->>L: POST credenciais
  L->>L: Valida Origin + rate limit + schema
  L->>DB: Busca User por email
  DB-->>L: passwordHash, role, isBlocked
  L->>L: bcrypt.compare + gera JWT + CSRF
  L-->>B: cookies auth(HttpOnly) + csrf
  B->>M: Navega para rota privada
  M->>M: Verifica cookie auth
  M-->>B: Libera, redireciona ou bloqueia por papel
```

### 2. Sincronizacao GDMS

```mermaid
sequenceDiagram
  participant T as Worker ou Admin
  participant S as POST /api/integrations/gdms/sync
  participant G as GDMS
  participant DB as MySQL
  participant E as SSE

  T->>S: Chama sincronizacao
  S->>G: Lista redes
  loop Para cada rede
    S->>G: Lista APs da rede
    G-->>S: Inventario, status, clientes, lat/lng
    S->>DB: INSERT/UPDATE em Antenna
    alt Status mudou
      S->>DB: INSERT em StatusHistory
    end
  end
  S->>E: emit(antenna.* / status.changed)
  E-->>UI: Atualiza mapa, cards e filas
```

### 3. Tempo real na interface

- `/api/events` abre um stream SSE autenticado.
- Eventos nomeados usados hoje: `connected`, `ping`, `antenna.created`, `antenna.updated`, `antenna.deleted` e `status.changed`.
- Dashboard, mapa, filtros e settings reagem a esses eventos para revalidar dados locais sem depender apenas de refresh manual.

## Dominios Funcionais

| Area | Rota | Funcao | Papel minimo |
| --- | --- | --- | --- |
| Login | `/login` | Entrada do usuario e emissao dos cookies `auth` + `csrf` | Publico |
| Mapa | `/` | Visualiza APs com coordenadas, filtros e acao manual de criacao de AP | Autenticado; criacao manual para `ADMIN`/`SUPERADMIN` |
| Dashboard | `/dashboard` | Totais locais, disponibilidade e clientes por rede | Autenticado |
| Clientes | `/clients` | Visao de clientes conectados por rede consumindo GDMS em tempo real de consulta | Autenticado |
| Filter Cluster | `/filter-cluster` | Busca operacional, paginacao, exportacao CSV, alteracao de status e exclusao | Leitura para autenticado; mutacao para `ADMIN`/`SUPERADMIN` |
| Settings | `/settings` | Fila de APs sem coordenadas e sincronizacao manual GDMS | `ADMIN`/`SUPERADMIN` |
| Admin | `/admin` | Listagem e criacao de usuarios | `SUPERADMIN` |

## Modelo de Dados

```mermaid
erDiagram
  Antenna {
    int id PK
    string name
    text description
    double lat
    double lon
    string status
    string gdmsApId UK
    string networkId
    string networkName
    datetime lastSyncAt
    datetime lastStatusChange
    datetime createdAt
    datetime updatedAt
  }

  StatusHistory {
    int id PK
    int antennaId FK
    string status
    datetime changedAt
  }

  User {
    int id PK
    string name
    string email UK
    string passwordHash
    string role
    boolean isBlocked
    datetime createdAt
  }

  gdms_token {
    int id PK
    text accessToken
    datetime expiresAt
    datetime updatedAt
  }

  Antenna ||--o{ StatusHistory : tracks
```

## Estrutura Completa do Repositorio

Diretorios gerados ou externos omitidos propositalmente: `.git/`, `.next/` e `node_modules/`.

<details open>
<summary><strong>Arvore de codigo-fonte e infraestrutura</strong></summary>

```text
.
|-- .dockerignore
|-- .eslintrc.json
|-- .gitattributes
|-- .gitignore
|-- Dockerfile
|-- LICENSE
|-- README.md
|-- docker-compose.yml
|-- env.example
|-- middleware.ts
|-- next-env.d.ts
|-- next.config.js
|-- package-lock.json
|-- package.json
|-- postcss.config.js
|-- tailwind.config.ts
|-- tsconfig.json
|-- app
|   |-- (app)
|   |   |-- admin
|   |   |   `-- page.tsx
|   |   |-- clients
|   |   |   `-- page.tsx
|   |   |-- dashboard
|   |   |   |-- loading.tsx
|   |   |   `-- page.tsx
|   |   |-- filter-cluster
|   |   |   `-- page.tsx
|   |   |-- layout.tsx
|   |   |-- page.tsx
|   |   `-- settings
|   |       `-- page.tsx
|   |-- (auth)
|   |   |-- layout.tsx
|   |   `-- login
|   |       `-- page.tsx
|   |-- api
|   |   |-- antennas
|   |   |   |-- [id]
|   |   |   |   |-- coords
|   |   |   |   |   `-- route.ts
|   |   |   |   `-- route.ts
|   |   |   |-- networks
|   |   |   |   `-- route.ts
|   |   |   `-- route.ts
|   |   |-- auth
|   |   |   |-- login
|   |   |   |   `-- route.ts
|   |   |   |-- logout
|   |   |   |   `-- route.ts
|   |   |   `-- register
|   |   |       `-- route.ts
|   |   |-- events
|   |   |   `-- route.ts
|   |   |-- health
|   |   |   `-- route.ts
|   |   |-- history
|   |   |   `-- [id]
|   |   |       `-- route.ts
|   |   |-- integrations
|   |   |   `-- gdms
|   |   |       |-- ping
|   |   |       |   `-- route.ts
|   |   |       |-- sync
|   |   |       |   `-- route.ts
|   |   |       `-- token
|   |   |           `-- route.ts
|   |   |-- me
|   |   |   `-- route.ts
|   |   |-- register
|   |   |   `-- route.ts
|   |   |-- stats
|   |   |   |-- network-clients
|   |   |   |   `-- route.ts
|   |   |   `-- route.ts
|   |   `-- users
|   |       `-- route.ts
|   |-- layout.tsx
|   `-- loading.tsx
|-- components
|   |-- AntennaToolbar.tsx
|   |-- AuthInput.tsx
|   |-- AuthParticles.tsx
|   |-- DashboardCards.tsx
|   |-- DonutChart.tsx
|   |-- Footer.tsx
|   |-- LayoutShell.tsx
|   |-- MapClient.tsx
|   |-- PaginationControls.tsx
|   |-- PasswordInput.tsx
|   |-- Sidebar.tsx
|   |-- ThemeScript.tsx
|   |-- ThemeToggle.tsx
|   |-- TopBar.tsx
|   `-- Client
|       `-- index.tsx
|-- db
|   `-- schema.sql
|-- lib
|   |-- auth.ts
|   |-- csv.ts
|   |-- dbErrors.ts
|   |-- dbMappers.ts
|   |-- gdmsToken.ts
|   |-- mysql.ts
|   |-- rateLimit.ts
|   |-- requestSecurity.ts
|   |-- sse.ts
|   |-- validators.ts
|   `-- validatorsAuth.ts
|-- prisma
|   `-- (diretorio reservado; sem arquivos versionados)
|-- public
|   |-- icons.svg
|   `-- logo_etherium.png
|-- scripts
|   |-- docker-entrypoint.sh
|   |-- gdms-cron.mjs
|   |-- init-db.mjs
|   |-- mysql-utils.mjs
|   |-- seed-local.mjs
|   `-- seed-superadmin.mjs
|-- services
|   |-- api.ts
|   |-- gdms.ts
|   `-- sseClient.ts
|-- store
|   |-- theme.ts
|   `-- ui.ts
`-- styles
    `-- globals.css
```

</details>

### Responsabilidade por diretorio

| Diretorio | Responsabilidade |
| --- | --- |
| `app/` | Paginas, layouts e Route Handlers do App Router |
| `components/` | Componentes de UI e blocos de composicao de tela |
| `lib/` | Nucleo de seguranca, banco, validacao, SSE e mapeamento de dados |
| `services/` | Clientes frontend e integracao com GDMS |
| `scripts/` | Bootstrap, seed, cron e utilitarios operacionais |
| `db/` | Schema SQL versionado |
| `public/` | Assets estaticos do projeto |
| `store/` | Estado global de UI/tema |
| `styles/` | CSS global |
| `prisma/` | Diretorio reservado; sem uso ativo no fluxo atual |

## Variaveis de Ambiente

Use [`env.example`](./env.example) como baseline. Abaixo estao as chaves que realmente mudam o comportamento operacional.

### Aplicacao e seguranca

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Nao | `Etherium Antennas` | Nome exibido na interface |
| `NODE_ENV` | Sim | `production` | Ativa politicas de seguranca e cookies seguros |
| `HOST` | Sim | `0.0.0.0` | Bind do servidor Next.js |
| `PORT` | Sim | `3000` | Porta interna do container `web` |
| `HOST_PORT` | Sim no Compose | `3001` | Porta exposta no host |
| `JWT_SECRET` | Sim | segredo >= 32 chars | Obrigatorio para assinar/verificar JWT |
| `JWT_EXPIRES_DAYS` | Nao | `7` | TTL do cookie de autenticacao |
| `COOKIE_SECURE` | Sim em producao | `true` | Deve ficar `false` apenas em HTTP local |
| `ALLOW_SELF_REGISTER` | Nao | `false` | Habilita `/api/register` e `/api/auth/register` |
| `INTERNAL_API_KEY` | Sim para worker | segredo >= 24 chars | Protege rotas internas consumidas pelo worker |

### Banco e pool

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `MYSQL_IMAGE` | Nao | `mysql:8.4` | Imagem do banco no Compose |
| `MYSQL_PORT` | Sim no Compose | `3307` | Porta interna e externa configurada no stack atual |
| `MYSQL_HOST_PORT` | Sim no Compose | `3307` | Porta publicada para acesso externo |
| `MYSQL_DATABASE` | Sim | `monitoring_grandstream` | Banco principal |
| `MYSQL_USER` | Sim | `monitoring_app` | Usuario da aplicacao |
| `MYSQL_PASSWORD` | Sim | `change-me-app-password` | Senha do usuario da aplicacao |
| `MYSQL_ROOT_PASSWORD` | Sim | `change-me-root-password` | Senha de administracao do MySQL |
| `DATABASE_URL` | Sim | `mysql://monitoring_app:...@mysql:3307/monitoring_grandstream` | O host correto no Compose eh `mysql`, nao `localhost` |
| `MYSQL_POOL_SIZE` | Opcional | `10` | Suportada por [`lib/mysql.ts`](./lib/mysql.ts), embora nao conste no `env.example` |

### GDMS e sincronizacao

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `GDMS_BASE` | Sim se usar integracao | `https://www.gwn.cloud` | Base das APIs GDMS |
| `GDMS_OAUTH_URL` | Sim se usar integracao | `https://www.gwn.cloud/oauth/token` | Endpoint OAuth |
| `GDMS_CLIENT_ID` | Sim se usar integracao | `...` | Client ID do GDMS |
| `GDMS_CLIENT_SECRET` | Sim se usar integracao | `...` | Client Secret do GDMS |
| `GDMS_PAGE_SIZE` | Nao | `500` | Limite por pagina nas consultas |
| `GDMS_SHOW` | Nao | `all` | Filtro enviado ao GDMS para APs |
| `APP_BASE_URL` | Sim no worker | `http://web:3000` | URL interna do servico `web` consumida pelo worker |
| `SYNC_PATH` | Sim no worker | `/api/integrations/gdms/sync?mode=status` | Rota chamada pelo cron |
| `SYNC_INTERVAL_MS` | Sim no worker | `300000` | Intervalo do worker em milissegundos |

### Bootstrap administrativo

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `SUPERADMIN_EMAIL` | Recomendada | `admin@example.com` | Seed idempotente do superadmin |
| `SUPERADMIN_PASSWORD` | Recomendada | `change-me-superadmin-password` | Necessaria para criacao inicial |
| `SUPERADMIN_NAME` | Nao | `Root` | Nome exibido na conta inicial |

### Proxy e origem confiavel

Essas variaveis sao aceitas pelo codigo, embora nao venham preenchidas no `env.example`:

| Variavel | Quando usar | Papel |
| --- | --- | --- |
| `APP_URL` | Reverse proxy, dominio publico, HTTPS terminado fora do container | Ajuda a validacao de origem em mutacoes |
| `NEXT_PUBLIC_APP_URL` | Mesmo cenario acima | Fallback para a mesma validacao e consumo frontend |

### Observacoes importantes

- `FORCE_HTTP` e `GDMS_SYNC_INTERVAL_MS` aparecem no `env.example` e no `docker-compose.yml`, mas nao possuem consumo direto no codigo atual do backend.
- `JWT_SECRET` com menos de 32 caracteres quebra a inicializacao do fluxo de autenticacao.
- `INTERNAL_API_KEY` com menos de 24 caracteres nao eh aceita no fluxo `requireRequestAuthOrInternal(...)`.

## Execucao Local

### 1. Preparar ambiente

```bash
cp env.example .env
# PowerShell: Copy-Item env.example .env
```

Ajuste pelo menos:

- `NODE_ENV=development`
- `COOKIE_SECURE=false`
- `DATABASE_URL`
- `JWT_SECRET`
- `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` e `SUPERADMIN_NAME`
- `GDMS_CLIENT_ID` e `GDMS_CLIENT_SECRET` se quiser integrar o GDMS desde o inicio

### 2. Subir banco local

```bash
docker compose up -d mysql
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Aplicar schema

```bash
npm run db:init
```

### 5. Criar ou promover superadmin

```bash
npm run db:seed
```

Alternativa rapida apenas para desenvolvimento:

```bash
node scripts/seed-local.mjs
```

### 6. Subir aplicacao

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Deploy com Docker Compose

### Topologia do stack

| Servico | Funcao | Healthcheck | Porta publicada |
| --- | --- | --- | --- |
| `mysql` | Persistencia MySQL 8.4 | `mysqladmin ping` | `${MYSQL_HOST_PORT}:${MYSQL_PORT}` |
| `web` | UI Next.js, APIs, SSE, bootstrap de schema e seed | `GET /api/health` | `${HOST_PORT}:${PORT}` |
| `worker` | Cron de sincronizacao GDMS | Depende do `web` healthy | Nao publica porta |

### Pre-flight de producao

Antes do primeiro `up`, valide:

- `JWT_SECRET` com 32+ caracteres.
- `INTERNAL_API_KEY` com 24+ caracteres.
- `COOKIE_SECURE=true` em ambiente HTTPS.
- `DATABASE_URL` apontando para `mysql:3307` dentro do Compose atual.
- `APP_BASE_URL=http://web:3000` para o worker.
- Credenciais GDMS preenchidas se a integracao estiver habilitada.
- Politica de backup do volume `mysql_data`.

### Subida inicial

```bash
docker compose up -d --build
```

### Validacao do stack

```bash
docker compose ps
docker compose logs -f mysql
docker compose logs -f web
docker compose logs -f worker
curl http://localhost:3001/api/health
```

O fluxo de startup real do `web` eh:

1. executa [`scripts/init-db.mjs`](./scripts/init-db.mjs);
2. se `SUPERADMIN_*` estiver configurado, executa [`scripts/seed-superadmin.mjs`](./scripts/seed-superadmin.mjs);
3. sobe o servidor Next.js em modo producao;
4. o `worker` aguarda `web` saudavel e passa a chamar `POST /api/integrations/gdms/sync`.

### Primeira carga do inventario GDMS

Por padrao, o worker roda com:

```ini
SYNC_PATH=/api/integrations/gdms/sync?mode=status
```

Isso significa que ele **atualiza somente APs ja existentes no banco**. Em ambiente novo, faca uma carga completa inicial:

Pela interface:

- acesse `/settings` com `ADMIN` ou `SUPERADMIN`;
- clique em `Sincronizar GDMS`.

Por terminal:

```bash
curl -X POST http://localhost:3001/api/integrations/gdms/sync \
  -H "x-internal-api-key: SUA_CHAVE_INTERNA"
```

### Operacao recorrente

Comandos uteis para manutencao:

```bash
docker compose up -d --build web worker
docker compose restart worker
docker compose exec web npm run db:init
docker compose exec mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"'
```

### Backup rapido do banco

```bash
docker compose exec mysql sh -lc 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```

## Operacao e Observabilidade

| Recurso | Endpoint ou comando | Objetivo |
| --- | --- | --- |
| Health do backend | `GET /api/health` | Verifica conectividade do `web` com MySQL |
| Teste GDMS | `GET /api/integrations/gdms/ping` | Confirma acesso ao inventario remoto |
| Estado do token GDMS | `GET /api/integrations/gdms/token` | Mostra existencia e expiracao do token persistido |
| Refresh manual do token | `POST /api/integrations/gdms/token` | Forca novo token OAuth |
| Logs do worker | `docker compose logs -f worker` | Diagnostica ciclos de sincronizacao |
| Logs da web | `docker compose logs -f web` | Diagnostica autenticacao, DB, SSE e APIs |
| Eventos em tempo real | `GET /api/events` | Stream SSE autenticado para UI |

## Endpoints Principais

### Autenticacao

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/register`
- `POST /api/auth/register`

### Antennas e historico

- `GET /api/antennas`
- `POST /api/antennas`
- `GET /api/antennas/[id]`
- `PATCH /api/antennas/[id]`
- `DELETE /api/antennas/[id]`
- `PATCH /api/antennas/[id]/coords`
- `GET /api/antennas/networks`
- `GET /api/history/[id]`

### Estatisticas e tempo real

- `GET /api/stats`
- `GET /api/stats/network-clients`
- `GET /api/events`

### Integracao GDMS

- `GET /api/integrations/gdms/ping`
- `GET /api/integrations/gdms/token`
- `POST /api/integrations/gdms/token`
- `POST /api/integrations/gdms/sync`

### Administracao

- `GET /api/users`
- `POST /api/users`

## Scripts Disponiveis

| Script | Efeito |
| --- | --- |
| `npm run dev` | Sobe a aplicacao em modo desenvolvimento |
| `npm run build` | Gera build de producao |
| `npm run start` | Inicia o servidor Next.js em producao |
| `npm run lint` | Executa ESLint |
| `npm run db:init` | Aplica [`db/schema.sql`](./db/schema.sql) no banco |
| `npm run db:seed` | Garante a existencia/promocao do superadmin |
| `node scripts/seed-local.mjs` | Seed auxiliar de desenvolvimento |
| `node scripts/gdms-cron.mjs` | Worker de sincronizacao manual, fora do Compose |

### Estado atual da automacao de testes

O `package.json` declara `npm run test` e `npm run test:e2e`, mas a base atual nao expoe suites de teste ou arquivos de configuracao versionados correspondentes. Trate esses scripts como placeholders ate que a estrategia de testes seja versionada no repositorio.

## Troubleshooting

### `monitoring-web` nao fica healthy

Sintomas comuns:

- `/api/health` retorna `503`;
- o container `web` reinicia ou fica preso no startup;
- logs mostram falha de conexao com MySQL.

Checklist:

- confirme `DATABASE_URL` com host `mysql` e porta `3307` dentro do Compose;
- valide se `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `DATABASE_URL` estao coerentes;
- acompanhe `docker compose logs -f mysql`;
- reexecute o schema:

```bash
docker compose exec web npm run db:init
```

### `ORIGIN_REQUIRED`, `ORIGIN_MISMATCH` ou `CSRF_INVALID`

Esses erros sao esperados quando a mutacao nao respeita a politica de origem/cookie:

- acesse a aplicacao pelo mesmo host/origem usado pelo browser;
- atras de reverse proxy, encaminhe `X-Forwarded-Host` e `X-Forwarded-Proto`;
- configure `APP_URL` ou `NEXT_PUBLIC_APP_URL` se houver dominio publico;
- chamadas `POST`, `PATCH` e `DELETE` com cookie exigem `x-csrf-token`; a UI ja faz isso via [`services/api.ts`](./services/api.ts).

### Worker nao cria APs novos

Isso nao eh bug se o worker estiver usando o padrao atual:

```ini
SYNC_PATH=/api/integrations/gdms/sync?mode=status
```

Nesse modo ele apenas atualiza status de APs ja existentes. Solucao:

- execute uma sincronizacao completa inicial em `/settings`; ou
- chame manualmente `POST /api/integrations/gdms/sync` sem `mode=status`.

### Dashboard local funciona, mas clientes por rede falham

`GET /api/stats` depende do banco local. Ja `GET /api/stats/network-clients` depende do GDMS.

Valide:

- `GDMS_CLIENT_ID` e `GDMS_CLIENT_SECRET`;
- `GDMS_OAUTH_URL` e `GDMS_BASE`;
- `GET /api/integrations/gdms/ping`;
- `GET /api/integrations/gdms/token`.

### Mapa abre, mas nao ha APs visiveis

A home carrega:

```http
GET /api/antennas?placed=1&take=5000
```

Logo, APs com `lat=0` e `lon=0` ficam fora do mapa. Se o GDMS nao devolver coordenadas validas:

- finalize a geolocalizacao em `/settings`;
- confirme se a importacao completa trouxe `lat/lng`;
- lembre que APs recem-criados manualmente nascem com status `DOWN`.

### Sessao nao persiste em HTTPS ou proxy

- mantenha `COOKIE_SECURE=true` em producao HTTPS;
- se o TLS termina no proxy, garanta encaminhamento correto de host/protocolo;
- configure `APP_URL` ou `NEXT_PUBLIC_APP_URL` para alinhar a validacao de origem;
- nao teste cookie seguro em `http://localhost` com configuracao de producao.

### Token GDMS nao renova

Se `POST /api/integrations/gdms/token` falhar:

- confira se `GDMS_OAUTH_URL` usa HTTPS em producao;
- valide client ID/secret;
- cheque a tabela `gdms_token`;
- acompanhe os logs do `web`, porque a renovacao passa pelo backend.

## Licenca

Este projeto utiliza a licenca MIT. Consulte [`LICENSE`](./LICENSE).
