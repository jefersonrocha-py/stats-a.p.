// app/(app)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
// ✅ trocado de @services/* para caminhos relativos
import { api, Antenna, Stats } from "../../../services/api";
import DashboardCards from "../../../components/DashboardCards";
import DonutChart from "../../../components/DonutChart";
import { toCSV } from "../../../lib/csv";
import { connectSSE } from "../../../services/sseClient";

export default function DashboardPage() {
  const [list, setList] = useState<Antenna[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");

  // Controles do gráfico
  const [chartVariant, setChartVariant] = useState<"donut" | "gauge" | "radial">("donut");
  const [showLegend, setShowLegend] = useState(true);

  async function load() {
    const [lRaw, s] = await Promise.all([
      api<any>("/api/antennas?take=500"),
      api<Stats>("/api/stats"),
    ]);

    const l: Antenna[] = Array.isArray(lRaw) ? lRaw : (lRaw?.items ?? []);
    setList(Array.isArray(l) ? l : []);
    setStats(s || null);
  }

  useEffect(() => {
    load();
    const disconnect = connectSSE((e) => {
      try {
        const msg = JSON.parse(e.data);
        if (
          ["antenna.created", "antenna.updated", "antenna.deleted", "status.changed"].includes(
            msg.event
          )
        ) {
          load();
        }
      } catch {}
    });
    return disconnect;
  }, []);

  useEffect(() => {
    const handler = (e: any) => setQ((e.detail?.q || "").toLowerCase());
    window.addEventListener("search-antennas", handler as any);
    return () => window.removeEventListener("search-antennas", handler as any);
  }, []);

  const filtered = useMemo(
    () =>
      (Array.isArray(list) ? list : []).filter((a) => {
        const name = (a?.name ?? "").toLowerCase();
        const net = (a as any)?.networkName ? String((a as any).networkName).toLowerCase() : "";
        return name.includes(q) || net.includes(q);
      }),
    [list, q]
  );

  const cardsData = useMemo(() => {
    if (!stats) return null;

    const up = (stats.up ?? (stats as any).online ?? 0) as number;
    const down = (stats.down ?? (stats as any).offline ?? 0) as number;
    const inferredTotal = up + down + (stats.unknown ?? 0);
    const total = (stats.total ?? inferredTotal) as number;

    const denom = total || inferredTotal || 1;
    const upPct = Number(((up / denom) * 100).toFixed(2));
    const downPct = Number(((down / denom) * 100).toFixed(2));
    const unknown = stats.unknown ?? Math.max(0, total - up - down);

    return {
      total,
      up,
      down,
      unknown,
      upPct,
      downPct,
      byModel: stats.byModel,
    };
  }, [stats]);

  async function toggleStatus(a: Antenna) {
    const next = a.status === "UP" ? "DOWN" : "UP";
    await api(`/api/antennas/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  async function del(a: Antenna) {
    if (!confirm(`Excluir ${a.name}?`)) return;
    await api(`/api/antennas/${a.id}`, { method: "DELETE" });
    await load();
  }

  function exportCSV() {
    const csv = toCSV(
      filtered.map((a: any) => ({
        Nome: a.name,
        Rede: a.networkName ?? "",
        Lat: typeof a.lat === "number" ? a.lat : a.lat ?? "",
        Lon: typeof a.lon === "number" ? a.lon : a.lon ?? "",
        Status: a.status,
        AtualizadoEm:
          typeof a.updatedAt === "string"
            ? a.updatedAt
            : a.updatedAt
            ? new Date(a.updatedAt as any).toISOString()
            : "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const aTag = document.createElement("a");
    aTag.href = url;
    aTag.download = "antenas.csv";
    aTag.click();
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
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
              {(["donut", "gauge", "radial"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setChartVariant(v)}
                  className={`px-3 py-1.5 text-sm ${
                    chartVariant === v
                      ? "bg-brand1 text-white"
                      : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
                  }`}
                  aria-pressed={chartVariant === v}
                >
                  {v === "donut" ? "Donut" : v === "gauge" ? "Gauge" : "Radial"}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
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

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          <div className="w-full md:w-96">
            <input
              placeholder="Filtrar por AP ou Rede..."
              className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg白/5"
              value={q}
              onChange={(e) => setQ(e.target.value.toLowerCase())}
              aria-label="Filtro por AP ou Rede"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="px-3 py-2 rounded bg-brand1 text-white hover:opacity-90"
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
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Rede</th>
              <th className="text-left p-2">Latitude</th>
              <th className="text-left p-2">Longitude</th>
              <th className="text-left p-2">Última atualização</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          )}
          renderRow={(a: any) => {
            const latStr = typeof a.lat === "number" ? a.lat.toFixed(5) : a.lat ?? "-";
            const lonStr = typeof a.lon === "number" ? a.lon.toFixed(5) : a.lon ?? "-";
            const updatedStr =
              typeof a.updatedAt === "string"
                ? new Date(a.updatedAt).toLocaleString()
                : a.updatedAt
                ? new Date(a.updatedAt as any).toLocaleString()
                : "-";
            return (
              <tr key={a.id} className="border-t border-black/10 dark:border白/10">
                <td className="p-2">{a.name}</td>
                <td className="p-2">{a.networkName ?? "-"}</td>
                <td className="p-2">{latStr}</td>
                <td className="p-2">{lonStr}</td>
                <td className="p-2 text-xs opacity-70">{updatedStr}</td>
                <td className="p-2">
                  <span className={a.status === "UP" ? "text-green-600" : "text-red-600"}>
                    {a.status}
                  </span>
                </td>
                <td className="p-2 space-x-2">
                  <button
                    onClick={() => toggleStatus(a)}
                    className="px-2 py-1 rounded bg-brand1 text-white hover:opacity-90"
                  >
                    Toggle
                  </button>
                  <button
                    onClick={() => del(a)}
                    className="px-2 py-1 rounded bg-red-600 text-white hover:opacity-90"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            );
          }}
          tableAriaLabel="Tabela de antenas paginada"
        />
      </div>
    </div>
  );
}
