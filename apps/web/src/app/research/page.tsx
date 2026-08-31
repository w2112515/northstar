"use client";

/** Research workbench: one desk, four tabs - Radar / Compass / Evolution /
 *  Mining. The night job files reports here; decisions are always yours. */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiPost, fmtTs } from "@/lib/api";
import { useApi } from "@/lib/data";
import { Badge, Button, EmptyState, PageTitle, Panel, Skeleton, Stat, Tabs } from "@/components/ui";
import { ForecastFan } from "@/components/forecast";
import { EvolutionTab, MiningTab } from "@/components/lab";
import type {
  AdvisorState,
  Brief,
  CompassDoc,
  Experiment,
  ForecastDoc,
  ForecastSkill,
  JEvent,
  OptionsWatch,
  ScoutDoc,
} from "@/lib/types";

const TABS = [
  { id: "radar", label: "Radar" },
  { id: "compass", label: "Compass" },
  { id: "evolution", label: "Evolution" },
  { id: "mining", label: "Mining" },
];

// amber is reserved for "waiting on a human" - a stressed market is not
// waiting for anyone, so mid states read neutral and down states read coral.
const REGIME_TONE: Record<string, "teal" | "amber" | "coral" | "mist"> = {
  up_calm: "teal",
  up_stressed: "mist",
  flat_choppy: "mist",
  down_calm: "coral",
  down_stressed: "coral",
  unknown: "mist",
};

const FLAVOR_TONE: Record<string, "teal" | "coral" | "mist"> = {
  uptrend: "teal",
  selloff: "coral",
  range: "mist",
};

// ------------------------------------------------------------------ radar tab

