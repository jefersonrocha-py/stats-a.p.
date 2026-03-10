"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  LngLatBounds,
  NavigationControl,
  Popup,
  type LngLatBoundsLike,
  type LngLatLike,
  type MapMouseEvent,
  type Marker,
  type StyleSpecification,
} from "maplibre-gl";

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
  faCompass,
  faChevronUp,
  faChevronRight,
  faChevronDown,
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

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
type BasemapKey = "sat" | "light";
type BasemapDefinition = {
  tiles: string[];
  attribution: string;
};

const CITY_CENTER: LngLatLike = [-46.955, -22.431];
const CITY_BOUNDS: LngLatBoundsLike = [
  [-47.05, -22.5],
  [-46.86, -22.36],
];

const TILE_SAT: BasemapDefinition = {
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  attribution:
    '&copy; <a href="https://www.esri.com/">Esri</a> - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
};

const TILE_LIGHT: BasemapDefinition = {
  tiles: [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
};

const JOYSTICK_RADIUS = 26;

function faToSvgMarkup(icon: IconDefinition, color: string, scale = 1) {
  const def = icon.icon as unknown as [number, number, string[], string, string | string[]];
  const [width, height, , , paths] = def;
  const d = Array.isArray(paths) ? paths.join("") : paths;
  const viewWidth = width * scale;
  const viewHeight = height * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${width} ${height}" aria-hidden="true" style="display:block;filter:drop-shadow(0 6px 10px rgba(0,0,0,0.35));">
    <path d="${d}" fill="${color}" />
  </svg>`;
}

function makeMarkerElement(color: string, label: string, scale = 1.05, isPreview = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.title = label;
  element.setAttribute("aria-label", label);
  element.innerHTML = faToSvgMarkup(faWifi, color, scale);
  element.style.background = "transparent";
  element.style.border = "0";
  element.style.padding = "0";
  element.style.cursor = "pointer";
  element.style.transformOrigin = "50% 100%";
  element.style.opacity = isPreview ? "0.9" : "1";
  return element;
}

function appendText(parent: HTMLElement, text: string, className?: string) {
  const node = document.createElement("div");
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function buildPopupContent(antenna: Antenna) {
  const root = document.createElement("div");
  root.className = "space-y-1 text-sm";

  appendText(root, antenna.name, "font-semibold");

  if (antenna.networkName) {
    appendText(root, antenna.networkName, "opacity-80");
  }

  appendText(root, `${antenna.lat.toFixed(5)}, ${antenna.lon.toFixed(5)}`, "opacity-80");

  if (antenna.description) {
    appendText(root, antenna.description, "opacity-80");
  }

  const statusLine = document.createElement("div");
  statusLine.textContent = "Status: ";

  const statusValue = document.createElement("span");
  statusValue.className =
    antenna.status === "DOWN" ? "text-red-500 font-medium" : "text-emerald-500 font-medium";
  statusValue.textContent = antenna.status;

  statusLine.appendChild(statusValue);
  root.appendChild(statusLine);

  return root;
}

function normalizeBearing(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getBearingLabel(value: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(normalizeBearing(value) / 45) % directions.length];
}

function buildMapStyle(basemap: BasemapKey): StyleSpecification {
  const base = basemap === "sat" ? TILE_SAT : TILE_LIGHT;

  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: base.tiles,
        tileSize: 256,
        attribution: base.attribution,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": basemap === "sat" ? "#0b1220" : "#f3f6f7",
        },
      },
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
      },
    ],
  };
}

export default function MapClient() {
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [bearing, setBearing] = useState(0);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UP" | "DOWN">("ALL");
  const [netFilter, setNetFilter] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>("sat");
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickOpen, setJoystickOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const canManage = role === "ADMIN" || role === "SUPERADMIN";
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const appliedBasemapRef = useRef<BasemapKey>("sat");
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickPointerIdRef = useRef<number | null>(null);

  const syncBearing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setBearing(map.getBearing());
  }, []);

  const fitCity = useCallback((animate = true) => {
    const map = mapRef.current;
    if (!map) return;

    map.fitBounds(CITY_BOUNDS, {
      padding: 24,
      duration: animate ? 600 : 0,
      maxZoom: 13,
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/antennas?placed=1&take=5000", { cache: "no-store" });
      const json = await res.json();
      const arr: Antenna[] = Array.isArray(json) ? json : json?.items ?? [];
      const prepared = arr
        .filter((antenna) => Number.isFinite(Number(antenna.lat)) && Number.isFinite(Number(antenna.lon)))
        .map((antenna) => ({ ...antenna, lat: Number(antenna.lat), lon: Number(antenna.lon) }));

      setAntennas(prepared);
      setLastLoadedAt(new Date().toLocaleTimeString());
    } catch {
      setAntennas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (alive) await load();
    })();

    let disconnect: (() => void) | undefined;

    try {
      disconnect = connectSSE?.((event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (
            ["antenna.updated", "antenna.created", "antenna.deleted", "status.changed"].includes(
              message.event,
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

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: buildMapStyle(appliedBasemapRef.current),
      center: CITY_CENTER,
      zoom: 12,
      minZoom: 10,
      maxZoom: 19,
      minPitch: 0,
      maxPitch: 0,
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: false,
      doubleClickZoom: true,
      maxBounds: CITY_BOUNDS,
      attributionControl: { compact: true },
      renderWorldCopies: false,
    });

    mapRef.current = map;
    map.addControl(
      new NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false }),
      "bottom-right",
    );

    const handleInitialLoad = () => {
      setMapReady(true);
      syncBearing();
      fitCity(false);
    };
    const handleMapError = (event: { error?: Error; sourceId?: string }) => {
      const message = String(event?.error?.message || "");
      if (!message) return;

      const isBasemapIssue =
        event?.sourceId === "basemap" ||
        message.includes("server.arcgisonline.com") ||
        message.includes("tile.openstreetmap.org");

      if (!isBasemapIssue) return;

      if (appliedBasemapRef.current === "sat") {
        appliedBasemapRef.current = "light";
        setBasemap("light");
        setMapError("Camada satelite indisponivel no momento. Mapa alterado para OSM.");
        return;
      }

      setMapError("Falha ao carregar o mapa base. Tente recarregar.");
    };

    const handleResize = () => map.resize();
    const resizeObserver = new ResizeObserver(handleResize);

    map.once("load", handleInitialLoad);
    map.on("rotate", syncBearing);
    map.on("error", handleMapError);

    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleResize);
      map.off("rotate", syncBearing);
      map.off("error", handleMapError);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [fitCity, syncBearing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || appliedBasemapRef.current === basemap) return;

    appliedBasemapRef.current = basemap;
    setMapError(null);
    map.setStyle(buildMapStyle(basemap));
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (event: MapMouseEvent) => {
      if (!openModal) return;
      setLat(event.lngLat.lat.toFixed(5));
      setLon(event.lngLat.lng.toFixed(5));
    };

    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
    };
  }, [openModal]);

  const term = useMemo(() => q.trim().toLowerCase(), [q]);

  const networks = useMemo(
    () => Array.from(new Set(antennas.map((antenna) => antenna.networkName ?? "").filter(Boolean))).sort(),
    [antennas],
  );

  const matchesStatus = useCallback(
    (antenna: Antenna) => statusFilter === "ALL" || antenna.status === statusFilter,
    [statusFilter],
  );

  const matchesSearch = useCallback(
    (antenna: Antenna) =>
      !term || `${antenna.name ?? ""} ${antenna.networkName ?? ""}`.toLowerCase().includes(term),
    [term],
  );

  const filtered = useMemo(() => {
    return antennas.filter((antenna) => {
      if (netFilter && (antenna.networkName ?? "") !== netFilter) return false;
      if (!matchesStatus(antenna)) return false;
      if (!matchesSearch(antenna)) return false;
      return true;
    });
  }, [antennas, matchesSearch, matchesStatus, netFilter]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const up = filtered.filter((antenna) => antenna.status === "UP").length;
    const down = filtered.filter((antenna) => antenna.status === "DOWN").length;
    return { total, up, down };
  }, [filtered]);

  const netCounts = useMemo(() => {
    const counts = new Map<string, number>();

    antennas.forEach((antenna) => {
      const networkName = antenna.networkName ?? "";
      if (!networkName) return;
      if (!matchesStatus(antenna)) return;
      if (!matchesSearch(antenna)) return;
      counts.set(networkName, (counts.get(networkName) ?? 0) + 1);
    });

    return counts;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    filtered.forEach((antenna) => {
      const color = antenna.status === "DOWN" ? "#ef4444" : "#22c55e";
      const marker = new maplibregl.Marker({
        element: makeMarkerElement(color, antenna.name),
        anchor: "bottom",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([antenna.lon, antenna.lat])
        .setPopup(new Popup({ offset: 20, maxWidth: "320px" }).setDOMContent(buildPopupContent(antenna)))
        .addTo(map);

      markersRef.current.push(marker);
    });

    if (openModal && tempPos) {
      const previewMarker = new maplibregl.Marker({
        element: makeMarkerElement("#38bdf8", "Posicao selecionada", 1.05, true),
        anchor: "bottom",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([tempPos[1], tempPos[0]])
        .addTo(map);

      markersRef.current.push(previewMarker);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [filtered, mapReady, openModal, tempPos]);

  const fitPins = useCallback(() => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;

    const bounds = filtered.reduce(
      (acc, antenna) => acc.extend([antenna.lon, antenna.lat]),
      new LngLatBounds([filtered[0].lon, filtered[0].lat], [filtered[0].lon, filtered[0].lat]),
    );

    map.fitBounds(bounds, {
      padding: 28,
      duration: 600,
      maxZoom: filtered.length === 1 ? 17 : 18,
    });
  }, [filtered]);

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (saving) return;

      const latNum = Number(lat.toString().replace(",", "."));
      const lonNum = Number(lon.toString().replace(",", "."));

      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        setErr("Latitude/Longitude invalidas.");
        return;
      }

      if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        setErr("Fora do intervalo geografico.");
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
      } catch (error: any) {
        setErr(error?.message || "Erro ao salvar.");
      } finally {
        setSaving(false);
      }
    },
    [desc, lat, lon, name, saving],
  );

  const handleBearingChange = useCallback((value: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setBearing(value);
  }, []);

  const resetBearing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      bearing: 0,
      duration: 300,
    });
  }, []);

  const setBearingPreset = useCallback((value: number) => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      bearing: value,
      duration: 220,
    });
  }, []);

  const updateBearingFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const joystick = joystickRef.current;
      if (!joystick) return;

      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance < 10) return;

      const angle = normalizeBearing((Math.atan2(dx, -dy) * 180) / Math.PI);
      handleBearingChange(angle > 180 ? angle - 360 : angle);
    },
    [handleBearingChange],
  );

  const clearJoystickInteraction = useCallback(() => {
    joystickPointerIdRef.current = null;
    setJoystickActive(false);
  }, []);

  const handleJoystickPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      joystickPointerIdRef.current = event.pointerId;
      setJoystickActive(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      updateBearingFromPointer(event.clientX, event.clientY);
    },
    [updateBearingFromPointer],
  );

  const handleJoystickPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (joystickPointerIdRef.current !== event.pointerId) return;
      updateBearingFromPointer(event.clientX, event.clientY);
    },
    [updateBearingFromPointer],
  );

  const finishJoystickInteraction = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (joystickPointerIdRef.current !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      clearJoystickInteraction();
    },
    [clearJoystickInteraction],
  );

  const heading = useMemo(() => normalizeBearing(bearing), [bearing]);
  const headingLabel = useMemo(() => getBearingLabel(bearing), [bearing]);
  const joystickVector = useMemo(() => {
    const radians = (heading * Math.PI) / 180;
    return {
      x: Math.sin(radians) * JOYSTICK_RADIUS,
      y: -Math.cos(radians) * JOYSTICK_RADIUS,
    };
  }, [heading]);

  return (
    <div id="map-root" className="relative h-[calc(100vh-8rem)] w-full overflow-hidden rounded-xl shadow-inner">
      <div ref={mapContainerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-[1005] flex flex-col gap-2">
        <button
          onClick={() => setJoystickOpen((value) => !value)}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/82 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm hover:bg-slate-900/90"
          title={joystickOpen ? "Fechar controle de rotacao" : "Abrir controle de rotacao"}
          aria-label={joystickOpen ? "Fechar controle de rotacao" : "Abrir controle de rotacao"}
        >
          <FontAwesomeIcon
            icon={faCompass}
            className="h-4 w-4 text-sky-300 transition-transform"
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
        </button>

        {joystickOpen && (
          <div
            className="pointer-events-auto relative w-[142px] rounded-[22px] bg-slate-950/92 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
            role="dialog"
            aria-label="Controle de rotacao do mapa"
          >
            <button
              onClick={() => setJoystickOpen(false)}
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              title="Fechar controle"
              aria-label="Fechar controle"
            >
              <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
            </button>

            <div className="pr-6 text-[10px] uppercase tracking-[0.18em] text-white/45">Rotacao</div>
            <div className="pr-6 text-xs font-semibold text-white/85">
              {Math.round(heading)}&deg; {headingLabel}
            </div>

            <div className="mt-3 flex justify-center">
              <div
                ref={joystickRef}
                onPointerDown={handleJoystickPointerDown}
                onPointerMove={handleJoystickPointerMove}
                onPointerUp={finishJoystickInteraction}
                onPointerCancel={finishJoystickInteraction}
                onLostPointerCapture={clearJoystickInteraction}
                className={`relative h-[104px] w-[104px] touch-none select-none rounded-full border border-white/10
                  bg-[radial-gradient(circle_at_30%_30%,rgba(148,163,184,0.22),rgba(71,85,105,0.35)_45%,rgba(2,6,23,0.96)_100%)]
                  shadow-[inset_0_10px_22px_rgba(255,255,255,0.10),inset_0_-14px_24px_rgba(0,0,0,0.58),0_16px_24px_rgba(2,6,23,0.42)]
                  ${joystickActive ? "ring-2 ring-sky-400/65" : ""}`}
                title="Arraste para girar o mapa"
                aria-label="Joystick de rotacao do mapa"
              >
                <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[11px] font-semibold tracking-[0.16em] text-white/90">N</div>
                <div className="absolute inset-[10px] rounded-full border border-white/12" />
                <div className="absolute inset-[19px] rounded-full border border-white/10 bg-black/20" />

                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resetBearing}
                  className="absolute left-1/2 top-[14px] inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-black/25 text-sky-300 hover:bg-white/10"
                  title="Alinhar para norte"
                  aria-label="Alinhar para norte"
                >
                  <FontAwesomeIcon icon={faChevronUp} className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setBearingPreset(90)}
                  className="absolute right-[14px] top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-sky-300 hover:bg-white/10"
                  title="Virar para leste"
                  aria-label="Virar para leste"
                >
                  <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setBearingPreset(180)}
                  className="absolute bottom-[14px] left-1/2 inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-black/25 text-sky-300 hover:bg-white/10"
                  title="Virar para sul"
                  aria-label="Virar para sul"
                >
                  <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setBearingPreset(-90)}
                  className="absolute left-[14px] top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-sky-300 hover:bg-white/10"
                  title="Virar para oeste"
                  aria-label="Virar para oeste"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" />
                </button>

                <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55" />
                <div
                  className="absolute left-1/2 top-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-full rounded-full bg-sky-300/30"
                  style={{ transform: `translate(-50%, -100%) rotate(${heading}deg)` }}
                />
                <div
                  className="absolute left-1/2 top-1/2 h-8 w-8 rounded-full border border-white/12
                    bg-[radial-gradient(circle_at_30%_30%,#475569,#111827_60%,#020617)] shadow-[0_10px_18px_rgba(0,0,0,0.48)] transition-transform"
                  style={{
                    transform: `translate(calc(-50% + ${joystickVector.x}px), calc(-50% + ${joystickVector.y}px)) scale(${joystickActive ? 1.04 : 1})`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute right-4 top-4 z-[1005] flex gap-2 pointer-events-none">
        <button
          onClick={() => setPanelOpen((value) => !value)}
          className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl bg-white/85 px-3 text-black shadow-lg hover:bg-white"
          title={panelOpen ? "Fechar painel" : "Abrir painel"}
        >
          <FontAwesomeIcon icon={faXmark} className={`h-4 w-4 ${panelOpen ? "" : "hidden"}`} />
          <FontAwesomeIcon icon={faBars} className={`h-4 w-4 ${panelOpen ? "hidden" : ""}`} />
          <span className="text-sm">{panelOpen ? "Fechar" : "Painel"}</span>
        </button>

        <button
          onClick={() => fitCity()}
          className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl bg-white/85 px-3 text-black shadow-lg hover:bg-white"
          title="Enquadrar cidade"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-4 w-4" />
          <span className="text-sm">Cidade</span>
        </button>

        <button
          onClick={fitPins}
          disabled={filtered.length === 0}
          className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl bg-white/85 px-3 text-black shadow-lg hover:bg-white disabled:opacity-50"
          title="Enquadrar pinos filtrados"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-4 w-4" />
          <span className="text-sm">Pinos</span>
        </button>

        <select
          value={basemap}
          onChange={(event) => setBasemap(event.target.value as BasemapKey)}
          className="pointer-events-auto h-10 rounded-xl bg-white/85 px-2 text-sm text-black shadow-lg hover:bg-white"
          title="Mapa base"
          aria-label="Selecionar mapa base"
        >
          <option value="sat">Satelite</option>
          <option value="light">Claro (OSM)</option>
        </select>
      </div>

      <div
        className={`absolute right-4 top-16 z-[1004] max-h-[70vh] w-[320px] overflow-hidden rounded-2xl
          bg-white/20 shadow-xl ring-1 ring-white/30 backdrop-blur-md transition-all dark:bg-black/30
          ${panelOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0"}`}
      >
        <div className="space-y-3 overflow-y-auto p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="w-full rounded-lg bg-white/85 py-2 pl-8 pr-3 text-black placeholder-black/60 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Buscar por nome/rede..."
                value={q}
                onChange={(event) => setQ(event.target.value)}
                aria-label="Buscar por nome ou rede"
              />
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-black/70"
              />
            </div>

            <button
              onClick={load}
              className="h-10 rounded-lg bg-white/85 px-3 text-black hover:bg-white"
              title="Recarregar"
              aria-label="Recarregar"
            >
              <FontAwesomeIcon icon={faArrowsRotate} className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-lg px-2 py-2 text-sm ${
                statusFilter === "ALL" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setStatusFilter("UP")}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm ${
                statusFilter === "UP" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
              }`}
            >
              <FontAwesomeIcon icon={faCircleCheck} /> UP
            </button>

            <button
              onClick={() => setStatusFilter("DOWN")}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm ${
                statusFilter === "DOWN" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
              }`}
            >
              <FontAwesomeIcon icon={faCircleXmark} /> DOWN
            </button>
          </div>

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

          <div className="space-y-1">
            <div className="text-xs opacity-80">Redes ({networks.length})</div>

            <div className="max-h-[26vh] overflow-auto pr-1">
              <button
                onClick={() => setNetFilter("")}
                className={`mb-1 w-full rounded-lg px-2 py-1 text-left text-sm ${
                  netFilter === "" ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
                }`}
              >
                Todas as redes
              </button>

              {networks.map((network) => {
                const count = netCounts.get(network) ?? 0;

                return (
                  <button
                    key={network}
                    onClick={() => setNetFilter((prev) => (prev === network ? "" : network))}
                    className={`mb-1 w-full rounded-lg px-2 py-1 text-left text-sm ${
                      netFilter === network ? "bg-emerald-600 text-white" : "bg-white/85 text-black hover:bg-white"
                    }`}
                    title={network}
                  >
                    <span className="line-clamp-1">{network}</span>
                    <span className="float-right opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={clearFilters}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/85 px-3 py-2 text-sm text-black hover:bg-white"
            >
              <FontAwesomeIcon icon={faBroom} /> Limpar filtros
            </button>
          </div>

          <div className="text-center text-xs opacity-80">{lastLoadedAt ? `Atualizado: ${lastLoadedAt}` : "-"}</div>

          {mapError && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/12 px-3 py-2 text-xs text-amber-100">
              {mapError}
            </div>
          )}
        </div>
      </div>

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

      {canManage && openModal && (
        <div
          className="absolute inset-0 z-[1006] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white/90 text-black shadow-2xl ring-1 ring-black/10 dark:bg-neutral-900 dark:text-white dark:ring-white/10">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <h3 className="text-lg font-semibold">Nova Antena</h3>
              <button
                onClick={() => setOpenModal(false)}
                className="rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Fechar"
              >
                x
              </button>
            </div>

            <form className="space-y-3 p-5" onSubmit={handleCreate}>
              <input
                className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 dark:border-white/10 dark:bg-white/5"
                placeholder="Nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 dark:border-white/10 dark:bg-white/5"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(event) => setLat(event.target.value)}
                  required
                />

                <input
                  className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 dark:border-white/10 dark:bg-white/5"
                  placeholder="Longitude"
                  value={lon}
                  onChange={(event) => setLon(event.target.value)}
                  required
                />
              </div>

              <textarea
                className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 dark:border-white/10 dark:bg-white/5"
                placeholder="Descricao (opcional)"
                rows={3}
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
              />

              {err && (
                <div className="rounded border border-red-600/30 bg-red-600/10 p-2 text-xs text-red-600">{err}</div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs opacity-80">Dica: clique no mapa com o modal aberto para preencher Lat/Lon.</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal(false)}
                    className="h-10 rounded-lg bg-black/5 px-4 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-lg bg-emerald-600 px-4 text-white hover:bg-emerald-500 disabled:opacity-60"
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
