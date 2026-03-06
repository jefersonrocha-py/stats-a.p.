"use client";

/**
 * MapClient – Mogi Mirim com limites (maxBounds) + painel à direita (revisado)
 * - Ícone da antena (faWifi) restaurado
 * - Enquadra cidade e pinos filtrados
 * - Alternância de mapa base (Satélite / OSM claro)
 * - ZoomControl em bottom-right para não conflitar com o FAB
 * - Preview de pin ao escolher Lat/Lon no modal
 * - Contagem por rede respeitando filtros
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import * as L from "leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import { api } from "@services/api";
import { connectSSE } from "@services/sseClient";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faWifi,
  faArrowsRotate,
  faMagnifyingGlass,
  faBars,
  faXmark,
  faCircleCheck,
  faCircleXmark,
  faBroom,
  faLocationCrosshairs,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// ===== helpers de ícone (usa o path do FontAwesome para gerar SVG como data URL)
function faToSvgDataUrl(icon: IconDefinition, color: string, scale = 1) {
  // IconDefinition.icon: [width, height, ligatures, unicode, svgPathData]
  const def = icon.icon as unknown as [number, number, string[], string, string | string[]];
  const [w, h, , , paths] = def;
  const d = Array.isArray(paths) ? paths.join("") : paths;
  const viewW = w * scale;
  const viewH = h * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewW}" height="${viewH}" viewBox="0 0 ${w} ${h}">
  <path d="${d}" fill="${color}"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function makeLeafletIcon(color: string, scale = 1.0) {
  return L.icon({
    iconUrl: faToSvgDataUrl(faWifi, color, scale),
    iconSize: [28 * scale, 28 * scale],
    iconAnchor: [14 * scale, 28 * scale],
    popupAnchor: [0, -28 * scale],
    className: "drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]",
  });
}

// ===== Tipos
type Antenna = {
  id: number | string;
  name: string;
  lat: number;
  lon: number;
  description?: string | null;
  status: "UP" | "DOWN" | string;
  networkName?: string | null;
  updatedAt?: string | number | Date;
};

type Role = "SUPERADMIN" | "ADMIN" | "USER";

// ===== Centro e limites de Mogi Mirim
const CITY_CENTER: LatLngExpression = [-22.431, -46.955];
const CITY_BOUNDS_ARR: LatLngBoundsExpression = [
  [-22.5, -47.05], // SW
  [-22.36, -46.86], // NE
];
const CITY_BOUNDS = L.latLngBounds(CITY_BOUNDS_ARR); // bounds real

// ===== Mapas base
type BasemapKey = "sat" | "light";
const TILE_SAT = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution:
    '&copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
};
const TILE_LIGHT = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/\">OpenStreetMap</a> contributors',
};

// ===== Comps utilitários
function FsResize() {
  const map = useMap();
  useEffect(() => {
    const onFs = () => setTimeout(() => map.invalidateSize(), 80);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("resize", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("resize", onFs);
    };
  }, [map]);
  return null;
}

function ClickPicker({
  enabled,
  setLat,
  setLon,
}: {
  enabled: boolean;
  setLat: (v: string) => void;
  setLon: (v: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!enabled) return;
      const { lat, lng } = e.latlng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setLat(String(lat.toFixed(5)));
        setLon(String(lng.toFixed(5)));
      }
    };
    map.on("click", onClick);
    // ⚠️ cleanup deve retornar void — não retorne o Map!
    return () => {
      map.off("click", onClick);
    };
  }, [map, enabled, setLat, setLon]);
  return null;
}

/** Compatível com v3/v4: inicializa com a instância real do mapa */
function MapInit({ onInit }: { onInit: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onInit(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export default function MapClient() {
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  // filtros
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UP" | "DOWN">("ALL");
  const [netFilter, setNetFilter] = useState<string>("");

  // painel
  const [panelOpen, setPanelOpen] = useState(true);

  // modal criar
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canManage = role === "ADMIN" || role === "SUPERADMIN";

  // mapa base
  const [basemap, setBasemap] = useState<BasemapKey>("sat");

  // ref do mapa
  const mapRef = useRef<L.Map | null>(null);

  const applyCityBounds = useCallback((map: L.Map) => {
    map.fitBounds(CITY_BOUNDS, { padding: [24, 24] });
  }, []);

  const onMapCreated = useCallback(
    (map: L.Map) => {
      mapRef.current = map;
      applyCityBounds(map);
    },
    [applyCityBounds],
  );

  const fitCity = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(CITY_BOUNDS, { padding: [24, 24] });
  }, []);

  // carregar antenas
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/antennas?placed=1&take=5000", { cache: "no-store" });
      const json = await res.json();
      const arr: Antenna[] = Array.isArray(json) ? json : json?.items ?? [];
      const prepared = arr
        .filter((a) => Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon)))
        .map((a) => ({ ...a, lat: Number(a.lat), lon: Number(a.lon) }));
      setAntennas(prepared);
      setLastLoadedAt(new Date().toLocaleTimeString());
    } catch {
      setAntennas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE + polling
  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    let disconnect: (() => void) | undefined;
    try {
      disconnect = connectSSE?.((e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (
            ["antenna.updated", "antenna.created", "antenna.deleted", "status.changed"].includes(
              msg.event,
            )
          ) {
            load();
          }
        } catch {}
      });
    } catch {}
    const pollId = setInterval(load, 12_000);
    return () => {
      alive = false;
      clearInterval(pollId);
      disconnect?.();
    };
  }, [load]);

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

  const iconUp = useMemo(() => makeLeafletIcon("#22c55e", 1.4), []);
  const iconDown = useMemo(() => makeLeafletIcon("#ef4444", 1.4), []);

  const term = useMemo(() => q.trim().toLowerCase(), [q]);

  const networks = useMemo(
    () => Array.from(new Set(antennas.map((a) => a.networkName ?? "").filter(Boolean))).sort(),
    [antennas],
  );

  // Helpers de filtro reutilizáveis
  const matchesStatus = useCallback(
    (a: Antenna) => statusFilter === "ALL" || a.status === statusFilter,
    [statusFilter],
  );
  const matchesSearch = useCallback(
    (a: Antenna) =>
      !term || `${a.name ?? ""} ${a.networkName ?? ""}`.toLowerCase().includes(term),
    [term],
  );

  const filtered = useMemo(() => {
    return antennas.filter((a) => {
      if (netFilter && (a.networkName ?? "") !== netFilter) return false;
      if (!matchesStatus(a)) return false;
      if (!matchesSearch(a)) return false;
      return true;
    });
  }, [antennas, netFilter, matchesStatus, matchesSearch]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const up = filtered.filter((a) => a.status === "UP").length;
    const down = filtered.filter((a) => a.status === "DOWN").length;
    return { total, up, down };
  }, [filtered]);

  const netCounts = useMemo(() => {
    // conta por rede respeitando status/busca atuais
    const map = new Map<string, number>();
    antennas.forEach((a) => {
      const n = a.networkName ?? "";
      if (!n) return;
      if (!matchesStatus(a)) return;
      if (!matchesSearch(a)) return;
      map.set(n, (map.get(n) ?? 0) + 1);
    });
    return map;
  }, [antennas, matchesSearch, matchesStatus]);

  const clearFilters = useCallback(() => {
    setQ("");
    setStatusFilter("ALL");
    setNetFilter("");
  }, []);

  const tempPos = useMemo(() => {
    const latNum = Number(lat.toString().replace(",", "."));
    const lonNum = Number(lon.toString().replace(",", "."));
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) return null;
    return [latNum, lonNum] as [number, number];
  }, [lat, lon]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      const latNum = Number(lat.toString().replace(",", "."));
      const lonNum = Number(lon.toString().replace(",", "."));
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        setErr("Latitude/Longitude inválidas.");
        return;
      }
      if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        setErr("Fora do intervalo geográfico.");
        return;
      }
      setSaving(true);
      setErr(null);
      try {
        const body = {
          name: name.trim(),
          lat: latNum,
          lon: lonNum,
          description: desc.trim() || undefined,
        };
        const created = await api<any>("/api/antennas", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const createdItem = created?.item ?? created;
        setAntennas((prev) => (createdItem && createdItem.id ? [createdItem, ...prev] : prev));
        setName("");
        setLat("");
        setLon("");
        setDesc("");
        setOpenModal(false);
      } catch (er: any) {
        setErr(er?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [saving, lat, lon, name, desc],
  );

  const fitPins = useCallback(() => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;
    const bounds = L.latLngBounds(filtered.map((a) => [a.lat, a.lon] as [number, number]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28] });
  }, [filtered]);

  return (
    <div id="map-root" className="relative h-[calc(100vh-8rem)] w-full rounded-xl overflow-hidden shadow-inner">
      {/* Botões do topo direito */}
      <div className="absolute z-[1005] top-4 right-4 flex gap-2 pointer-events-none">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="pointer-events-auto inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-white/85 text-black hover:bg-white shadow-lg"
          title={panelOpen ? "Fechar painel" : "Abrir painel"}
        >
          <FontAwesomeIcon icon={faXmark} className={`h-4 w-4 ${panelOpen ? "" : "hidden"}`} />
          <FontAwesomeIcon icon={faBars} className={`h-4 w-4 ${panelOpen ? "hidden" : ""}`} />
          <span className="text-sm">{panelOpen ? "Fechar" : "Painel"}</span>
        </button>
        <button
          onClick={fitCity}
          className="pointer-events-auto inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-white/85 text-black hover:bg-white shadow-lg"
          title="Enquadrar cidade"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-4 w-4" />
          <span className="text-sm">Cidade</span>
        </button>
        <button
          onClick={fitPins}
          disabled={filtered.length === 0}
          className="pointer-events-auto inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-white/85 text-black hover:bg-white shadow-lg disabled:opacity-50"
          title="Enquadrar pinos filtrados"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-4 w-4" />
          <span className="text-sm">Pinos</span>
        </button>
        <select
          value={basemap}
          onChange={(e) => setBasemap(e.target.value as BasemapKey)}
          className="pointer-events-auto h-10 rounded-xl bg-white/85 text-black hover:bg-white shadow-lg px-2 text-sm"
          title="Mapa base"
          aria-label="Selecionar mapa base"
        >
          <option value="sat">Satélite</option>
          <option value="light">Claro (OSM)</option>
        </select>
      </div>

      {/* PAINEL LATERAL (direito) */}
      <div
        className={`absolute z-[1004] top-16 right-4 w-[320px] max-h-[70vh] overflow-hidden rounded-2xl
          backdrop-blur-md bg-white/20 dark:bg-black/30 ring-1 ring-white/30 shadow-xl transition-all
          ${panelOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"}`}
      >
        <div className="p-3 space-y-3 overflow-y-auto">
          {/* Filtros rápidos */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="pl-8 pr-3 py-2 w-full rounded-lg bg-white/85 text-black placeholder-black/60 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Buscar por nome/rede…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar por nome ou rede"
              />
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="h-4 w-4 text-black/70 absolute left-2 top-1/2 -translate-y-1/2"
              />
            </div>
            <button
              onClick={load}
              className="px-3 h-10 rounded-lg bg-white/85 text-black hover:bg-white"
              title="Recarregar"
              aria-label="Recarregar"
            >
              <FontAwesomeIcon icon={faArrowsRotate} className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2 py-2 rounded-lg text-sm ${
                statusFilter === "ALL" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter("UP")}
              className={`px-2 py-2 rounded-lg text-sm flex items-center justify-center gap-1 ${
                statusFilter === "UP" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
              }`}
            >
              <FontAwesomeIcon icon={faCircleCheck} /> UP
            </button>
            <button
              onClick={() => setStatusFilter("DOWN")}
              className={`px-2 py-2 rounded-lg text-sm flex items-center justify-center gap-1 ${
                statusFilter === "DOWN" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
              }`}
            >
              <FontAwesomeIcon icon={faCircleXmark} /> DOWN
            </button>
          </div>

          {/* Totais */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-white/25 p-2">
              <div className="text-xs opacity-80">Pins</div>
              <div className="text-lg font-semibold">{totals.total}</div>
            </div>
            <div className="rounded-xl bg-white/25 p-2">
              <div className="text-xs opacity-80">UP</div>
              <div className="text-lg font-semibold text-emerald-300">{totals.up}</div>
            </div>
            <div className="rounded-xl bg-white/25 p-2">
              <div className="text-xs opacity-80">DOWN</div>
              <div className="text-lg font-semibold text-red-300">{totals.down}</div>
            </div>
          </div>

          {/* Filtro por Rede */}
          <div className="space-y-1">
            <div className="text-xs opacity-80">Redes ({networks.length})</div>
            <div className="max-h-[26vh] overflow-auto pr-1">
              <button
                onClick={() => setNetFilter("")}
                className={`w-full text-left px-2 py-1 rounded-lg text-sm mb-1 ${
                  netFilter === "" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
                }`}
              >
                Todas as redes
              </button>
              {networks.map((n) => {
                const count = netCounts.get(n) ?? 0;
                return (
                  <button
                    key={n}
                    onClick={() => setNetFilter((prev) => (prev === n ? "" : n))}
                    className={`w-full text-left px-2 py-1 rounded-lg text-sm mb-1 ${
                      netFilter === n ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
                    }`}
                    title={n}
                  >
                    <span className="line-clamp-1">{n}</span>
                    <span className="float-right opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={clearFilters}
              className="w-full mt-2 px-3 py-2 rounded-lg bg-white/85 text-black hover:bg-white text-sm flex items-center gap-2 justify-center"
            >
              <FontAwesomeIcon icon={faBroom} /> Limpar filtros
            </button>
          </div>

          {/* Rodapé do painel */}
          <div className="text-xs opacity-80 text-center">
            {lastLoadedAt ? `Atualizado: ${lastLoadedAt}` : "—"}
          </div>
        </div>
      </div>

      {/* MAPA */}
      <MapContainer
        center={CITY_CENTER}
        zoom={12}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
        preferCanvas
        minZoom={10}
        maxZoom={19}
        worldCopyJump={false}
        maxBounds={CITY_BOUNDS}
        maxBoundsViscosity={1.0}
        doubleClickZoom
      >
        {/* Zoom em posição que não conflita com o FAB (FAB está bottom-left) */}
        <ZoomControl position="bottomright" />

        {/* Mapa base */}
        {basemap === "sat" ? (
          <TileLayer url={TILE_SAT.url} attribution={TILE_SAT.attribution} />
        ) : (
          <TileLayer url={TILE_LIGHT.url} attribution={TILE_LIGHT.attribution} />
        )}

        {/* Inicialização segura da instância do mapa */}
        <MapInit onInit={onMapCreated} />
        <FsResize />
        <ClickPicker enabled={openModal} setLat={setLat} setLon={setLon} />

        {!loading &&
          filtered.map((a) => (
            <Marker key={a.id} position={[a.lat, a.lon]} icon={a.status === "DOWN" ? iconDown : iconUp}>
              <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                {a.name}
              </Tooltip>
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{a.name}</div>
                  {a.networkName && <div className="opacity-80">{a.networkName}</div>}
                  <div className="opacity-80">
                    {a.lat.toFixed(5)}, {a.lon.toFixed(5)}
                  </div>
                  {a.description && <div className="opacity-80">{a.description}</div>}
                  <div>
                    Status:{" "}
                    <span
                      className={a.status === "DOWN" ? "text-red-500 font-medium" : "text-emerald-400 font-medium"}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Pré-visualização do pin enquanto o modal está aberto */}
        {openModal && tempPos && <Marker position={tempPos} icon={iconUp} />}
      </MapContainer>

      {/* FAB: Adicionar */}
      {canManage && (
        <div className="pointer-events-none absolute bottom-6 left-6 z-[1003]">
          <button
            onClick={() => setOpenModal(true)}
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
            title="Adicionar nova antena"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            <span className="font-medium">Adicionar</span>
          </button>
        </div>
      )}

      {/* Modal Nova Antena */}
      {canManage && openModal && (
        <div
          className="absolute inset-0 z-[1006] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white/90 dark:bg-neutral-900 text-black dark:text-white shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
            <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nova Antena</h3>
              <button
                onClick={() => setOpenModal(false)}
                className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <form className="p-5 space-y-3" onSubmit={handleCreate}>
              <input
                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                />
                <input
                  className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Longitude"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  required
                />
              </div>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Descrição (opcional)"
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              {err && (
                <div className="text-xs text-red-600 bg-red-600/10 border border-red-600/30 rounded p-2">
                  {err}
                </div>
              )}
              <div className="pt-1 flex items-center justify-between">
                <p className="text-xs opacity-80">Dica: clique no mapa com o modal aberto para preencher Lat/Lon.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal(false)}
                    className="px-4 h-10 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 h-10 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
