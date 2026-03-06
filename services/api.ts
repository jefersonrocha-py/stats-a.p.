// @services/api.ts

export type AntennaStatus =
  | "UP"
  | "DOWN"
  | "UNKNOWN"
  | "online"
  | "offline"
  | "unknown"
  | "provisioning";

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
  description?: string | null;
  updatedAt?: string | number | Date | null;
}

export interface Stats {
  total: number;
  up: number;
  down: number;
  unknown?: number;
  online?: number;
  offline?: number;
  byModel?: Record<string, number>;
}

export interface AntennaListResponse {
  ok: boolean;
  items: Antenna[];
  total: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AntennaNetworksResponse {
  ok: boolean;
  items: string[];
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
  try {
    text = await res.clone().text();
  } catch {}

  if (!res.ok) {
    let msg = `HTTP ${res.status} ${res.statusText} for ${path}`;
    try {
      const json = JSON.parse(text);
      if (json?.error) msg = `${msg} - ${json.error}`;
    } catch {}
    throw new Error(msg);
  }

  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Invalid JSON response for ${path}: ${text.slice(0, 200)}`);
  }
}
