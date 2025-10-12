// components/DonutChart.tsx
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Label,
} from "recharts";
import { useMemo } from "react";

type Props = {
  up: number;
  down: number;
  /** Opcional: itens com status desconhecido; se >0 aparece no gráfico */
  unknown?: number;
  /** Mostrar legenda? (default: true) */
  showLegend?: boolean;
  /** Classe externa opcional */
  className?: string;
  /** Altura do gráfico em px (default: 280) */
  height?: number;
};

const COLORS = {
  UP: "#22c55e", // verde
  DOWN: "#ef4444", // vermelho
  UNKNOWN: "#9ca3af", // cinza
} as const;

export default function DonutChart({
  up,
  down,
  unknown = 0,
  showLegend = true,
  className,
  height = 280,
}: Props) {
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

  const fmtInt = (n: number) =>
    new Intl.NumberFormat("pt-BR").format(Math.round(n));
  const fmtPct = (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
      Math.max(0, Math.min(100, n)),
    ) + "%";

  // Tooltip customizado
  const tooltipContent = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: any[];
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0];
    const name: "UP" | "DOWN" | "UNKNOWN" = p?.name;
    const value: number = p?.value ?? 0;

    const pct =
      name === "UP" ? upPct : name === "DOWN" ? downPct : name === "UNKNOWN" ? unkPct : 0;

    const label =
      name === "UP"
        ? "Antenas UP"
        : name === "DOWN"
        ? "Antenas DOWN"
        : "Desconhecido";

    return (
      <div
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          background: "rgba(255,255,255,0.85)",
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

  // Payload da legenda com rótulos amigáveis
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

  // Fallback: sem dados
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

  return (
    <div
      className={`w-full ${className || ""}`}
      style={{ height }}
      role="img"
      aria-label={`Disponibilidade UP: ${fmtPct(upPct)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            dataKey="value"
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={Math.min(70, Math.floor(height * 0.25))}
            outerRadius={Math.min(100, Math.floor(height * 0.36))}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            isAnimationActive
          >
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.color} />
            ))}

            {/* Rótulo central: UP% */}
            <Label
              position="center"
              content={({ viewBox }) => {
                if (!viewBox || typeof upPct !== "number") return null;
                const { cx, cy } = viewBox as any;
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

          <Tooltip content={tooltipContent as any} />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              align="center"
              payload={legendPayload as any}
              wrapperStyle={{ paddingTop: 8 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
