"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCards from "../../../components/DashboardCards";
import DonutChart from "../../../components/DonutChart";
import { toCSV } from "../../../lib/csv";
import { api, type Antenna, type Stats } from "../../../services/api";
import { connectSSE } from "../../../services/sseClient";

type Role = "SUPERADMIN" | "ADMIN" | "USER";

export default function DashboardPage() {
  const [list, setList] = useState<Antenna[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [chartVariant, setChartVariant] = useState<"donut" | "gauge" | "radial">("donut");
  const [showLegend, setShowLegend] = useState(true);

  const canManage = role === "ADMIN" || role === "SUPERADMIN";

  async function load() {
    const [listResponse, statsResponse] = await Promise.all([
      api<any>("/api/antennas?take=500"),
      api<Stats>("/api/stats"),
    ]);

    const items: Antenna[] = Array.isArray(listResponse) ? listResponse : (listResponse?.items ?? []);
    setList(Array.isArray(items) ? items : []);
    setStats(statsResponse || null);
  }

  useEffect(() => {
    load();

    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          ["antenna.created", "antenna.updated", "antenna.deleted", "status.changed"].includes(
            payload.event
          )
        ) {
          load();
        }
      } catch {}
    });

    return disconnect;
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ q?: string }>;
      setQ((custom.detail?.q || "").toLowerCase());
    };

    window.addEventListener("search-antennas", handler as EventListener);
    return () => window.removeEventListener("search-antennas", handler as EventListener);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const json = await response.json();
        if (!alive) return;
        if (json?.ok && json?.user?.role) setRole(json.user.role as Role);
        else setRole(null);
      } catch {
        if (alive) setRole(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      list.filter((antenna) => {
        const name = (antenna?.name ?? "").toLowerCase();
        const networkName = antenna?.networkName ? String(antenna.networkName).toLowerCase() : "";
        return name.includes(q) || networkName.includes(q);
      }),
    [list, q]
  );

  const cardsData = useMemo(() => {
    if (!stats) return null;

    const up = (stats.up ?? (stats as any).online ?? 0) as number;
    const down = (stats.down ?? (stats as any).offline ?? 0) as number;
    const inferredTotal = up + down + (stats.unknown ?? 0);
    const total = (stats.total ?? inferredTotal) as number;
    const denominator = total || inferredTotal || 1;

    return {
      total,
      up,
      down,
      unknown: stats.unknown ?? Math.max(0, total - up - down),
      upPct: Number(((up / denominator) * 100).toFixed(2)),
      downPct: Number(((down / denominator) * 100).toFixed(2)),
    };
  }, [stats]);

  async function toggleStatus(antenna: Antenna) {
    const next = antenna.status === "UP" ? "DOWN" : "UP";
    await api(`/api/antennas/${antenna.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  async function removeAntenna(antenna: Antenna) {
    if (!confirm(`Excluir ${antenna.name}?`)) return;
    await api(`/api/antennas/${antenna.id}`, { method: "DELETE" });
    await load();
  }

  function exportCSV() {
    const csv = toCSV(
      filtered.map((antenna: any) => ({
        Nome: antenna.name,
        Rede: antenna.networkName ?? "",
        Lat: typeof antenna.lat === "number" ? antenna.lat : antenna.lat ?? "",
        Lon: typeof antenna.lon === "number" ? antenna.lon : antenna.lon ?? "",
        Status: antenna.status,
        AtualizadoEm:
          typeof antenna.updatedAt === "string"
            ? antenna.updatedAt
            : antenna.updatedAt
              ? new Date(antenna.updatedAt as any).toISOString()
              : "",
      }))
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "antenas.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {cardsData && (
        <DashboardCards
          total={cardsData.total}
          up={cardsData.up}
          down={cardsData.down}
          upPct={cardsData.upPct}
          downPct={cardsData.downPct}
        />
      )}

      {cardsData && (
        <div className="glass space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
              {(["donut", "gauge", "radial"] as const).map((variant) => (
                <button
                  key={variant}
                  onClick={() => setChartVariant(variant)}
                  className={`px-3 py-1.5 text-sm ${
                    chartVariant === variant
                      ? "bg-brand1 text-white"
                      : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                  }`}
                  aria-pressed={chartVariant === variant}
                >
                  {variant === "donut" ? "Donut" : variant === "gauge" ? "Gauge" : "Radial"}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(event) => setShowLegend(event.target.checked)}
              />
              Mostrar legenda
            </label>
          </div>

          <DonutChart
            up={cardsData.up}
            down={cardsData.down}
            unknown={cardsData.unknown}
            variant={chartVariant}
            showLegend={showLegend}
            height={280}
          />
        </div>
      )}

      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="flex flex-col items-stretch justify-between gap-2 md:flex-row md:items-center">
          <div className="w-full md:w-96">
            <input
              placeholder="Filtrar por AP ou rede..."
              className="w-full rounded-lg bg-white/70 px-3 py-2 dark:bg-white/5"
              value={q}
              onChange={(event) => setQ(event.target.value.toLowerCase())}
              aria-label="Filtro por AP ou rede"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="rounded bg-brand1 px-3 py-2 text-white hover:opacity-90"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <DashboardCards
          total={cardsData?.total ?? 0}
          up={cardsData?.up ?? 0}
          down={cardsData?.down ?? 0}
          upPct={cardsData?.upPct ?? 0}
          downPct={cardsData?.downPct ?? 0}
          items={filtered}
          pageSize={50}
          renderHeader={() => (
            <tr>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">Rede</th>
              <th className="p-2 text-left">Latitude</th>
              <th className="p-2 text-left">Longitude</th>
              <th className="p-2 text-left">Ultima atualizacao</th>
              <th className="p-2 text-left">Status</th>
              {canManage && <th className="p-2 text-left">Acoes</th>}
            </tr>
          )}
          renderRow={(antenna: any) => {
            const latStr = typeof antenna.lat === "number" ? antenna.lat.toFixed(5) : antenna.lat ?? "-";
            const lonStr = typeof antenna.lon === "number" ? antenna.lon.toFixed(5) : antenna.lon ?? "-";
            const updatedStr =
              typeof antenna.updatedAt === "string"
                ? new Date(antenna.updatedAt).toLocaleString()
                : antenna.updatedAt
                  ? new Date(antenna.updatedAt as any).toLocaleString()
                  : "-";

            return (
              <tr key={antenna.id} className="border-t border-black/10 dark:border-white/10">
                <td className="p-2">{antenna.name}</td>
                <td className="p-2">{antenna.networkName ?? "-"}</td>
                <td className="p-2">{latStr}</td>
                <td className="p-2">{lonStr}</td>
                <td className="p-2 text-xs opacity-70">{updatedStr}</td>
                <td className="p-2">
                  <span className={antenna.status === "UP" ? "text-green-600" : "text-red-600"}>
                    {antenna.status}
                  </span>
                </td>
                {canManage && (
                  <td className="space-x-2 p-2">
                    <button
                      onClick={() => toggleStatus(antenna)}
                      className="rounded bg-brand1 px-2 py-1 text-white hover:opacity-90"
                    >
                      Toggle
                    </button>
                    <button
                      onClick={() => removeAntenna(antenna)}
                      className="rounded bg-red-600 px-2 py-1 text-white hover:opacity-90"
                    >
                      Excluir
                    </button>
                  </td>
                )}
              </tr>
            );
          }}
          tableAriaLabel="Tabela de antenas paginada"
        />
      </div>
    </div>
  );
}
