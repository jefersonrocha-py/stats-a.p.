// services/gdms.ts
import crypto from "crypto";
import { getAccessToken } from "@lib/gdmsToken";

type GdmsEnv = {
  base: string;
  appId: string;
  secret: string;
  pageSize: number;
  show: "all" | "1" | "0";
};

function env(): GdmsEnv {
  const base = process.env.GDMS_BASE ?? "https://www.gwn.cloud";
  const appId = process.env.GDMS_CLIENT_ID ?? process.env.GDMS_APP_ID ?? "";
  const secret = process.env.GDMS_CLIENT_SECRET ?? process.env.GDMS_SECRET ?? "";
  const pageSize = Number(process.env.GDMS_PAGE_SIZE ?? 200);
  const show = (process.env.GDMS_SHOW as GdmsEnv["show"]) ?? "all";
  if (!appId || !secret) throw new Error("Configure GDMS_CLIENT_ID e GDMS_CLIENT_SECRET (ou GDMS_APP_ID/GDMS_SECRET).");
  return { base, appId, secret, pageSize, show };
}

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function buildSignature(args: {
  accessToken: string; appId: string; secret: string; timestamp: string; body: string;
}) {
  const bodyHash = sha256Hex(args.body);
  const seed = `&access_token=${args.accessToken}&appID=${args.appId}&secretKey=${args.secret}&timestamp=${args.timestamp}&${bodyHash}&`;
  return sha256Hex(seed);
}

async function postJson<T>(path: string, bodyObj: any): Promise<T> {
  const { base, appId, secret } = env();
  const accessToken = await getAccessToken();

  const body = JSON.stringify(bodyObj);
  const ts = Date.now().toString();
  const signature = buildSignature({ accessToken, appId, secret, timestamp: ts, body });

  const url = `${base}${path}?access_token=${accessToken}&appID=${appId}&timestamp=${ts}&signature=${signature}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" });

  let json: any;
  try { json = await res.json(); } catch { json = { err: await res.text() }; }

  if (!res.ok) throw new Error(`GDMS ${path} ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  if (json?.retCode && String(json.retCode) !== "0") {
    throw new Error(`GDMS ${path} retCode=${json.retCode} msg=${json.msg ?? ""}`);
  }
  return json as T;
}

type NetworkRow = { id: string | number; networkName?: string };
type ApRow = { name?: string; status?: number; [k: string]: any };

export type NormalizedAp = {
  networkId: string;
  networkName: string;
  apId: string;
  apName: string;
  status: "UP" | "DOWN";
  clients: number;
  lat?: number;
  lng?: number;
};

export type NetworkClientStat = {
  networkId: string;
  networkName: string;
  aps: number;
  onlineAps: number;
  offlineAps: number;
  clients: number;
};

function pickApId(ap: any): string | undefined {
  const cand =
    ap.id ??
    ap.apId ?? ap.ap_id ?? ap.apID ??
    ap.deviceId ?? ap.device_id ??
    ap.mac ?? ap.MAC ?? ap.macAddr ?? ap.macAddress ??
    ap.serialNumber ?? ap.sn ?? ap.SN ??
    ap.uuid ?? ap.UUID;
  if (cand === undefined || cand === null) return undefined;
  const s = String(cand).trim();
  return s.length ? s : undefined;
}

function pickLat(ap: any): number | undefined {
  return (
    ap.ap_latitude ?? ap.latitude ?? ap.lat ?? ap.Latitude ?? ap.Lat ??
    ap.gpsLatitude ?? ap.gpsLat ?? ap.gps?.latitude ?? ap.gps?.lat ??
    ap.locationLatitude ?? ap.location?.latitude ?? ap.location?.lat ??
    ap.position?.latitude ?? ap.position?.lat ?? undefined
  );
}
function pickLng(ap: any): number | undefined {
  return (
    ap.ap_longitude ?? ap.longitude ?? ap.lng ?? ap.Longitude ?? ap.Lng ??
    ap.gpsLongitude ?? ap.gpsLng ?? ap.gps?.longitude ?? ap.gps?.lng ??
    ap.locationLongitude ?? ap.location?.longitude ?? ap.location?.lng ??
    ap.position?.longitude ?? ap.position?.lng ?? undefined
  );
}

