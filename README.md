# Monitoring Grandstream

Aplicação full-stack para monitoramento de APs Grandstream/Etherium com Next.js 14, MySQL e integração com GDMS. O projeto combina mapa operacional, dashboard, fila de pendências de coordenadas, visão de clientes por rede e atualização em tempo real via SSE.

## Melhorias recentes

- Tela de login refinada com partículas, cabeçalho em gradiente e bloco da logo com fundo sólido `#F9F9F9`.
- Mapa migrado para `maplibre-gl`, com base satélite, fallback automático para OSM e controle de rotação.
- Sidebar responsiva com relógio, indicadores ao vivo, busca global e navegação por perfil.
- Telas operacionais com paginação, filtros por rede/cluster, exportação CSV e atualização automática via SSE.
- Autenticação endurecida com JWT em cookie `HttpOnly`, cookie CSRF, validação de origem, rate limit e headers de segurança no middleware.

## Stack

- Frontend: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Framer Motion, Font Awesome.
- Mapa: `maplibre-gl`.
- Backend: rotas `app/api/*` do Next.js.
- Banco: MySQL 8 com `mysql2/promise`.
- Integração externa: GDMS (GWN Cloud).
- Tempo real: Server-Sent Events em `/api/events`.
- Deploy local/prod: Docker Compose com serviços `web`, `mysql` e `worker`.

## Fluxo da aplicação

### 1. Entrada e autenticação

1. O usuário acessa `/login`.
2. O `middleware.ts` permite a rota pública e bloqueia páginas privadas sem cookie `auth`.
3. O formulário envia `POST /api/auth/login`.
4. A rota valida origem, aplica rate limit, busca o usuário no MySQL, compara senha com `bcrypt` e gera o JWT.
5. A aplicação grava dois cookies:
   - `auth`: JWT `HttpOnly`.
   - `csrf`: token legível pelo browser para proteger `POST`, `PATCH` e `DELETE`.
6. Depois do login, o usuário é redirecionado para `/`.

### 2. Autorização e navegação

- O `middleware.ts` impede acesso não autenticado às páginas privadas.
- `/admin` só aceita `SUPERADMIN`.
- `/settings` bloqueia perfil `USER`.
- As rotas `/api/*` não são travadas pelo middleware, mas cada endpoint sensível usa `requireRequestAuth(...)` ou `requireRequestAuthOrInternal(...)`.

### 3. Shell principal

Depois do login, a aplicação entra no layout privado:

- `app/(app)/layout.tsx` monta `Sidebar` + `LayoutShell`.
- `Sidebar` consulta `/api/me` e `/api/stats` para montar perfil, contadores e permissões.
- `TopBar` concentra busca global, reload, fullscreen do mapa, troca de tema e logout.

### 4. Fluxo de dados por tela

#### Mapa (`/`)

- Carrega APs posicionados via `GET /api/antennas?placed=1&take=5000`.
- Exibe marcadores `UP/DOWN`, filtros por nome/rede/status e ações de enquadramento.
- Perfis `ADMIN` e `SUPERADMIN` podem criar AP manualmente com `POST /api/antennas`.
- Se o mapa satélite falhar, o cliente troca automaticamente para OSM.

#### Dashboard (`/dashboard`)

- Busca estatísticas locais em `GET /api/stats`.
- Busca clientes por rede diretamente no GDMS em `GET /api/stats/network-clients`.
- Mostra cards, indicadores e gráfico com variantes `donut`, `gauge` e `radial`.

#### Clientes (`/clients`)

- Consulta `GET /api/stats/network-clients`.
- Essa visão vem do GDMS no momento da chamada; não é uma tabela persistida no banco local.

#### Filtros Cluster (`/filter-cluster`)

- Lista APs paginados com `GET /api/antennas`.
- Carrega nomes de rede com `GET /api/antennas/networks`.
- Permite exportar CSV do resultado filtrado.
- Perfis `ADMIN` e `SUPERADMIN` podem:
  - alternar status com `PATCH /api/antennas/[id]`;
  - excluir AP com `DELETE /api/antennas/[id]`.

#### Configurações (`/settings`)

- Mostra APs sem coordenadas com `GET /api/antennas?unsaved=1`.
- Salva latitude, longitude e observações com `PATCH /api/antennas/[id]/coords`.
- Permite disparar sincronização manual do GDMS com `POST /api/integrations/gdms/sync`.

