# antenna_maps

etherium-antennas/
├─ app/
│  ├─(app)/
│  │  ├─ admin/
│  │  │  ├─ page.tsx
│  │  ├─ dashboard/
│  │  │  ├─ loading.tsx
│  │  │  ├─ page.tsx
│  │  ├─ settings/
│  │  │  ├─ page.tsx
│  │  │  ├─ page.tsx
│  │  └─ layout.tsx
│  │  └─ page.tsx
│  │  ├─ admin/
│  ├─(auth)/
│  ├─ login/
│  │  ├─ page.tsx

│  ├─ api/
│  │  ├─ antennas/
│  │  │  ├─ route.ts
│  │  │  └─ [id]/route.ts
│  │  ├─ events/route.ts
│  │  ├─ health/route.ts
│  │  ├─ history/
│  │  │  └─ [id]/route.ts
│  │  └─ stats/route.ts
│  ├─ dashboard/page.tsx
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ settings/page.tsx
├─ components/
│  ├─ DashboardCards.tsx
│  ├─ DonutChart.tsx
│  ├─ Footer.tsx
│  ├─ MapClient.tsx
│  ├─ Sidebar.tsx
│  ├─ ThemeToggle.tsx
│  └─ TopBar.tsx
├─ lib/
│  ├─ csv.ts
│  ├─ prisma.ts
│  ├─ sse.ts
│  └─ validators.ts
├─ services/
│  ├─ api.ts
│  └─ sseClient.ts
├─ store/
│  ├─ theme.ts
│  └─ ui.ts
├─ prisma/
│  └─ schema.prisma
├─ public/
│  └─ icons.svg
├─ styles/
│  └─ globals.css
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
├─ next.config.js
├─ package.json
├─ postcss.config.js
├─ README.md
├─ tailwind.config.ts
└─ tsconfig.json


# Etherium Antennas — Map + Dashboard (Next.js)

Aplicação full-stack para cadastrar e mapear antenas Wi-Fi com **mapa satélite** centrado em **Mogi Mirim/SP**, **dashboard dinâmico**, **tema light/dark**, **tempo real (SSE)**, **Docker** e **SQLite via Prisma**.

## Stack
- Next.js 14 (App Router, TypeScript)
- React Leaflet + Esri World Imagery (satélite) — **atribuição obrigatória**
- Recharts (donut)
- Zustand + React Query
- Prisma + SQLite
- SSE para eventos em tempo real

## Pré-requisitos
- Node.js 20+
- Docker e Docker Compose

## Setup (dev)
```bash
cp .env.example .env
npm i
npx prisma migrate dev
npm run dev
