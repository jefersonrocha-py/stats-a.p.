// components/DonutChart.tsx
"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Label,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

type Variant = "donut" | "gauge" | "radial";

type Props = {
  up: number;
  down: number;
  unknown?: number;
  variant?: Variant;
  showLegend?: boolean;
  className?: string;
  height?: number;
};

const COLORS = {
  UP: "#22c55e",
  DOWN: "#ef4444",
  UNKNOWN: "#9ca3af",
} as const;

const fmtInt = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(Number(n) || 0)));
const fmtPct = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    Math.max(0, Math.min(100, Number(n) || 0))
  ) + "%";

export default function DonutChart({
  up,
  down,
  unknown = 0,
  variant = "donut",
  showLegend = true,
  className,
  height = 280,
}: Props) {
  const uid = useId().replace(/[:]/g, "");
  const ids = {
    upGrad: `upGrad-${uid}`,
    downGrad: `downGrad-${uid}`,
    unkGrad: `unkGrad-${uid}`,
    track: `track-${uid}`,
    shadow: `shadow-${uid}`,
    glowUp: `glowUp-${uid}`,
    glowDown: `glowDown-${uid}`,
    glowUnk: `glowUnk-${uid}`,
  };

  const { data, total, upPct, downPct, unkPct } = useMemo(() => {
    const sUp = Math.max(0, Number(up) || 0);
    const sDown = Math.max(0, Number(down) || 0);
    const sUnknown = Math.max(0, Number(unknown) || 0);
    const t = sUp + sDown + sUnknown;
    const pct = (v: number) => (t > 0 ? (v / t) * 100 : 0);

    const d = [
      { name: "UP", value: sUp, color: COLORS.UP },
      { name: "DOWN", value: sDown, color: COLORS.DOWN },
    ];
    if (sUnknown > 0) d.push({ name: "UNKNOWN", value: sUnknown, color: COLORS.UNKNOWN });

    return {
      data: d,
      total: t,
      upPct: pct(sUp),
      downPct: pct(sDown),
      unkPct: pct(sUnknown),
    };
  }, [up, down, unknown]);

  // --- pulso do label central quando upPct muda ---
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(t);
  }, [upPct]);

  // --- hover states (glow) ---
  const [activeIndex, setActiveIndex] = useState<number | null>(null); // donut
  const [hoverBand, setHoverBand] = useState<"UP" | "DOWN" | "UNKNOWN" | null>(null); // radial/gauge

  const legendPayload =
    showLegend &&
    data.map((d) => ({
      id: d.name,
      type: "circle" as const,
      value:
        d.name === "UP"
          ? `Antenas UP (${fmtInt(d.value)})`
          : d.name === "DOWN"
          ? `Antenas DOWN (${fmtInt(d.value)})`
          : `Desconhecido (${fmtInt(d.value)})`,
      color: d.color,
    }));

  const TooltipBox = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0];
    const name: "UP" | "DOWN" | "UNKNOWN" = p?.name;
    const value: number = p?.value ?? p?.pct ?? 0;
    const pct =
      name === "UP" ? upPct : name === "DOWN" ? downPct : name === "UNKNOWN" ? unkPct : 0;
    const label =
      name === "UP" ? "Antenas UP" : name === "DOWN" ? "Antenas DOWN" : "Desconhecido";

    return (
      <div
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          background: "rgba(255,255,255,0.9)",
          color: "#111",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.1)",
          padding: "8px 10px",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
        <div style={{ fontWeight: 600 }}>
          {fmtInt(value)} <span style={{ opacity: 0.7 }}>({fmtPct(pct)})</span>
        </div>
      </div>
    );
  };

  if (total === 0) {
    return (
      <div
        className={`w-full grid place-items-center rounded-2xl bg-black/5 dark:bg-white/5 ${className || ""}`}
        style={{ height }}
        role="img"
        aria-label="Gráfico de disponibilidade: sem dados"
      >
        <div className="text-sm opacity-70">Sem dados</div>
      </div>
    );
  }

  // -------- DONUT MODERNO --------
  function RenderDonut() {
    const innerR = Math.min(70, Math.floor(height * 0.25));
    const outerR = Math.min(110, Math.floor(height * 0.4));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <filter id={ids.shadow} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.25" />
            </filter>
            <filter id={ids.glowUp} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.UP} floodOpacity="0.6" />
            </filter>
            <filter id={ids.glowDown} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.DOWN} floodOpacity="0.6" />
            </filter>
            <filter id={ids.glowUnk} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.UNKNOWN} floodOpacity="0.6" />
            </filter>
            <radialGradient id={ids.upGrad} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="70%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </radialGradient>
            <radialGradient id={ids.downGrad} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="70%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </radialGradient>
            <radialGradient id={ids.unkGrad} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#9ca3af" />
            </radialGradient>
          </defs>

          <Pie
            dataKey="value"
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerR}
            outerRadius={outerR}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            isAnimationActive
            cornerRadius={6}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, i) => {
              const gradId =
                entry.name === "UP" ? ids.upGrad : entry.name === "DOWN" ? ids.downGrad : ids.unkGrad;
              const glowId =
                entry.name === "UP" ? ids.glowUp : entry.name === "DOWN" ? ids.glowDown : ids.glowUnk;
              const isActive = activeIndex === i;
              return (
                <Cell
                  key={`cell-${i}`}
                  fill={`url(#${gradId})`}
                  filter={isActive ? `url(#${glowId})` : `url(#${ids.shadow})`}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{ transition: "filter 120ms ease, opacity 120ms ease", opacity: isActive ? 1 : 0.95 } as any}
                />
              );
            })}
            <Label
              position="center"
              content={({ viewBox }) => {
                const vb: any = viewBox || {};
                const cx = vb.cx;
                const cy = vb.cy;
                return (
                  <g>
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={22}
                      fontWeight={700}
                      fill={COLORS.UP}
                      className={pulse ? "dc-pulse" : ""}
                    >
                      {fmtPct(upPct)}
                    </text>
                    <text
                      x={cx}
                      y={(cy as number) + 18}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fontSize={12}
                      fill="currentColor"
                      opacity={0.7}
                    >
                      UP
                    </text>
                  </g>
                );
              }}
            />
          </Pie>

          <Tooltip content={TooltipBox as any} />
          {showLegend && (
            <Legend verticalAlign="bottom" align="center" payload={legendPayload as any} wrapperStyle={{ paddingTop: 8 }} />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // -------- SEMI-GAUGE --------
  function RenderGauge() {
    const innerR = Math.min(70, Math.floor(height * 0.34));
    const outerR = Math.min(110, Math.floor(height * 0.5));
    const track = [{ name: "track", value: 100 }];
    const gauge = [
      { name: "UP", value: upPct },
      { name: "rest", value: Math.max(0, 100 - upPct) },
    ];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={ids.track} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e5e7eb" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id={ids.upGrad} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
            <filter id={ids.glowUp} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.UP} floodOpacity="0.6" />
            </filter>
          </defs>

          <Pie
            dataKey="value"
            data={track}
            cx="50%"
            cy="80%"
            startAngle={180}
            endAngle={0}
            innerRadius={innerR}
            outerRadius={outerR}
            isAnimationActive={false}
            stroke="none"
          >
            <Cell fill={`url(#${ids.track})`} />
          </Pie>

          <Pie
            dataKey="value"
            data={gauge}
            cx="50%"
            cy="80%"
            startAngle={180}
            endAngle={0}
            innerRadius={innerR}
            outerRadius={outerR}
            isAnimationActive
            stroke="none"
            cornerRadius={outerR - innerR}
            paddingAngle={0}
            onMouseEnter={() => setHoverBand("UP")}
            onMouseLeave={() => setHoverBand(null)}
          >
            <Cell
              fill={`url(#${ids.upGrad})`}
              style={{ transition: "filter 120ms ease", filter: hoverBand === "UP" ? `url(#${ids.glowUp})` : "none" } as any}
            />
            <Cell fill="transparent" />
            <Label
              position="center"
              content={({ viewBox }) => {
                const vb: any = viewBox || {};
                const cx = vb.cx;
                const cy = vb.cy;
                return (
                  <g>
                    <text
                      x={cx}
                      y={cy - 6}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={22}
                      fontWeight={700}
                      fill={COLORS.UP}
                      className={pulse ? "dc-pulse" : ""}
                    >
                      {fmtPct(upPct)}
                    </text>
                    <text
                      x={cx}
                      y={cy + 14}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fontSize={12}
                      fill="currentColor"
                      opacity={0.7}
                    >
                      Disponibilidade
                    </text>
                  </g>
                );
              }}
            />
          </Pie>

          <Tooltip
            formatter={(v: number, n: string) =>
              n === "UP" ? [fmtPct(upPct), "UP"] : [fmtPct(100 - upPct), "RESTO"]
            }
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              align="center"
              payload={[{ id: "UP", type: "circle", value: `UP (${fmtPct(upPct)})`, color: COLORS.UP }] as any}
              wrapperStyle={{ paddingTop: 8 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // -------- RADIAL MODERNO --------
  function RenderRadial() {
    const upBand = Math.min(90, Math.floor(height * 0.36));
    const downBand = Math.max(0, upBand - 20);
    const unkBand = Math.max(0, downBand - 20);

    const radialDataBase = [
      { name: "UP", pct: upPct, fill: `url(#${ids.upGrad})` },
      { name: "DOWN", pct: downPct, fill: `url(#${ids.downGrad})` },
    ];
    const radialData =
      unknown > 0
        ? [...radialDataBase, { name: "UNKNOWN", pct: unkPct, fill: `url(#${ids.unkGrad})` }]
        : radialDataBase;

    return (
      <div className={`relative w-full ${className || ""}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="30%" outerRadius="100%" startAngle={90} endAngle={-270} data={radialData}>
            <defs>
              <linearGradient id={ids.upGrad} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
              <linearGradient id={ids.downGrad} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id={ids.unkGrad} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d1d5db" />
                <stop offset="100%" stopColor="#9ca3af" />
              </linearGradient>
              <filter id={ids.glowUp} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.UP} floodOpacity="0.6" />
              </filter>
              <filter id={ids.glowDown} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.DOWN} floodOpacity="0.6" />
              </filter>
              <filter id={ids.glowUnk} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.UNKNOWN} floodOpacity="0.6" />
              </filter>
            </defs>

            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />

            <RadialBar
              dataKey="pct"
              background
              cornerRadius={16}
              clockWise
              barSize={14}
              data={radialData.filter((d) => d.name === "UP")}
              fill={radialData.find((d) => d.name === "UP")?.fill}
              innerRadius={downBand}
              outerRadius={upBand}
              onMouseEnter={() => setHoverBand("UP")}
              onMouseLeave={() => setHoverBand(null)}
              style={{ filter: hoverBand === "UP" ? `url(#${ids.glowUp})` : "none", transition: "filter 120ms ease" } as any}
            />
            <RadialBar
              dataKey="pct"
              background
              cornerRadius={16}
              clockWise
              barSize={14}
              data={radialData.filter((d) => d.name === "DOWN")}
              fill={radialData.find((d) => d.name === "DOWN")?.fill}
              innerRadius={unkBand}
              outerRadius={downBand - 4}
              onMouseEnter={() => setHoverBand("DOWN")}
              onMouseLeave={() => setHoverBand(null)}
              style={{ filter: hoverBand === "DOWN" ? `url(#${ids.glowDown})` : "none", transition: "filter 120ms ease" } as any}
            />
            {unknown > 0 && (
              <RadialBar
                dataKey="pct"
                background
                cornerRadius={16}
                clockWise
                barSize={14}
                data={radialData.filter((d) => d.name === "UNKNOWN")}
                fill={radialData.find((d) => d.name === "UNKNOWN")?.fill}
                innerRadius={unkBand - 18}
                outerRadius={unkBand - 4}
                onMouseEnter={() => setHoverBand("UNKNOWN")}
                onMouseLeave={() => setHoverBand(null)}
                style={{ filter: hoverBand === "UNKNOWN" ? `url(#${ids.glowUnk})` : "none", transition: "filter 120ms ease" } as any}
              />
            )}

            <Tooltip content={TooltipBox as any} />
            {showLegend && (
              <Legend verticalAlign="bottom" align="center" payload={legendPayload as any} wrapperStyle={{ paddingTop: 8 }} />
            )}
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={`text-center leading-tight ${pulse ? "dc-pulse" : ""}`}>
            <div className="text-[22px] font-bold text-emerald-500">{fmtPct(upPct)}</div>
            <div className="text-xs opacity-70">UP</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className || ""}`} style={{ height }} role="img" aria-label={`Disponibilidade UP: ${fmtPct(upPct)}`}>
      {variant === "donut" && <RenderDonut />}
      {variant === "gauge" && <RenderGauge />}
      {variant === "radial" && <RenderRadial />}

      {/* keyframes locais para o pulso */}
      <style jsx>{`
        .dc-pulse {
          animation: dcPulse 0.8s ease-out;
        }
        @keyframes dcPulse {
          0% { transform: scale(0.94); opacity: 0.75; }
          40% { transform: scale(1.06); opacity: 1; text-shadow: 0 0 0 rgba(34,197,94,0); }
          60% { transform: scale(1.02); text-shadow: 0 0 12px rgba(34,197,94,0.35); }
          100% { transform: scale(1.0); text-shadow: 0 0 0 rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  );
}