#### Administração (`/admin`)

- Disponível apenas para `SUPERADMIN`.
- Hoje a UI/API expõe listagem e criação de usuários em `/api/users`.
- O campo `isBlocked` existe no modelo e no login, mas o painel atual ainda não traz ação de bloqueio/desbloqueio.

### 5. Atualização em tempo real

- A UI abre uma conexão SSE em `GET /api/events`.
- Quando um AP é criado, atualizado, excluído ou muda de status, o backend emite eventos como:
  - `antenna.created`
  - `antenna.updated`
  - `antenna.deleted`
  - `status.changed`
- Mapa, dashboard, sidebar, settings e filtros reagem a esses eventos e recarregam os dados relevantes.

### 6. Integração GDMS

Há dois fluxos diferentes:

- Sincronização completa:
  - `POST /api/integrations/gdms/sync`
  - lista redes no GDMS;
  - lista APs de cada rede;
  - cria APs novos no MySQL;
  - atualiza nome, rede, status e, se o AP ainda estiver sem posição local, reaproveita lat/lon vindos do GDMS;
  - grava histórico em `StatusHistory` quando o status muda.

- Sincronização de status:
  - `POST /api/integrations/gdms/sync?mode=status`
  - atualiza apenas APs já existentes no banco.

O `worker` do Docker usa por padrão `mode=status`. Isso significa que um ambiente novo precisa de pelo menos uma sincronização completa inicial para popular a tabela `Antenna`.

### 7. Worker e token OAuth

- O token OAuth do GDMS é buscado por `lib/gdmsToken.ts` e persistido em `gdms_token`.
- O `worker` (`scripts/gdms-cron.mjs`) chama periodicamente a rota de sincronização usando `x-internal-api-key`.
- O intervalo do worker é controlado por `SYNC_INTERVAL_MS`.

## Telas principais

- `/login`: autenticação.
- `/`: mapa operacional.
- `/dashboard`: visão consolidada de status.
- `/clients`: clientes conectados por rede no GDMS.
- `/filter-cluster`: busca operacional, ações de status e exportação CSV.
- `/settings`: fila de APs sem coordenadas.
- `/admin`: gestão básica de usuários.

## Estrutura resumida

```text
app/
  (auth)/login/              tela de login
  (app)/                     area autenticada
    page.tsx                 mapa
    dashboard/               cards e graficos
    clients/                 clientes por rede
    filter-cluster/          filtros e exportacao CSV
    settings/                coordenadas e sync manual
    admin/                   usuarios
  api/
    auth/                    login/logout/register
    antennas/                CRUD e coordenadas
    stats/                   totais e clientes por rede
    integrations/gdms/       ping, token e sync
    events/                  SSE
    me/                      usuario autenticado
    users/                   listagem e criacao de usuarios
components/                  mapa, sidebar, topbar, charts, etc.
lib/                         auth, mysql, sse, rate limit, validators
services/                    cliente API, cliente SSE, integracao GDMS
scripts/                     init-db, seed, worker
db/schema.sql                schema MySQL
```

## Variáveis de ambiente essenciais

Use `env.example` como base.

### Aplicação

```ini
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
JWT_SECRET=troque-por-um-segredo-longo
JWT_EXPIRES_DAYS=7
COOKIE_SECURE=false
ALLOW_SELF_REGISTER=false
```

### Banco

```ini
DATABASE_URL=mysql://usuario:senha@127.0.0.1:3306/monitoring_grandstream
```

### GDMS

```ini
GDMS_BASE=https://www.gwn.cloud
GDMS_OAUTH_URL=https://www.gwn.cloud/oauth/token
GDMS_CLIENT_ID=seu_client_id
GDMS_CLIENT_SECRET=seu_client_secret
GDMS_PAGE_SIZE=500
GDMS_SHOW=all
```

### Worker interno

```ini
INTERNAL_API_KEY=uma-chave-interna-longa
APP_BASE_URL=http://web:3000
SYNC_PATH=/api/integrations/gdms/sync?mode=status
SYNC_INTERVAL_MS=300000
```

### Seed de superadmin

```ini
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=change-me-superadmin-password
SUPERADMIN_NAME=Root
```

### Opcional para proxy/origem

