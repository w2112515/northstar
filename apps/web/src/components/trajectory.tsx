"use client";

/** Plan-vs-reality chart: the actual equity curve (gold) drawn over the
 *  plan's Monte Carlo cone (p10-p90 signal fan, p50 dashed), with the target
 *  as a dashed ruled line carrying the small star. The honest answer to
 *  "am I on track, and how do I know". */

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
/** Y-axis follows current equity + the near cone, not month-12 p90. */
const FOCUS_MONTHS = 3;

type Bands = { p10: number[]; p50: number[]; p90: number[] };

/** Tight money domain: include the pass line, clip the far lucky tail. */
export function focusYDomain(values: number[], padFrac = 0.1): [number, number] | ["auto", "auto"] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return ["auto", "auto"];
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  if (lo === hi) {
    const slack = Math.max(Math.abs(lo) * 0.02, 500);
    return [lo - slack, hi + slack];
  }
  const pad = (hi - lo) * padFrac;
  return [lo - pad, hi + pad];
}

export function TrajectoryHero({
  bands,
  months,
  target,
  base,
  start,
  equity,
  height = 260,
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
  height?: number;
  className?: string;
}) {
  // Guard against a degraded bands doc (thin data -> null subfields upstream).
  const usableBands =
    bands && Array.isArray(bands.p50) && bands.p50.length > 0 && bands.p10.length === bands.p50.length
      ? bands
      : null;

  // Without a plan start, align the actual curve to its own first point so
  // the chart still draws instead of silently emptying.
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
  const nearD = Math.max(FOCUS_MONTHS * DAYS_PER_MONTH, (todayD ?? 0) + DAYS_PER_MONTH);
  const lastP50 = usableBands?.p50[usableBands.p50.length - 1];
  // Include median landing so the pass line is not glued to the chart roof;
  // still omit far p90 so a lucky tail cannot empty the pane.
  const yDomain = focusYDomain([
    ...actualRows.map((r) => r.equity),
    ...coneRows
      .filter((r) => r.d <= nearD)
      .flatMap((r) => [r.band[0], r.band[1], r.p50]),
    ...(base != null ? [base] : []),
    ...(target != null ? [target] : []),
    ...(lastP50 != null ? [lastP50] : []),
  ]);
  const ariaLabel =
    lastEquity != null && target != null
      ? `Plan versus reality chart. Actual equity ${fmtUsd(lastEquity)}, target ${fmtUsd(target)}${
          usableBands ? `, median simulated path ends at ${fmtUsd(usableBands.p50[usableBands.p50.length - 1])}` : ""
        }.`
      : "Plan versus reality chart.";

  // Explicit month ticks: recharts' auto ticks land on odd day counts and
  // render as skipping months (+0/+2/+3/+5mo), which reads like a bug.
  const tickStep = Math.max(1, Math.ceil(months / 6));
  const monthTicks = [];
  for (let m = 0; m <= months; m += tickStep) monthTicks.push(m * DAYS_PER_MONTH);

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        {/* accessibilityLayer would add a focusable role="application" inside
            this role="img" wrapper - a tab stop that reads axis noise. */}
        <ComposedChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <XAxis
            type="number"
            dataKey="d"
            domain={[0, maxD]}
            ticks={monthTicks}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART.line }}
            tickFormatter={(d: number) => `+${Math.round(d / DAYS_PER_MONTH)}mo`}
          />
          <YAxis
            domain={yDomain}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={52}
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
              fill={CHART.signal}
              fillOpacity={0.14}
              isAnimationActive={false}
            />
          )}
          {usableBands && (
            <Line
              data={coneRows}
              dataKey="p50"
              stroke={CHART.mist}
              strokeDasharray="4 3"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            data={actualRows}
            dataKey="equity"
            stroke={CHART.gold}
            strokeWidth={2.25}
            dot={false}
            isAnimationActive={false}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              // Without extendDomain, recharts silently discards the line
              // whenever the target sits outside the cone's data range - the
              // red path then shows "0% odds" over a healthy-looking chart.
              ifOverflow="extendDomain"
              stroke={CHART.gold}
              strokeDasharray="6 4"
              strokeWidth={1}
              label={{
                value: `✦ ${fmtUsd(target, 0)}`,
                position: "insideTopRight",
                fill: CHART.gold,
                fontSize: 11,
                fontFamily: "var(--font-plex-mono), monospace",
              }}
            />
          )}
          {todayD != null && todayD > 0 && todayD < maxD && (
            <ReferenceLine x={Math.floor(todayD)} stroke={CHART.line} strokeDasharray="2 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-micro text-mist">
        {actualRows.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-gold" /> actual equity
          </span>
        )}
        {usableBands && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 bg-signal/20" /> p10–p90 simulated cone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t border-dashed border-mist" /> median path
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
}: {
  bands: Bands | null;
  base: number;
  target: number | null;
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

  return (
    <div className="pt-1">
      {/* The above-row labels must live INSIDE this box. They used to hang
          from a zero-height top-0 anchor via bottom-5, which pushed them out
          of the container and into whatever rendered above (the chart
          legend) - the worst-case "rough" label was unreadable. */}
      <div className="relative h-20">
        <div className="absolute inset-x-0 top-10 h-px bg-line" />
        {ticks.map((t) => (
          <div key={t.label} className="absolute inset-y-0" style={{ left: x(t.v) }}>
            {!t.below && (
              <div className="absolute left-0 top-0 -translate-x-1/2 text-center">
                <div className="whitespace-nowrap font-mono text-micro tabular-nums text-ink">
                  {fmtUsd(t.v, 0)}
                </div>
                <div className="font-mono text-micro text-mist">{t.label}</div>
              </div>
            )}
            <div
              className={`absolute left-0 top-10 w-px -translate-x-1/2 ${
                t.strong ? "h-3.5 -translate-y-1 bg-ink" : "h-2.5 bg-mist/60"
              }`}
            />
            {t.below && (
              <div className="absolute left-0 top-12 -translate-x-1/2 text-center">
                <div className="whitespace-nowrap font-mono text-micro tabular-nums text-ink">
                  {fmtUsd(t.v, 0)}
                </div>
                <div className="font-mono text-micro text-mist">{t.label}</div>
              </div>
            )}
          </div>
        ))}
        {target != null && (
          <div className="absolute top-4 -translate-x-1/2" style={{ left: x(target) }}>
            <div className="text-center font-mono text-micro font-semibold text-gold">✦</div>
            <div className="mx-auto h-3 w-px translate-y-1 bg-gold" />
          </div>
        )}
      </div>
      <p className="mt-1 font-mono text-micro text-mist">
        Terminal outcomes · Monte Carlo on historical returns · estimate, not a promise
      </p>
    </div>
  );
}