function RadarTab({
  scout,
  optionsWatch,
  brief,
  busy,
  onScan,
}: {
  scout: ScoutDoc | null;
  optionsWatch: OptionsWatch;
  brief: { log: Brief; ts: string } | null;
  busy: boolean;
  onScan: () => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="kicker">Scout candidates</span>
          <Button variant="ghost" size="sm" onClick={onScan} disabled={busy}>
            {busy ? "Scanning…" : "Scan now"}
          </Button>
        </div>
        {!scout || scout.candidates.length === 0 ? (
          <EmptyState
            title="No scout report yet"
            body="The night job scans the whole market daily; Scan now runs one immediately."
          />
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-md text-left text-sm">
                <thead className="text-xs text-mist">
                  <tr className="border-b border-line">
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 font-medium">Score</th>
                    <th className="pb-2 font-medium">Why it&apos;s on the radar</th>
                    <th className="pb-2 font-medium">Flavor</th>
                  </tr>
                </thead>
                <tbody>
                  {scout.candidates.slice(0, 8).map((c) => (
                    <tr key={c.symbol} className="border-b border-line/60 align-top">
                      <td className="py-2.5 pr-3 font-medium">{c.symbol}</td>
                      <td className="num py-2.5 pr-3 text-signal">{c.score.toFixed(2)}</td>
                      <td className="py-2.5 pr-3 text-xs text-mist">{c.reason}</td>
                      <td className="py-2.5">
                        <Badge tone={FLAVOR_TONE[c.flavor] ?? "mist"}>{c.flavor}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-micro text-mist" title={scout.note || undefined}>
              {scout.scanned} names scanned · {scout.passed_floor} passed the liquidity floor ·{" "}
              {scout.source === "screener" ? "market-wide boards" : "core list (screener offline)"} ·{" "}
              {fmtTs(scout.ts)}
              {scout.weight_tilt ? ` · weights tilted: ${scout.weight_tilt}` : ""}
            </p>
          </>
        )}
      </Panel>
      <div className="flex flex-col gap-3">
        <Panel className="p-4">
          <div className="kicker">Options watch · best delta-band put yield</div>
          {optionsWatch && optionsWatch.ranked.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {optionsWatch.ranked.slice(0, 4).map((r) => (
                <li key={r.symbol}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink">{r.symbol}</span>
                    <span className="num text-xs text-teal">{(r.ann_yield * 100).toFixed(0)}%/yr</span>
                  </div>
                  <div className="text-2xs text-mist">
                    ${r.strike} strike · {r.dte} DTE (days to expiry) · bid ${r.bid} · Δ{r.delta}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-mist">
              No options scan yet - the next scout pass fills this in.
            </p>
          )}
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <span className="kicker">Daily brief</span>
            {brief && (
              <Badge tone={brief.log.narrator === "gemini" ? "gold" : "mist"}>
                {brief.log.narrator === "gemini" ? "AI" : "system"}
              </Badge>
            )}
          </div>
          {!brief ? (
            <p className="mt-2 text-sm text-mist">
              After each trading day the night job files an honest recap here.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ink">{brief.log.narrative}</p>
              {(Object.keys(brief.log.realized_by_family).length > 0 || brief.log.gate_rejections > 0) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {Object.entries(brief.log.realized_by_family).map(([fam, v]) => (
                    <Badge key={fam} tone={v >= 0 ? "teal" : "coral"}>
                      {fam.replace(/_/g, " ")} {v >= 0 ? "+" : ""}
                      {v.toFixed(0)}
                    </Badge>
                  ))}
                  {brief.log.gate_rejections > 0 && (
                    <Badge tone="coral">gate said no ×{brief.log.gate_rejections}</Badge>
                  )}
                </div>
              )}
              <p className="mt-2 font-mono text-micro text-mist">
                {brief.log.watch_tomorrow.length > 0 && (
                  <>watching {brief.log.watch_tomorrow.join(", ")} tomorrow · </>
                )}
                {fmtTs(brief.ts)}
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- compass tab

function CompassTab({
  compass,
  advisor,
  forecast,
  forecastAvailable,
  forecastSkill,
  busy,
  onDecide,
  onRun,
  onForecast,
}: {
  compass: CompassDoc | null;
  advisor: AdvisorState;
  forecast: ForecastDoc | null;
  forecastAvailable: boolean;
  forecastSkill: ForecastSkill;
  busy: string;
  onDecide: (adopt: boolean) => void;
  onRun: () => void;
  onForecast: () => void;
}) {
  const [showFullHypothesis, setShowFullHypothesis] = useState(false);
  const regime = compass?.regime;
  const proposal = advisor?.proposal?.status === "pending" ? advisor.proposal : null;
  const pastAdvice = !proposal
    ? (advisor?.history ?? []).filter((h) => h && h.status && h.status !== "pending").at(-1) ?? null
    : null;
  const bucketRows = compass
    ? Object.entries(compass.families)
        .map(([fam, buckets]) => ({ fam, stats: buckets[compass.regime.label] }))
        .filter((r) => r.stats)
    : [];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {regime && (
            <Badge tone={REGIME_TONE[regime.label] ?? "mist"}>
              {regime.label.replace(/_/g, " × ")}
            </Badge>
          )}
          <span className="kicker">regime · deterministic, no AI</span>
        </div>
        {!compass ? (
          <EmptyState
            title="No compass reading yet"
            body="The night job classifies the regime daily once enough SPY history is cached."
            action={
              <Button variant="quiet" size="sm" disabled={busy !== ""} onClick={onRun}>
                {busy === "compass" ? "Reading…" : "Read the compass now"}
              </Button>
            }
          />
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Stat k="streak" v={`${regime!.streak_days}d`} />
              <Stat
                k="20d vol"
                v={regime!.realized_vol_20d != null ? `${(regime!.realized_vol_20d * 100).toFixed(0)}%` : "—"}
              />
              <Stat
                k="breadth"
                v={regime!.breadth_above_50sma != null ? `${(regime!.breadth_above_50sma * 100).toFixed(0)}%` : "—"}
              />
            </dl>
            {compass.hypothesis && (
              <div className="mt-4">
                <button type="button" className="text-left" onClick={() => setShowFullHypothesis((v) => !v)}>
                  <div className="flex items-center gap-2">
                    <span className="kicker">
                      {compass.hypothesis_source === "gemini"
                        ? "AI hypothesis · gemini"
                        : "Hypothesis · rule-based"}
                    </span>
                    {/* the mandatory gold AI badge; rule-based text is not AI
                        and must not be attributed to it */}
                    {compass.hypothesis_source === "gemini" && <Badge tone="gold">AI</Badge>}
                  </div>
                  <p className={`mt-1 text-sm text-ink ${showFullHypothesis ? "" : "line-clamp-2"}`}>
                    {compass.hypothesis}
                  </p>
                  <span className="text-xs text-signal">{showFullHypothesis ? "Collapse" : "Expand"}</span>
                </button>
              </div>
            )}
            {bucketRows.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="kicker">Family performance in this regime (walk-forward)</div>
                {bucketRows.map(({ fam, stats }) => (
                  <div key={fam} className="panel-inset flex items-baseline justify-between px-3 py-2">
                    <div className="text-sm text-ink">{fam.replace(/_/g, " ")}</div>
                    {stats!.refused ? (
                      <span className="text-2xs text-mist">not enough history</span>
                    ) : (
                      <div className="num text-xs text-mist">
                        Sharpe{" "}
                        <span className={stats!.sharpe != null && stats!.sharpe >= 0 ? "text-teal" : "text-coral"}>
                          {stats!.sharpe?.toFixed(2) ?? "—"}
                        </span>
                        {stats!.win_rate != null && <> · win {(stats!.win_rate * 100).toFixed(0)}%</>}
                        {stats!.n_days != null && <> · {stats!.n_days}d</>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 font-mono text-micro text-mist">
              SPY 200SMA trend × vol percentile × breadth · {fmtTs(compass.ts)}
            </p>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-3">
        <Panel className="p-4" tone={proposal ? "amber" : undefined}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kicker">Plan advice</div>
              {proposal ? (
                <>
                  <div className="mt-1 text-sm font-medium text-ink">
                    Tilt toward {proposal.best_family.replace(/_/g, " ")}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-mist">
                    {proposal.evidence.map((line, i) => (
                      <li key={i}>· {line}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(proposal.tilts).map(([fam, d]) => (
                      <Badge key={fam} tone={d >= 0 ? "teal" : "coral"}>
                        {fam.replace(/_/g, " ")} {d >= 0 ? "+" : ""}
                        {(d * 100).toFixed(0)}%
                      </Badge>
                    ))}
                  </div>
                </>
              ) : pastAdvice ? (
                <>
                  <div className="mt-1 text-sm font-medium text-ink">
                    Last advice: tilt toward {pastAdvice.best_family.replace(/_/g, " ")}
                  </div>
                  <p className="mt-1 text-xs text-mist">
                    {pastAdvice.status}
                    {pastAdvice.ts ? ` · ${fmtTs(pastAdvice.ts)}` : ""} · dismissed advice is still scored
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-mist">
                  No advice pending. When the advisor sees a regime-edge mismatch, it waits here for
                  your call - never auto-applied.
                </p>
              )}
            </div>
          </div>
          {proposal && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="teal" disabled={busy !== ""} onClick={() => onDecide(true)}>
                {busy === "advice" ? "Applying…" : "Adopt tilt"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== ""} onClick={() => onDecide(false)}>
                Dismiss
              </Button>
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <span className="kicker">TimesFM 5-day fan</span>
            <Badge tone="gold">AI</Badge>
          </div>
          <div className="mt-2">
            <ForecastFan doc={forecast} available={forecastAvailable} busy={busy === "forecast"} onRefresh={onForecast} />
          </div>
          {forecastSkill && forecastSkill.n_checks ? (
            <p className="mt-2 font-mono text-micro text-mist">
              Scorecard: {(forecastSkill.coverage_q10_q90! * 100).toFixed(0)}% of realized closes landed in
              the q10–q90 band (target 80%) across {forecastSkill.n_checks} checks
              {forecastSkill.pinball_q50_pct != null && (
                <> · median-line pinball {forecastSkill.pinball_q50_pct.toFixed(2)}% of price</>
              )}
              .
            </p>
          ) : (
            <p className="mt-2 font-mono text-micro text-mist">
              Forecasts are graded nightly once realized closes exist.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- page

function Workbench() {
  const router = useRouter();
  const params = useSearchParams();
  const urlTab = params.get("tab");
  const tab = TABS.some((t) => t.id === urlTab) ? (urlTab as string) : "radar";

  const [busy, setBusy] = useState("");
  const [actErr, setActErr] = useState("");

  const scoutQ = useApi<{ scout: ScoutDoc | null; options_watch: OptionsWatch }>("/api/scout", 60000);
  const compassQ = useApi<{ compass: CompassDoc | null; advisor: AdvisorState }>("/api/compass", 5 * 60000);
  const forecastQ = useApi<{ forecast: ForecastDoc | null; available: boolean; skill: ForecastSkill }>(
    "/api/forecast",
    60000,
  );
  const experiments =
    useApi<{ experiments: Experiment[] }>("/api/lab/experiments", 60000).data?.experiments ?? [];
  const digestEvents =
    useApi<{ events: JEvent[] }>("/api/journal?kinds=digest&limit=10", 60000).data?.events ?? [];
  const briefEv = digestEvents.find(
    (e) => (e.payload as { captain?: Brief } | undefined)?.captain?.narrative,
  );
  const brief = briefEv
    ? { log: (briefEv.payload as { captain: Brief }).captain, ts: briefEv.ts }
    : null;

  const loaded = scoutQ.data !== undefined || scoutQ.error !== undefined;
  const err = scoutQ.error ? "Can't reach the trading service - shown data may be stale." : actErr;

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      setActErr("");
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setActErr(`"${label}" did not go through - API unreachable or refused. Shown data may be stale.`);
    } finally {
      setBusy("");
    }
  }

  const advisor = compassQ.data?.advisor ?? null;
  const dots: Record<string, boolean> = {
    radar: false,
    compass: advisor?.proposal?.status === "pending",
    evolution: experiments.some((e) => e.status === "awaiting_approval"),
    mining: false,
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PageTitle title="Research" sub="The night job files reports here; decisions are always yours." />
      <Tabs tabs={TABS} active={tab} onChange={(id) => router.replace(id === "radar" ? "/research" : `/research?tab=${id}`, { scroll: false })} dot={dots} />

      {err && (
        <div className="rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
          {err}
        </div>
      )}

      {!loaded && tab !== "evolution" && tab !== "mining" ? (
        <Panel className="p-5">
          <Skeleton rows={6} />
        </Panel>
      ) : tab === "radar" ? (
        <RadarTab
          scout={scoutQ.data?.scout ?? null}
          optionsWatch={scoutQ.data?.options_watch ?? null}
          brief={brief}
          busy={busy === "scout"}
          onScan={() => act("scout", () => apiPost("/api/scout/run", {}))}
        />
      ) : tab === "compass" ? (
        <CompassTab
          compass={compassQ.data?.compass ?? null}
          advisor={advisor}
          forecast={forecastQ.data?.forecast ?? null}
          forecastAvailable={forecastQ.data?.available ?? false}
          forecastSkill={forecastQ.data?.skill ?? null}
          busy={busy}
          onDecide={(adopt) => act("advice", () => apiPost("/api/advisor/decide", { adopt }))}
          onRun={() => act("compass", () => apiPost("/api/compass/run", {}))}
          onForecast={() => act("forecast", () => apiPost("/api/engine/forecast", {}))}
        />
      ) : tab === "evolution" ? (
        <EvolutionTab />
      ) : (
        <MiningTab />
      )}
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <Panel className="p-5">
          <Skeleton rows={6} />
        </Panel>
      }
    >
      <Workbench />
    </Suspense>
  );
}