```ini
APP_URL=https://seu-dominio.com
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

Essas variáveis ajudam na validação de origem quando a aplicação está atrás de proxy/reverse proxy.

## Rodando localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o `.env`

- copie `env.example`;
- ajuste `DATABASE_URL`;
- defina `JWT_SECRET`;
- preencha as variáveis do GDMS se quiser usar a integração.

### 3. Subir o MySQL

Use um MySQL local ou suba só o serviço do compose:

```bash
docker compose up -d mysql
```

### 4. Aplicar schema

```bash
npm run db:init
```

### 5. Criar superadmin

Recomendado, usando as variáveis `SUPERADMIN_*` do `.env`:

```bash
npm run db:seed
```

Alternativa rápida para desenvolvimento local:

```bash
node scripts/seed-local.mjs
```

### 6. Rodar a aplicação

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Rodando com Docker

```bash
docker compose up -d --build
```

Observações importantes:

- O container `web` já executa `scripts/init-db.mjs` ao iniciar.
- Se `SUPERADMIN_EMAIL` e `SUPERADMIN_PASSWORD` estiverem definidos, o entrypoint também garante a existência do superadmin.
- O container `worker` chama a sincronização periódica usando `INTERNAL_API_KEY`.
- O volume `mysql_data` persiste o banco.

### Primeira carga do inventário GDMS

Como o worker roda em `mode=status`, a primeira importação completa deve ser manual.

Opção 1, pela interface:

- entre com um usuário `ADMIN` ou `SUPERADMIN`;
- abra `/settings`;
- clique em `Sincronizar GDMS`.

Opção 2, por terminal com chave interna:

```bash
curl -X POST http://localhost:3001/api/integrations/gdms/sync \
  -H "x-internal-api-key: SUA_CHAVE_INTERNA"
```

## Endpoints principais

### Autenticação

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/register` e `POST /api/auth/register` somente se `ALLOW_SELF_REGISTER=true`

### APs

- `GET /api/antennas`
- `POST /api/antennas`
- `GET /api/antennas/[id]`
- `PATCH /api/antennas/[id]`
- `DELETE /api/antennas/[id]`
- `PATCH /api/antennas/[id]/coords`
- `GET /api/antennas/networks`
- `GET /api/history/[id]`

### Estatísticas e tempo real

- `GET /api/stats`
- `GET /api/stats/network-clients`
- `GET /api/events`

### GDMS

- `POST /api/integrations/gdms/sync`
- `GET /api/integrations/gdms/ping`
- `GET /api/integrations/gdms/token`
- `POST /api/integrations/gdms/token`

### Administração

- `GET /api/users`
- `POST /api/users`

## Segurança

- JWT em cookie `HttpOnly`.
- Cookie CSRF para mutações autenticadas via browser.
- Validação de `Origin`/`Referer` em métodos inseguros.
- Rate limit em login, criação de AP, mutações e integrações do GDMS.
- Middleware com `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` e outros headers.

Observação operacional:

- chamadas `POST`, `PATCH` e `DELETE` feitas fora do browser podem falhar com `ORIGIN_REQUIRED` ou `CSRF_INVALID` se você tentar usar o fluxo por cookie;
- para automação interna, prefira `x-internal-api-key` nas rotas que suportam esse modo.

## Scripts úteis

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:init
npm run db:seed
npm run test
npm run test:e2e
```

## Troubleshooting

### Login retorna `ORIGIN_REQUIRED` ou `ORIGIN_MISMATCH`

- confirme que está acessando pelo mesmo host/origem da aplicação;
- se houver proxy, configure `APP_URL` ou `NEXT_PUBLIC_APP_URL`.

### Worker não importa APs novos

Isso é esperado se ele estiver usando `mode=status`. Faça uma sincronização completa inicial em `/settings` ou chame `POST /api/integrations/gdms/sync`.

### `/api/stats/network-clients` falha

- valide `GDMS_CLIENT_ID`, `GDMS_CLIENT_SECRET` e `GDMS_OAUTH_URL`;
- teste `GET /api/integrations/gdms/ping`;
- confira se o token está sendo renovado em `GET /api/integrations/gdms/token`.

### Banco não sobe ou schema está desatualizado

```bash
npm run db:init
```

ou, com Docker:

```bash
docker compose exec web npm run db:init
```

## Licença

Consulte `LICENSE`.
