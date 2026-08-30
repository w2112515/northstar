"use client";

/** TimesFM 5-day forecast fan: q10-q90 band, dashed median, point line.
 *  Decision support for the AI analyst - never an order trigger - and every
 *  forecast is graded against what actually happened (see the scorecard). */

import { useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtTs } from "@/lib/api";
import { AXIS_TICK, CHART, RECHARTS_TOOLTIP } from "@/lib/theme";
import { Button } from "@/components/ui";
import type { ForecastDoc } from "@/lib/types";

export function ForecastFan({
  doc,
  available,
  onRefresh,
  busy,
}: {
  doc: ForecastDoc | null;
  available: boolean;
  onRefresh: () => void;
  busy: boolean;
}) {
  const symbols = doc ? Object.keys(doc.symbols) : [];
  const [sel, setSel] = useState<string>("");
  const active = sel && symbols.includes(sel) ? sel : symbols[0] ?? "";
  if (!available && !doc) return null;

  const f = doc && active ? doc.symbols[active] : null;
  const rows = f
    ? [
        { day: "now", band: [f.last_close, f.last_close] as [number, number], q50: f.last_close, point: f.last_close },
        ...f.point.map((p, i) => ({
          day: `+${i + 1}d`,
          band: [f.q10[i], f.q90[i]] as [number, number],
          q50: f.q50[i],
          point: p,
        })),
      ]
    : [];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {symbols.map((s) => (
            <button
              key={s}
              onClick={() => setSel(s)}
              aria-pressed={s === active}
              className={`rounded-sm px-2 py-0.5 font-mono text-micro transition-colors ${
                s === active ? "bg-panel text-ink" : "text-mist hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={busy}>
          {busy ? "Forecasting…" : doc ? "Refresh" : "Run first forecast"}
        </Button>
      </div>
      {!doc ? (
        <p className="text-sm text-mist">
          No forecasts yet. The night job draws them daily; the first manual run downloads the
          model checkpoint (~800MB) once.
        </p>
      ) : (
        f && (
          <>
            <div className="h-44 rounded-lg bg-void/50 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                  <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                  />
                  <Tooltip
                    contentStyle={RECHARTS_TOOLTIP}
                    formatter={(value: unknown, name: unknown) =>
                      Array.isArray(value)
                        ? [`$${Number(value[0]).toFixed(2)} – $${Number(value[1]).toFixed(2)}`, "q10–q90 band"]
                        : typeof value === "number"
                          ? [`$${value.toFixed(2)}`, name === "point" ? "point forecast" : "median (q50)"]
                          : ["—", String(name)]
                    }
                  />
                  <Area dataKey="band" stroke="none" fill={CHART.signal} fillOpacity={0.14} isAnimationActive={false} />
                  <Line dataKey="q50" stroke={CHART.mist} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  <Line dataKey="point" stroke={CHART.gold} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 font-mono text-micro text-mist">
              {active}: expected{" "}
              <span className={f.exp_5d_pct >= 0 ? "text-teal" : "text-coral"}>
                {f.exp_5d_pct >= 0 ? "+" : ""}
                {f.exp_5d_pct}%
              </span>{" "}
              in 5 days, plausible range {f.q10_5d_pct >= 0 ? "+" : ""}
              {f.q10_5d_pct}% to {f.q90_5d_pct >= 0 ? "+" : ""}
              {f.q90_5d_pct}% · {doc.model} · {fmtTs(doc.ts)} · model estimate, not a promise
            </p>
          </>
        )
      )}
    </div>
  );
}
