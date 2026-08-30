"use client";

/** The signature visual: the actual equity curve - the voyage line, gold -
 *  drawn over the plan's Monte Carlo cone (p10-p90 fan, p50 dashed), with
 *  the target as a dashed gold line carrying the star. Plan vs reality on
 *  one axis - the honest answer to "am I on track, and how do I know". */

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtUsd } from "@/lib/api";
import { AXIS_TICK, CHART, RECHARTS_TOOLTIP } from "@/lib/theme";

const DAYS_PER_MONTH = 30.44;

type Bands = { p10: number[]; p50: number[]; p90: number[] };

export function TrajectoryHero({
  bands,
  months,
  target,
  base,
  start,
  equity,
  className = "",
}: {
  bands: Bands | null;
  /** plan horizon in months (x-axis extent) */
  months: number;
  /** goal target; null for monthly-income mode */
  target: number | null;
  /** capital base; anchors the cone at day 0 */
  base?: number;
  /** plan start ISO timestamp; actual equity is aligned against it */
  start?: string;
  /** actual equity curve */
  equity: { t: string; equity: number }[];
  className?: string;
}) {
  // Guard against a degraded bands doc (thin data -> null subfields upstream).
  const usableBands =
    bands && Array.isArray(bands.p50) && bands.p50.length > 0 && bands.p10.length === bands.p50.length
      ? bands
      : null;

  // Without a plan start, align the actual curve to its own first point so
  // the hero still draws instead of silently emptying.
  const startMs = start
    ? Date.parse(start)
    : equity.length > 0
      ? Date.parse(equity[0].t)
      : NaN;
  const maxD = Math.max(1, months * DAYS_PER_MONTH);

  // Band row i is the percentile AFTER i+1 months of returns (see
  // monte_carlo_goal), so the cone starts at month 1 and grows from base.
  const coneRows = usableBands
    ? [
        ...(base != null ? [{ d: 0, band: [base, base] as [number, number], p50: base }] : []),
        ...usableBands.p50.map((_, i) => ({
          d: (i + 1) * DAYS_PER_MONTH,
          band: [usableBands.p10[i], usableBands.p90[i]] as [number, number],
          p50: usableBands.p50[i],
        })),
      ]
    : [];

  const actualRows = equity
    .map((p) => ({
      d: Number.isFinite(startMs) ? (Date.parse(p.t) - startMs) / 86_400_000 : NaN,
      equity: p.equity,
    }))
    .filter((r) => Number.isFinite(r.d) && r.d >= -1 && r.d <= maxD);

  // "Today" = where the actual data ends (pure: no wall-clock reads in render).
  const todayD = actualRows.length > 0 ? actualRows[actualRows.length - 1].d : null;

  const lastEquity = equity.length > 0 ? equity[equity.length - 1].equity : null;
  const ariaLabel =
    lastEquity != null && target != null
      ? `Plan versus reality chart. Actual equity ${fmtUsd(lastEquity)}, target ${fmtUsd(target)}${
          usableBands ? `, median simulated path ends at ${fmtUsd(usableBands.p50[usableBands.p50.length - 1])}` : ""
        }.`
      : "Plan versus reality chart.";

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            type="number"
            dataKey="d"
            domain={[0, maxD]}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART.hairline }}
            tickFormatter={(d: number) => `+${Math.round(d / DAYS_PER_MONTH)}mo`}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
          />
          <Tooltip
            contentStyle={RECHARTS_TOOLTIP}
            labelFormatter={(d) => `Month +${(Number(d) / DAYS_PER_MONTH).toFixed(1)}`}
            formatter={(value: unknown, name: unknown) => {
              if (Array.isArray(value))
                return [`${fmtUsd(Number(value[0]))} – ${fmtUsd(Number(value[1]))}`, "p10–p90 cone"];
              if (typeof value === "number")
                return [
                  fmtUsd(value),
                  name === "equity" ? "actual equity" : name === "p50" ? "median path" : String(name),
                ];
              return ["—", String(name)];
            }}
          />
          {usableBands && (
            <Area
              data={coneRows}
              dataKey="band"
              stroke="none"
              fill={CHART.cone}
              isAnimationActive={false}
            />
          )}
          {usableBands && (
            <Line
              data={coneRows}
              dataKey="p50"
              stroke={CHART.median}
              strokeDasharray="4 3"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            data={actualRows}
            dataKey="equity"
            stroke={CHART.star}
            strokeWidth={2.25}
            dot={false}
            isAnimationActive={false}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke={CHART.star}
              strokeDasharray="6 4"
              strokeWidth={1}
              label={{
                value: `✦ ${fmtUsd(target, 0)}`,
                position: "insideTopRight",
                fill: CHART.star,
                fontSize: 11,
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          )}
          {todayD != null && todayD > 0 && todayD < maxD && (
            <ReferenceLine x={Math.floor(todayD)} stroke={CHART.hairline} strokeDasharray="2 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-micro text-ink2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-star" /> actual equity
        </span>
        {usableBands && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 bg-ink/10" /> p10–p90 simulated cone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t border-dashed border-ink2" /> median path
            </span>
          </>
        )}
        <span className="ml-auto">historical estimate, not a promise</span>
      </div>
    </div>
  );
}

/** Terminal-outcome quantile strip: where the simulation says you land.
 *  Three ticks (rough / median / lucky) and the target star on one ruler. */
export function ProbStrip({
  bands,
  base,
  target,
  probability,
}: {
  bands: Bands | null;
  base: number;
  target: number | null;
  probability: number;
}) {
  if (
    !bands ||
    !Array.isArray(bands.p10) ||
    bands.p10.length === 0 ||
    bands.p50.length !== bands.p10.length ||
    bands.p90.length !== bands.p10.length
  )
    return null;
  const p10 = bands.p10[bands.p10.length - 1];
  const p50 = bands.p50[bands.p50.length - 1];
  const p90 = bands.p90[bands.p90.length - 1];
  const lo = Math.min(p10, base, target ?? Infinity);
  const hi = Math.max(p90, target ?? -Infinity);
  const pad = (hi - lo) * 0.06 || 1;
  const x = (v: number) => `${(((v - lo + pad) / (hi - lo + 2 * pad)) * 100).toFixed(2)}%`;

  // Alternate label rows so a tight cone never stacks three money labels.
  const ticks = [
    { v: p10, label: "rough", strong: false, below: false },
    { v: p50, label: "median", strong: true, below: true },
    { v: p90, label: "lucky", strong: false, below: false },
  ];

  // The strip owns its label room: the ruler sits at 40px with the "above"
  // row (two micro lines ≈ 31px) inside the top margin and the "below" row
  // inside the bottom one. Nothing may hang outside the h-24 box - that is
  // how labels used to collide with whatever the caller rendered above.
  return (
    <div className="pt-1">
      <div className="relative h-24">
        <div className="absolute inset-x-0 top-10 h-px bg-hairline" />
        {ticks.map((t) => (
          <div key={t.label} className="absolute top-0" style={{ left: x(t.v) }}>
            {!t.below && (
              <div className="absolute left-0 top-0 -translate-x-1/2 text-center">
                <div className="whitespace-nowrap font-mono text-micro tabular-nums text-ink">
                  {fmtUsd(t.v, 0)}
                </div>
                <div className="font-mono text-micro text-ink2">{t.label}</div>
              </div>
            )}
            <div
              className={`absolute left-0 top-10 w-px -translate-x-1/2 ${
                t.strong ? "h-3.5 -translate-y-1 bg-ink" : "h-2.5 bg-ink2/60"
              }`}
            />
            {t.below && (
              <div className="absolute left-0 top-14 -translate-x-1/2 text-center">
                <div className="whitespace-nowrap font-mono text-micro tabular-nums text-ink">
                  {fmtUsd(t.v, 0)}
                </div>
                <div className="font-mono text-micro text-ink2">{t.label}</div>
              </div>
            )}
          </div>
        ))}
        {target != null && (
          <div className="absolute top-4 -translate-x-1/2" style={{ left: x(target) }}>
            <div className="text-center font-mono text-micro font-semibold text-star">✦</div>
            <div className="mx-auto h-3 w-px translate-y-2.5 bg-star" />
          </div>
        )}
      </div>
      <p className="mt-1 font-mono text-micro text-ink2">
        {Math.round(probability * 100)}% of simulated paths reach the target · Monte Carlo on
        historical returns · estimate, not a promise
      </p>
    </div>
  );
}
