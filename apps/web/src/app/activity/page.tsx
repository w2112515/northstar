"use client";

/** Activity - what the system is doing right now: the live run schematic,
 *  the market it trades, the event stream, and the controls. Context strip
 *  on top carries regime/weather so the numbers below have a frame. */

import { useEffect, useMemo, useState } from "react";
import { apiPost, fmtTs } from "@/lib/api";
import { useApi } from "@/lib/data";
import { Button, EmptyState, PageHeader, Section, Skeleton, Stamp, eventStamp } from "@/components/ui";
import { MarketPanel, type WatchGroup } from "@/components/market";
import { RunSchematic } from "@/components/schematic";
import type {
  CompassDoc,
  Debate,
  EngineState,
  ForecastDoc,
  JEvent,
  OptionsWatch,
  PassProgress,
  Position,
  RegimeInfo,
  ScoutDoc,
  Trace,
  Weather,
} from "@/lib/types";

const REGIME_SHORT: Record<string, { short: string; tone: "green" | "amber" | "red" | "plain" }> = {
  up_calm: { short: "up · calm", tone: "green" },
  up_stressed: { short: "up · stressed", tone: "amber" },
  flat_choppy: { short: "flat · choppy", tone: "amber" },
  down_calm: { short: "down · calm", tone: "red" },
  down_stressed: { short: "down · stressed", tone: "red" },
  unknown: { short: "unknown", tone: "plain" },
};

const WX_TONE: Record<string, "green" | "amber" | "red" | "plain"> = {
  clear: "green",
  choppy: "amber",
  storm: "red",
  offline: "plain",
};

