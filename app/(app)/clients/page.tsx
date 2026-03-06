"use client";

import { useEffect, useState } from "react";
import Client from "@components/Client";
import { api, type NetworkClientStatsResponse } from "@services/api";

export default function ClientsPage() {
  const [networkClientStats, setNetworkClientStats] = useState<NetworkClientStatsResponse | null>(null);
  const [networkClientError, setNetworkClientError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadClientStats() {
      try {
        const response = await api<NetworkClientStatsResponse>("/api/stats/network-clients");
        if (!active) return;
        setNetworkClientStats(response || null);
        setNetworkClientError(null);
      } catch {
        if (!active) return;
        setNetworkClientError("Nao foi possivel carregar os clientes por network no GDMS agora.");
      }
    }

    loadClientStats();
    const refreshTimer = window.setInterval(loadClientStats, 60_000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  return (
    <div className="space-y-4">
      <section className="glass rounded-3xl p-5">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-2 max-w-3xl text-sm opacity-75">
          Painel dedicado aos clientes conectados por network no GDMS, separado das metricas
          operacionais do dashboard principal.
        </p>
      </section>

      <Client
        items={networkClientStats?.items ?? []}
        totalClients={networkClientStats?.totalClients ?? 0}
        totalNetworks={networkClientStats?.totalNetworks ?? 0}
        generatedAt={networkClientStats?.generatedAt ?? null}
        isLoading={!networkClientStats && !networkClientError}
        error={networkClientError}
      />
    </div>
  );
}
