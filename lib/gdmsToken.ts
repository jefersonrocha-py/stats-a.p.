import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQueryOne } from "@lib/mysql";

// Memoria local para reduzir IO, mas a verdade fica no DB
type TokenRecord = { accessToken: string; expiresAt: number };
const mem = { token: null as TokenRecord | null };

type TokenRow = RowDataPacket & {
  accessToken: string;
  expiresAt: Date | string;
};

const SKEW_MS = 60_000;
const OAUTH_TIMEOUT_MS = 15_000;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getValidatedUrl(name: string) {
  const raw = getRequiredEnv(name);
  const url = new URL(raw);

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }

  return url.toString();
}

function now() {
  return Date.now();
}

function willExpireSoon(expiresAt: number, skewMs = SKEW_MS) {
  return expiresAt <= now() + skewMs;
}

async function loadFromDb(): Promise<TokenRecord | null> {
  const row = await dbQueryOne<TokenRow>(
    "SELECT `accessToken`, `expiresAt` FROM `gdms_token` WHERE `id` = 1 LIMIT 1"
  ).catch(() => null);
  if (!row) return null;
  return { accessToken: row.accessToken, expiresAt: new Date(row.expiresAt).getTime() };
}

async function saveToDb(tok: TokenRecord): Promise<void> {
  await dbExecute(
    "INSERT INTO `gdms_token` (`id`, `accessToken`, `expiresAt`, `updatedAt`) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE `accessToken` = VALUES(`accessToken`), `expiresAt` = VALUES(`expiresAt`), `updatedAt` = VALUES(`updatedAt`)",
    [tok.accessToken, new Date(tok.expiresAt), new Date()]
  );
  mem.token = tok;
}

async function fetchClientCredentialsToken(): Promise<TokenRecord> {
  const url = getValidatedUrl("GDMS_OAUTH_URL");
  const clientId = getRequiredEnv("GDMS_CLIENT_ID");
  const clientSecret = getRequiredEnv("GDMS_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`OAuth token request failed with status ${res.status}.`);
  }

  const json = await res.json();
  const accessToken = json?.access_token ?? json?.token;
  const ttlSec = json?.expires_in ?? 3600;
  if (!accessToken) throw new Error("OAuth token response missing access_token");
  return { accessToken, expiresAt: now() + ttlSec * 1000 };
}

export async function refreshToken(): Promise<TokenRecord> {
  const rec = await fetchClientCredentialsToken();
  await saveToDb(rec);
  return rec;
}

export async function getAccessToken(): Promise<string> {
  if (mem.token && !willExpireSoon(mem.token.expiresAt)) {
    return mem.token.accessToken;
  }

  const dbTok = await loadFromDb();
  if (dbTok && !willExpireSoon(dbTok.expiresAt)) {
    mem.token = dbTok;
    return dbTok.accessToken;
  }

  const newTok = await refreshToken();
  return newTok.accessToken;
}

export async function forceRefresh() {
  return refreshToken();
}

export async function getTokenInfo() {
  const dbTok = await loadFromDb();
  const exp = dbTok?.expiresAt ?? 0;
  return {
    hasToken: !!dbTok,
    expiresAt: exp,
    expiresInSec: exp ? Math.max(0, Math.floor((exp - now()) / 1000)) : null,
  };
}
