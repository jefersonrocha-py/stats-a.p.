"use client";

import { useEffect, useState } from "react";
import AntennaToolbar from "@components/AntennaToolbar";
import PaginationControls from "@components/PaginationControls";
import { api, type Antenna, type AntennaListResponse, type AntennaNetworksResponse } from "@services/api";
import { connectSSE } from "@services/sseClient";

type DraftRow = {
  lat: string;
  lon: string;
  description: string;
};

function buildPath({
  page,
  pageSize,
  query,
  network,
}: {
  page: number;
  pageSize: number;
  query: string;
  network: string;
}) {
  const params = new URLSearchParams();
  params.set("unsaved", "1");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (query.trim()) params.set("q", query.trim());
  if (network) params.set("network", network);
  return `/api/antennas?${params.toString()}`;
}

function antennaId(value: string | number) {
  return Number(value);
}

export default function SettingsPage() {
  const [items, setItems] = useState<Antenna[]>([]);
  const [networks, setNetworks] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<number, DraftRow>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const response = await api<AntennaListResponse>(
          buildPath({ page, pageSize, query, network })
        );
        if (!alive) return;

        setItems(response.items ?? []);
        setTotalCount(response.totalCount ?? 0);
        setTotalPages(response.totalPages ?? 1);
        if (response.page && response.page !== page) setPage(response.page);

        setDraft((prev) => {
          const next = { ...prev };
          for (const antenna of response.items ?? []) {
            const id = antennaId(antenna.id);
            next[id] = {
              lat:
                prev[id]?.lat ??
                (typeof antenna.lat === "number" ? String(antenna.lat) : String(antenna.lat ?? 0)),
              lon:
                prev[id]?.lon ??
                (typeof antenna.lon === "number" ? String(antenna.lon) : String(antenna.lon ?? 0)),
              description: prev[id]?.description ?? String(antenna.description ?? ""),
            };
          }
          return next;
        });
      } catch {
        if (alive) {
          setItems([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [page, pageSize, query, network, refreshKey]);

  useEffect(() => {
    let alive = true;

    async function loadNetworks() {
      try {
        const response = await api<AntennaNetworksResponse>("/api/antennas/networks");
        if (alive) setNetworks(response.items ?? []);
      } catch {
        if (alive) setNetworks([]);
      }
    }

    loadNetworks();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          ["antenna.created", "antenna.updated", "antenna.deleted", "status.changed"].includes(
            payload.event
          )
        ) {
          setRefreshKey((value) => value + 1);
        }
      } catch {}
    });

    return disconnect;
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ q?: string }>;
      setQuery(custom.detail?.q || "");
      setPage(1);
    };

    window.addEventListener("search-antennas", handler as EventListener);
    return () => window.removeEventListener("search-antennas", handler as EventListener);
  }, []);

  function updateDraft(id: number, field: keyof DraftRow, value: string) {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        lat: prev[id]?.lat ?? "",
        lon: prev[id]?.lon ?? "",
        description: prev[id]?.description ?? "",
        [field]: value,
      },
    }));
  }

  async function doSync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/integrations/gdms/sync", { method: "POST" });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        alert(`Sync falhou: ${json?.error ?? response.statusText}`);
      }
      setRefreshKey((value) => value + 1);
    } catch (error: any) {
      alert(`Sync erro: ${error?.message ?? error}`);
    } finally {
      setSyncing(false);
    }
  }

  async function saveRow(antenna: Antenna) {
    const id = antennaId(antenna.id);
    const row = draft[id] ?? { lat: "", lon: "", description: "" };
    const response = await fetch(`/api/antennas/${id}/coords`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: row.lat,
        lon: row.lon,
        description: row.description,
      }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      alert(`Falha ao salvar: ${json?.error ?? response.statusText}`);
      return;
    }

    if (items.length === 1 && page > 1) setPage(page - 1);
    else setRefreshKey((value) => value + 1);
  }

  function onKeySave(event: React.KeyboardEvent, antenna: Antenna) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveRow(antenna);
  }

  return (
    <div className="space-y-4">
      <AntennaToolbar
        title="Configuracoes"
        description="Tela para posicionar APs sem coordenadas. Filtre por nome ou cluster, sincronize o GDMS e avance em lotes com paginação."
        query={query}
        network={network}
        networks={networks}
        pageSize={pageSize}
        totalCount={totalCount}
        queryPlaceholder="Buscar por AP ou rede..."
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onNetworkChange={(value) => {
          setNetwork(value);
          setPage(1);
        }}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
        extraAction={
          <button
            type="button"
            onClick={doSync}
            disabled={syncing}
            className="rounded-2xl bg-brand1 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sincronizar GDMS"}
          </button>
        }
      />

      <section className="glass rounded-3xl p-5">
        <div className="mb-4 text-sm opacity-75">
          Preencha latitude, longitude e observacoes. Ao salvar, o AP sai automaticamente da fila
          de pendencias.
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-3 text-left">Nome do AP</th>
                <th className="p-3 text-left">Rede</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Latitude</th>
                <th className="p-3 text-left">Longitude</th>
                <th className="p-3 text-left">Observacoes</th>
                <th className="p-3 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((antenna) => {
                  const id = antennaId(antenna.id);
                  const row = draft[id] ?? { lat: "", lon: "", description: "" };
                  const isUp = antenna.status === "UP";

                  return (
                    <tr key={id} className="border-t border-black/10 dark:border-white/10">
                      <td className="p-3">{antenna.name}</td>
                      <td className="p-3">{antenna.networkName ?? "-"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            isUp
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                          }`}
                        >
                          {isUp ? "UP" : "DOWN"}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          value={row.lat}
                          onChange={(event) => updateDraft(id, "lat", event.target.value)}
                          onKeyDown={(event) => onKeySave(event, antenna)}
                          placeholder="-23.50000"
                          inputMode="decimal"
                          className="w-32 rounded-xl border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={row.lon}
                          onChange={(event) => updateDraft(id, "lon", event.target.value)}
                          onKeyDown={(event) => onKeySave(event, antenna)}
                          placeholder="-46.60000"
                          inputMode="decimal"
                          className="w-32 rounded-xl border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={row.description}
                          onChange={(event) => updateDraft(id, "description", event.target.value)}
                          onKeyDown={(event) => onKeySave(event, antenna)}
                          placeholder="Ponto de referencia / observacoes"
                          className="w-full min-w-64 rounded-xl border border-black/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                        />
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => saveRow(antenna)}
                          className="rounded-xl bg-brand1 px-4 py-2 text-white transition hover:opacity-90"
                        >
                          Salvar
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Nenhum AP pendente no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="APs pendentes"
        />
      </section>
    </div>
  );
}
