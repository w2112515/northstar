"use client";

/** Overview (cockpit), APEX-iteration composition: three columns -
 *  left: Today's brief + Strategy book; center: big-number hero (orbit
 *  variant while a pass runs or the kill switch is on) + Plan-vs-reality
 *  cone; right: Needs you + Agent pipeline + Live feed. Market and
 *  Positions close the page. All real data via the shared SWR layer. */

import Link from "next/link";
import { useMemo } from "react";
import { fmtTs, fmtUsd } from "@/lib/api";
import { useApi } from "@/lib/data";
import { Badge, Button, Panel, Skeleton } from "@/components/ui";
import { GoalOrbit } from "@/components/orbit";
import { ProbStrip, TrajectoryHero } from "@/components/trajectory";
import { MarketPanel, type WatchGroup } from "@/components/market";
import { Pipeline } from "@/components/pipeline";
import { PositionsPanel } from "@/components/positions";
import { Approvals } from "@/components/approvals";
import { LiveFeed } from "@/components/feed";
import type {
  Approval,
  BandsDoc,
  Brief,
  CompassDoc,
  EngineState,
  ForecastDoc,
  Instance,
  JEvent,
  OpenOrder,
  PassProgress,
  Position,
  ScoutDoc,
  Trace,
  Weather,
} from "@/lib/types";

// -------------------------------------------------------------- left column

function TodaysBrief({
  brief,
  approvals,
  forecastDoc,
  weather,
  regimeLabel,
}: {
  brief: { log: Brief; ts: string } | null;
  approvals: number;
  forecastDoc: ForecastDoc | null;
  weather: Weather;
  regimeLabel: string | null;
}) {
  const items: string[] = [];
  // 01 - the strongest forecast signal on the board
  if (forecastDoc) {
    const top = Object.entries(forecastDoc.symbols).sort(
      (a, b) => Math.abs(b[1].exp_5d_pct) - Math.abs(a[1].exp_5d_pct),
    )[0];
    if (top) {
      items.push(
        `${top[0]} is the strongest signal on the board: ${top[1].exp_5d_pct >= 0 ? "+" : ""}${top[1].exp_5d_pct}% expected over 5 days (model estimate).`,
      );
    }
  }
  // 02 - what needs a human
  items.push(
    approvals > 0
      ? `${approvals} approval${approvals > 1 ? "s" : ""} waiting on your call - silence is an automatic no.`
      : "Nothing waiting on you. The gate is working the book.",
  );
  // 03 - the weather frame
  if (weather) {
    items.push(
      `Weather ${weather.bucket} (${weather.score ?? "—"})${regimeLabel ? ` · regime ${regimeLabel.replace(/_/g, " ")}` : ""}.`,
    );
  }

  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2">
        <span className="kicker">Today&apos;s brief</span>
        {brief && (
          <Badge tone={brief.log.narrator === "gemini" ? "gold" : "mist"}>
            {brief.log.narrator === "gemini" ? "AI" : "system"}
          </Badge>
        )}
        {brief && <span className="num ml-auto text-micro text-mist">{fmtTs(brief.ts)}</span>}
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((line, i) => (
          <p key={i} className="flex gap-2.5 text-2xs leading-relaxed text-mist">
            <span className="num shrink-0 text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
            <span>{line}</span>
          </p>
        ))}
      </div>
      {brief && (
        <p className="mt-3 line-clamp-3 border-t border-line pt-2.5 text-2xs leading-relaxed text-mist">
          {brief.log.narrative}
        </p>
      )}
    </Panel>
  );
}