export default function Activity() {
  const [busy, setBusy] = useState("");
  const [actErr, setActErr] = useState("");

  const state = useApi<EngineState>("/api/engine/state", 20000).data ?? null;
  const autopilot = useApi<{ autopilot: boolean }>("/api/loop/status", 15000).data?.autopilot ?? false;
  const trace =
    (useApi<{ events: JEvent[] }>("/api/journal?kinds=trace&limit=1", 20000).data?.events[0]
      ?.payload as Trace | undefined) ?? null;
  const debateEv = useApi<{ events: JEvent[] }>("/api/journal?kinds=debate&limit=1", 20000).data
    ?.events[0];
  const debate = debateEv ? (debateEv.payload as unknown as Debate) : null;
  const feedQ = useApi<{ events: JEvent[] }>("/api/journal?limit=12", 20000);
  const feed = feedQ.data?.events ?? [];
  // The flash means "arrived while you watched" - entries older than the page
  // mount render still. Set in an effect: no wall-clock reads during render.
  const [mountedAt, setMountedAt] = useState<number | null>(null);
  useEffect(() => {
    // deferred out of the effect body: no synchronous setState in effects
    const t = setTimeout(() => setMountedAt(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  const forecastQ = useApi<{ forecast: ForecastDoc | null; available: boolean }>("/api/forecast", 60000);
  const forecastDoc = forecastQ.data?.forecast ?? null;
  const scoutQ = useApi<{ scout: ScoutDoc | null; options_watch: OptionsWatch }>("/api/scout", 60000);
  const scout = scoutQ.data?.scout ?? null;
  const optionsWatch = scoutQ.data?.options_watch ?? null;
  const weather = useApi<{ weather: Weather }>("/api/weather", 60000).data?.weather ?? null;
  const compass = useApi<{ compass: CompassDoc | null }>("/api/compass", 5 * 60000).data?.compass ?? null;
  const posQ = useApi<{ positions: Position[] }>("/api/positions", 20000);
  const positions = useMemo(() => posQ.data?.positions ?? [], [posQ.data]);
  const passProgress =
    useApi<{ progress: PassProgress | null }>("/api/engine/pass-progress", 3000).data?.progress ?? null;

  const regime: RegimeInfo | null = compass?.regime ?? null;
  const regimeMeta = REGIME_SHORT[regime?.label ?? "unknown"] ?? REGIME_SHORT.unknown;

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      window.dispatchEvent(new Event("northstar:refresh"));
      setActErr("");
    } catch {
      setActErr(`"${label}" did not go through - API unreachable or refused. Shown data may be stale.`);
    } finally {
      setBusy("");
    }
  }

  // Watchlist = what the account holds + what the scout found + the core
  // benchmark set. The scout's picks belong on the biggest visual on the
  // page: that is the evidence the research loop actually turns.
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity"
        sub="What the system is doing right now - every pass, every check, every fill."
      />

      {actErr && (
        <div className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 text-body text-amber">
          {actErr}
        </div>
      )}

      {/* context strip: the frame the numbers below live in */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-hairline py-2 font-mono text-micro text-ink2">
        {regime && regime.label !== "unknown" && (
          <span className="flex items-center gap-1.5">
            regime <Stamp tone={regimeMeta.tone}>{regimeMeta.short}</Stamp>
          </span>
        )}
        {regime && (
          <>
            <span>streak <span className="text-ink tabular-nums">{regime.streak_days}d</span></span>
            <span>
              20d vol{" "}
              <span className="text-ink tabular-nums">
                {regime.realized_vol_20d != null ? `${(regime.realized_vol_20d * 100).toFixed(0)}%` : "—"}
              </span>
            </span>
            <span>
              breadth{" "}
              <span className="text-ink tabular-nums">
                {regime.breadth_above_50sma != null ? `${(regime.breadth_above_50sma * 100).toFixed(0)}%` : "—"}
              </span>
            </span>
          </>
        )}
        {weather && (
          <span className="flex items-center gap-1.5">
            weather <Stamp tone={WX_TONE[weather.bucket] ?? "plain"}>{weather.bucket}</Stamp>
            <span className="tabular-nums">{weather.score ?? "—"}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 ${state?.clock.is_open ? "bg-green" : "bg-ink2/40"}`} />
          {state?.clock.is_open ? "market open" : "market closed"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 ${autopilot ? "bg-green" : "bg-ink2/40"}`} />
          autopilot {autopilot ? "on" : "off"}
        </span>
        {scout && scout.candidates.length > 0 && (
          <span className="ml-auto">
            scout:{" "}
            <span className="text-ink">
              {scout.candidates.slice(0, 4).map((c) => c.symbol).join(" ")}
              {scout.candidates.length > 4 ? ` +${scout.candidates.length - 4}` : ""}
            </span>
          </span>
        )}
      </div>

      <Section
        title="Live run"
        info="The real ADK workflow, not an illustration: each node lights up as a pass runs. Ai tags mark LLM advisors (triage, explain, debate council); CODE tags mark deterministic stages - only code touches money. Satellites feed the loop: scout, weather, TimesFM."
      >
        <RunSchematic
          trace={trace}
          progress={passProgress}
          debate={debate}
          weatherBucket={weather?.bucket}
          forecastNote={
            forecastDoc ? `${Object.keys(forecastDoc.symbols).length} symbols · 5d bands` : null
          }
          scoutNote={
            scout && scout.candidates.length > 0
              ? `${scout.candidates.length} picks · ${scout.source === "screener" ? "market-wide" : "core fallback"}`
              : null
          }
        />
      </Section>

      <Section
        title="Market"
        info="Real daily candles and volume from Alpaca data. Arrows mark our own journaled fills - nothing else. Dashed lines draw the TimesFM q10/q50/q90 forecast band into the next five sessions. This panel is read-only: nothing here can place an order."
      >
        <MarketPanel symbols={chartSymbols} groups={watchGroups} forecastDoc={forecastDoc} />
      </Section>

      <Section
        title="Scout report"
        hint={scout ? fmtTs(scout.ts) : undefined}
        info="Every night the scout scans the optionable market (or the core set, honestly labeled, when the screener is down), applies liquidity and sanity floors, and scores survivors on momentum, trend, pullback and squeeze. Factor weights re-tilt from measured rank-IC. Top picks join the trading universe and the watchlist above - this table is why those names are there."
        actions={
          <Button
            variant="ghost"
            onClick={() => act("scout", () => apiPost("/api/scout/run", {}))}
            disabled={busy !== ""}
          >
            {busy === "scout" ? "Scanning…" : "Scan now"}
          </Button>
        }
      >
        {scoutQ.error ? (
          <p className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 font-mono text-micro text-amber">
            Scout report unreachable - data may be stale.
          </p>
        ) : scoutQ.isLoading ? (
          <Skeleton rows={5} />
        ) : !scout || scout.candidates.length === 0 ? (
          <EmptyState
            title="No scout report yet"
            body="The scout files its report nightly, or press Scan now to send it out immediately."
          />
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  <th className="py-1.5 pr-3 font-semibold">#</th>
                  <th className="py-1.5 pr-3 font-semibold">Symbol</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Price</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Score</th>
                  <th className="py-1.5 pr-3 font-semibold">Flavor</th>
                  <th className="py-1.5 font-semibold">Why</th>
                </tr>
              </thead>
              <tbody>
                {scout.candidates.map((c, i) => (
                  <tr key={c.symbol} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2 pr-3 font-mono text-micro tabular-nums text-ink2">{i + 1}</td>
                    <td className="py-2 pr-3 font-mono text-body font-semibold">{c.symbol}</td>
                    <td className="py-2 pr-3 text-right font-mono text-body tabular-nums">
                      ${c.price.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-body tabular-nums">
                      {c.score.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3">
                      <Stamp>{c.flavor}</Stamp>
                    </td>
                    <td className="py-2 text-body text-ink2">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {optionsWatch && optionsWatch.ranked.length > 0 && (
              <p className="mt-3 border-l-2 border-hairline py-0.5 pl-3 font-mono text-micro text-ink2">
                options watch (CSP yield):{" "}
                {optionsWatch.ranked.slice(0, 3).map((r, i) => (
                  <span key={r.symbol} className="whitespace-nowrap">
                    {i > 0 && " · "}
                    <span className="text-ink">{r.symbol}</span> ${r.strike} put {r.dte}d Δ
                    {r.delta.toFixed(2)} → {(r.ann_yield * 100).toFixed(0)}%/yr
                  </span>
                ))}
              </p>
            )}
            <p className="mt-2 font-mono text-micro text-ink2">
              scanned {scout.scanned.toLocaleString()} · passed floor {scout.passed_floor} · source{" "}
              {scout.source}
              {scout.weight_tilt ? ` · ${scout.weight_tilt}` : ""}
              {scout.note ? ` · ${scout.note}` : ""}
            </p>
          </div>
        )}
      </Section>

      <Section title="Event stream" hint="latest 12" info="Everything the system did, in plain words, newest first. The full record lives on Proof.">
        {feedQ.error ? (
          <p className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 font-mono text-micro text-amber">
            Event stream unreachable - data may be stale.
          </p>
        ) : feed.length === 0 ? (
          <EmptyState title="No activity yet" body="Run one pass below to see the loop work." />
        ) : (
          <div>
            {feed.map((e) => {
              const s = eventStamp(e);
              const isNew = mountedAt != null && Date.parse(e.ts) > mountedAt;
              return (
                <div
                  key={e.id}
                  className={`flex items-baseline gap-3 border-b border-hairline/60 py-2 last:border-0 ${
                    isNew ? "animate-flash" : ""
                  }`}
                >
                  <span className="w-24 shrink-0">
                    <Stamp tone={s.tone}>{s.label}</Stamp>
                  </span>
                  <p className="min-w-0 flex-1 text-body leading-snug">{e.human || "(event)"}</p>
                  <span className="shrink-0 font-mono text-micro tabular-nums text-ink2">
                    {fmtTs(e.ts)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Controls" info="Autopilot passes run every 15 minutes and always go through the risk gate. The kill switch stops everything immediately.">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => act("autopilot", () => apiPost("/api/loop/autopilot", { on: !autopilot }))}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              autopilot ? "bg-indigo" : "border border-hairline bg-inset"
            }`}
            disabled={busy !== ""}
            role="switch"
            aria-checked={autopilot}
            aria-label="Autopilot"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full border border-hairline bg-ink transition-all ${
                autopilot ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <span className="text-body">Autopilot {autopilot ? "on" : "off"}</span>

          <button
            onClick={() => act("tick", () => apiPost("/api/loop/tick", { reason: "manual" }))}
            disabled={busy !== ""}
            className="rounded-lg border border-hairline bg-inset px-4 py-2 text-body text-ink transition-colors hover:border-ink/40 disabled:opacity-40"
          >
            {busy === "tick" ? "Running one pass…" : "Run one pass now"}
          </button>

          <button
            onClick={() => act("kill", () => apiPost("/api/engine/kill-switch", { on: !state?.kill_switch }))}
            disabled={busy !== "" || !state}
            className="ml-auto border border-red/60 px-4 py-2 text-body text-red transition-colors hover:bg-red/5 disabled:opacity-40"
          >
            {state?.kill_switch ? "Release kill switch" : "Kill switch - stop everything"}
          </button>
        </div>
        <p className="mt-2 font-mono text-micro text-ink2">
          Market {state?.clock.is_open ? "is open" : "closed - orders queue to next open"}.
        </p>
      </Section>
    </div>
  );
}
