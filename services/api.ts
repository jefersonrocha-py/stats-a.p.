// @services/api.ts

// ✅ suporte tanto a "UP/DOWN/UNKNOWN" quanto a variações que possam vir do backend
export type AntennaStatus =
  | "UP"
  | "DOWN"
  | "UNKNOWN"
  | "online"
  | "offline"
  | "unknown"
  | "provisioning";

// Mantém campos usados no dashboard (id, status, etc.)
// e inclui lat/lon porque a tabela usa `a.lat` / `a.lon`
export interface Antenna {
  id: string | number;
  name: string;
  status: AntennaStatus;
  mac?: string;
  ip?: string | null;
  model?: string | null;
  networkId?: string | number | null;
  networkName?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  updatedAt?: string | number | Date | null;
}

// ✅ o seu dashboard usa `stats.up` e `stats.down` (DonutChart)
export interface Stats {
  total: number;
  up: number;
  down: number;
  unknown?: number;
  // opcionalmente, mantenha aliases se o backend devolver online/offline:
  online?: number;
  offline?: number;
  byModel?: Record<string, number>;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  let text = "";
  try { text = await res.clone().text(); } catch {}

  if (!res.ok) {
    let msg = `HTTP ${res.status} ${res.statusText} for ${path}`;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = `${msg} — ${j.error}`;
    } catch {}
    throw new Error(msg);
  }

  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Invalid JSON response for ${path}: ${text.slice(0, 200)}`);
  }
}