function StrategyBook({ instances }: { instances: Instance[] }) {
  const live = instances.filter((i) => i.status !== "archived");
  const running = live.filter((i) => i.enabled).length;
  const trial = live.filter((i) => i.status === "trial").length;
  const paused = live.filter((i) => !i.enabled).length;
  const rows = [
    { label: "Running", n: running, dot: "bg-teal" },
    { label: "On trial", n: trial, dot: "bg-amber" },
    { label: "Paused", n: paused, dot: "bg-mist/50" },
  ];
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <span className="kicker">Strategy book</span>
        <Link href="/strategies" className="text-2xs text-signal hover:text-ink">
          Manage →
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className={`size-1.5 rounded-full ${r.dot}`} />
            <span className="text-mist">{r.label}</span>
            <span className="num ml-auto text-ink">{r.n}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------- center hero

function Hero({
  state,
  bands,
  equityCurve,
  orbitMode,
}: {
  state: EngineState;
  bands: BandsDoc | null;
  equityCurve: { t: string; equity: number }[];
  /** pass running / kill switch: the orbit takes the hero slot */
  orbitMode: boolean;
}) {
  const goal = state.goal!;
  const plan = state.plan;
  const equity = state.account.equity;
  const target = goal.target_amount ?? bands?.target_amount ?? goal.capital_base;
  const base = goal.capital_base;
  const progress = Math.min(Math.max((equity - base) / Math.max(target - base, 1), 0), 1);

  // Days left, derived from data timestamps only (no wall clock in render).
  const totalDays = (goal.horizon_months ?? bands?.months ?? 12) * 30.44;
  const startMs = bands?.start ? Date.parse(bands.start) : NaN;
  const lastMs = equityCurve.length > 0 ? Date.parse(equityCurve[equityCurve.length - 1].t) : NaN;
  const elapsed =
    Number.isFinite(startMs) && Number.isFinite(lastMs) ? (lastMs - startMs) / 86_400_000 : 0;
  const daysLeft = Math.max(0, Math.round(totalDays - elapsed));

  return (
    <Panel className="flex flex-col justify-center gap-3 p-6">
      {orbitMode ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="kicker">Equity</span>
            <span className="num text-sm text-mist">{fmtUsd(equity)}</span>
          </div>
          <GoalOrbit start={base} equity={equity} target={target} odds={plan?.probability ?? 0} />
        </>
      ) : (
        <div className="hero-num text-gold">{fmtUsd(equity)}</div>
      )}
      {plan && (
        <>
          <div className="text-sm font-medium uppercase tracking-[0.14em] text-ink">
            {(plan.probability * 100).toFixed(0)}% probability of reaching {fmtUsd(target, 0)}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{ width: `${Math.max(2, progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-micro text-mist">
            <span>{daysLeft} days left</span>
            <span>Pass line {fmtUsd(target, 0)}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------- page

export default function Overview() {
  const stateQ = useApi<EngineState>("/api/engine/state", 20000);
  const state = stateQ.data ?? null;
  const bands = useApi<BandsDoc>("/api/goal/bands", 60000).data ?? null;
  const equityCurve =
    useApi<{ points: { t: string; equity: number }[] }>("/api/equity-history", 5 * 60000).data
      ?.points ?? [];
  const approvalsQ = useApi<{ pending: Approval[] }>("/api/approvals", 20000);
  const approvals = approvalsQ.data?.pending ?? [];
  const posQ = useApi<{ positions: Position[]; open_orders: OpenOrder[] }>("/api/positions", 20000);
  const positions = useMemo(() => posQ.data?.positions ?? [], [posQ.data]);
  const openOrders = posQ.data?.open_orders ?? [];
  const feedQ = useApi<{ events: JEvent[] }>("/api/journal?limit=6", 20000);
  const feed = feedQ.data?.events ?? [];
  const trace =
    (useApi<{ events: JEvent[] }>("/api/journal?kinds=trace&limit=1", 20000).data?.events[0]
      ?.payload as Trace | undefined) ?? null;
  const forecastQ = useApi<{ forecast: ForecastDoc | null; available: boolean }>(
    "/api/forecast",
    60000,
  );
  const forecastDoc = forecastQ.data?.forecast ?? null;
  const scout = useApi<{ scout: ScoutDoc | null }>("/api/scout", 60000).data?.scout ?? null;
  const weather = useApi<{ weather: Weather }>("/api/weather", 60000).data?.weather ?? null;
  const regime =
    useApi<{ compass: CompassDoc | null }>("/api/compass", 5 * 60000).data?.compass?.regime ?? null;
  const instances =
    useApi<{ instances: Instance[] }>("/api/strategies", 60000).data?.instances ?? [];
  const passProgress =
    useApi<{ progress: PassProgress | null }>("/api/engine/pass-progress", 3000).data?.progress ??
    null;
  // The nightly brief shares the "digest" kind with per-pass digests that
  // carry no narrative - pick the newest event that actually has one.
  const digestEvents =
    useApi<{ events: JEvent[] }>("/api/journal?kinds=digest&limit=10", 60000).data?.events ?? [];
  const briefEv = digestEvents.find(
    (e) => (e.payload as { captain?: Brief } | undefined)?.captain?.narrative,
  );
  const brief = briefEv
    ? { log: (briefEv.payload as { captain: Brief }).captain, ts: briefEv.ts }
    : null;
  const debateEv = useApi<{ events: JEvent[] }>("/api/journal?kinds=debate&limit=1", 20000).data
    ?.events[0];

  // A failed query must never masquerade as an empty account.
  const err = stateQ.error
    ? "Can't reach the trading service - shown data may be stale."
    : posQ.error || approvalsQ.error || feedQ.error
      ? "Some data is unreachable - shown data may be stale."
      : "";

  const { chartSymbols, watchGroups } = useMemo(() => {
    const und = (s: string) => (s.length > 15 ? s.slice(0, s.length - 15) : s);
    const holdings: string[] = [];
    for (const p of positions) {
      const u = und(p.symbol);
      if (!holdings.includes(u)) holdings.push(u);
    }
    const radar: string[] = [];
    for (const c of scout?.candidates ?? []) {
      if (!holdings.includes(c.symbol) && !radar.includes(c.symbol)) radar.push(c.symbol);
    }
    const core: string[] = [];
    for (const s of Object.keys(forecastDoc?.symbols ?? {})) {
      if (!holdings.includes(s) && !radar.includes(s) && !core.includes(s)) core.push(s);
    }
    if (!holdings.includes("SPY") && !radar.includes("SPY") && !core.includes("SPY")) core.push("SPY");
    const groups: WatchGroup[] = [
      { label: "Holdings", symbols: holdings },
      { label: "Scout", symbols: radar.slice(0, 10) },
      { label: "Core", symbols: core },
    ];
    return { chartSymbols: groups.flatMap((g) => g.symbols), watchGroups: groups };
  }, [positions, forecastDoc, scout]);

  if (!state) {
    return (
      <div className="flex flex-col gap-3">
        {err ? (
          <div className="rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
            {err}
          </div>
        ) : null}
        <div className="panel p-5">
          <Skeleton rows={5} />
        </div>
      </div>
    );
  }

  const goal = state.goal;
  const plan = state.plan;
  const passRunning = passProgress?.status === "running";
  const orbitMode = passRunning || state.kill_switch;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {err && (
        <div className="rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber">
          {err}
        </div>
      )}

      {!goal && (
        <Panel tone="gold" className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h1 className="text-lg font-medium tracking-tight">Set your North Star</h1>
            <p className="mt-0.5 max-w-xl text-sm text-mist">
              Tell us the destination - &quot;grow $100k to $110k in a year&quot; - and we&apos;ll
              show you honest odds before a single simulated dollar moves.
            </p>
          </div>
          <Link href="/onboarding">
            <Button variant="gold">Plan it</Button>
          </Link>
        </Panel>
      )}

      {goal && (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* left: brief + book */}
          <div className="flex min-w-0 flex-col gap-3">
            <TodaysBrief
              brief={brief}
              approvals={approvals.length}
              forecastDoc={forecastDoc}
              weather={weather}
              regimeLabel={regime?.label ?? null}
            />
            <StrategyBook instances={instances} />
          </div>

          {/* center: hero + plan-vs-reality */}
          <div className="flex min-w-0 flex-col gap-3">
            <Hero state={state} bands={bands} equityCurve={equityCurve} orbitMode={orbitMode} />
            {plan && (
              <Panel className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="kicker">Plan vs reality</span>
                  <span className="num text-micro text-mist">
                    {(plan.probability * 100).toFixed(0)}% odds · estimate
                  </span>
                </div>
                <TrajectoryHero
                  bands={bands?.bands?.p50?.length ? bands.bands : null}
                  months={bands?.months ?? goal.horizon_months ?? 12}
                  target={goal.target_amount ?? bands?.target_amount ?? null}
                  base={goal.capital_base}
                  start={bands?.start}
                  equity={equityCurve}
                />
                {bands?.bands?.p50?.length ? (
                  <ProbStrip
                    bands={bands.bands}
                    base={goal.capital_base}
                    target={goal.target_amount ?? bands?.target_amount ?? null}
                    probability={plan.probability}
                  />
                ) : null}
              </Panel>
            )}
          </div>

          {/* right: needs you + pipeline + feed */}
          <div className="flex min-w-0 flex-col gap-3">
            <Approvals approvals={approvals} killSwitch={state.kill_switch} />
            <Panel className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="kicker">Agent pipeline</span>
                {passRunning && <Badge tone="gold">pass running</Badge>}
              </div>
              <Pipeline
                trace={trace}
                progress={passProgress}
                scoutNote={
                  scout && scout.candidates.length > 0
                    ? `${scout.candidates.length} picks · ${scout.source === "screener" ? "market-wide" : "core fallback"}`
                    : null
                }
                weatherNote={weather ? `${weather.bucket} · ${weather.score ?? "—"}` : null}
                forecastNote={
                  forecastDoc
                    ? `${Object.keys(forecastDoc.symbols).length} symbols · 5d bands`
                    : null
                }
                debateLive={!!debateEv}
              />
            </Panel>
            <LiveFeed events={feed} oneCol />
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="p-4">
          <MarketPanel symbols={chartSymbols} groups={watchGroups} forecastDoc={forecastDoc} />
        </Panel>
        <PositionsPanel
          positions={positions}
          openOrders={openOrders}
          marketOpen={state.clock.is_open}
        />
      </div>
    </div>
  );
}