function pickClients(ap: any): number {
  const raw =
    ap.clients ??
    ap.clientCount ??
    ap.clientsCount ??
    ap.clientNum ??
    ap.stationCount ??
    ap.stationNum ??
    ap.stations ??
    ap.users ??
    0;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function shouldContinue(pageNum: number, pageSize: number, info: { totalPage?: number; total?: number; received?: number }) {
  const { totalPage, total, received } = info;
  if (typeof totalPage === "number" && totalPage > 0) return pageNum < totalPage;
  if (typeof total === "number" && total > 0) return (pageNum * pageSize) < total;
  return (received ?? 0) === pageSize;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker())
  );

  return results;
}

export async function listNetworks(): Promise<Array<{ id: string; networkName: string }>> {
  const { pageSize } = env();
  let pageNum = 1;
  const out: Array<{ id: string; networkName: string }> = [];

  while (true) {
    const body = { search: "", order: "id", pageNum, pageSize };
    const json = await postJson<{ data?: { result?: NetworkRow[]; totalPage?: number; total?: number } }>(
      "/oapi/v1.0.0/network/list",
      body
    );
    const arr = json.data?.result ?? [];
    for (const n of arr) out.push({ id: String(n.id), networkName: n.networkName ?? "" });

    const totalPage = Number(json.data?.totalPage ?? 0) || undefined;
    const total = Number(json.data?.total ?? 0) || undefined;
    if (!shouldContinue(pageNum, pageSize, { totalPage, total, received: arr.length })) break;
    pageNum++;
  }
  return out;
}

export async function listAPsByNetwork(nid: string, networkName: string): Promise<NormalizedAp[]> {
  const { pageSize, show } = env();
  let pageNum = 1;
  const out: NormalizedAp[] = [];

  while (true) {
    const body = {
      search: "",
      order: "id",
      pageNum,
      pageSize,
      networkId: nid,
      filter: { showType: show },
    };

    const json = await postJson<{ data?: { result?: ApRow[]; totalPage?: number; total?: number } }>(
      "/oapi/v1.0.0/ap/list",
      body
    );

    const res = json.data?.result ?? [];
    for (const ap of res) {
      const apId = pickApId(ap);
      if (!apId) continue;
      out.push({
        networkId: nid,
        networkName,
        apId,
        apName: ap.name ?? `AP-${apId}`,
        status: (ap.status ?? 0) === 1 ? "UP" : "DOWN",
        clients: pickClients(ap),
        lat: pickLat(ap),
        lng: pickLng(ap),
      });
    }

    const totalPage = Number(json.data?.totalPage ?? 0) || undefined;
    const total = Number(json.data?.total ?? 0) || undefined;
    if (!shouldContinue(pageNum, pageSize, { totalPage, total, received: res.length })) break;
    pageNum++;
  }

  return out;
}

export async function listAllAps(): Promise<NormalizedAp[]> {
  const nets = await listNetworks();
  const all: NormalizedAp[] = [];
  for (const n of nets) {
    const aps = await listAPsByNetwork(n.id, n.networkName ?? "");
    all.push(...aps);
  }
  const seen = new Set<string>();
  const dedup: NormalizedAp[] = [];
  for (const ap of all) {
    if (!seen.has(ap.apId)) { seen.add(ap.apId); dedup.push(ap); }
  }
  return dedup;
}

export async function listConnectedClientsByNetwork(): Promise<NetworkClientStat[]> {
  const networks = await listNetworks();
  const stats = await mapWithConcurrency(networks, 4, async (network) => {
    const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
    const clients = aps.reduce((sum, ap) => sum + ap.clients, 0);
    const onlineAps = aps.reduce((sum, ap) => sum + (ap.status === "UP" ? 1 : 0), 0);

    return {
      networkId: network.id,
      networkName: network.networkName ?? "",
      aps: aps.length,
      onlineAps,
      offlineAps: Math.max(0, aps.length - onlineAps),
      clients,
    };
  });

  return stats.sort((a, b) => {
    if (b.clients !== a.clients) return b.clients - a.clients;
    return (a.networkName || a.networkId).localeCompare(b.networkName || b.networkId, "pt-BR");
  });
}
