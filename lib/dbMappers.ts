function toIso(value: unknown) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export function mapAntennaRow(row: Record<string, any>) {
  return {
    ...row,
    id: Number(row.id),
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    lon: row.lon === null || row.lon === undefined ? null : Number(row.lon),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    lastSyncAt: toIso(row.lastSyncAt),
    lastStatusChange: toIso(row.lastStatusChange),
  };
}

export function mapUserRow(row: Record<string, any>) {
  return {
    ...row,
    id: Number(row.id),
    isBlocked: toBoolean(row.isBlocked),
    createdAt: toIso(row.createdAt),
  };
}

export function mapStatusHistoryRow(row: Record<string, any>) {
  return {
    ...row,
    id: Number(row.id),
    antennaId: Number(row.antennaId),
    changedAt: toIso(row.changedAt),
  };
}
