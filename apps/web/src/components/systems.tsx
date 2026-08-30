"use client";

/** System-page sections: the machinery. Evolution (propose -> walk-forward
 *  backtest -> deflated scoring -> a human), factor mining, the weather-floor
 *  validation study, and per-crew walk-forward stats in the current regime.
 *  Same honest pipeline as always - restyled for the ledger. */

import { useState } from "react";
import { apiGet, apiPost, fmtPct, fmtTs, summarizeParams } from "@/lib/api";
import { refreshAll, useApi } from "@/lib/data";
import { Button, EmptyState, Section, Skeleton, Stamp } from "@/components/ui";
import type {
  CompassDoc,
  Experiment,
  FactorDoc,
  MiningState,
  WeatherValidation,
} from "@/lib/types";

const STATUS_STAMP: Record<string, { tone: "indigo" | "green" | "red" | "amber" | "plain" }> = {
  promoted: { tone: "indigo" },
  champion: { tone: "indigo" },
  awaiting_approval: { tone: "amber" },
  trial: { tone: "green" },
  backtested: { tone: "plain" },
  archived: { tone: "plain" },
};

const VERDICT_TONE: Record<string, "green" | "amber" | "red"> = {
  helps: "green",
  mixed: "amber",
  "does not help": "red",
};

function Metric({ label, v, strong }: { label: string; v?: string | null; strong?: boolean }) {
  return (
    <div>
      <div className="font-mono text-micro uppercase tracking-[0.12em] text-ink2">{label}</div>
      <div
        className={`tabular-nums ${
          strong ? "font-mono text-display font-semibold text-ink" : "font-mono text-body"
        }`}
      >
        {v ?? "-"}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ evolution

export function EvolutionSection() {
  const [running, setRunning] = useState(false);
  const [deciding, setDeciding] = useState("");
  const [actErr, setActErr] = useState("");
  const [designing, setDesigning] = useState(false);
  const [shipyardMsg, setShipyardMsg] = useState("");

  const expQ = useApi<{ experiments: Experiment[] }>("/api/lab/experiments", 60000);
  const experiments = expQ.data?.experiments ?? [];
  const loaded = expQ.data !== undefined || expQ.error !== undefined;
  const err = expQ.error ? "API unreachable - shown results may be stale." : actErr;

  async function evolve() {
    setRunning(true);
    try {
      await apiPost("/api/lab/evolve", { family: "momentum_rotation", n_candidates: 3 });
      setActErr("");
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setActErr("Evolution round did not go through - API unreachable or refused.");
    } finally {
      setRunning(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    setDeciding(id);
    try {
      await apiPost(`/api/lab/experiments/${id}/decision`, { approve });
      setActErr("");
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setActErr("Decision did not go through - API unreachable or refused.");
    } finally {
      setDeciding("");
    }
  }

  async function designSpecs() {
    setDesigning(true);
    setShipyardMsg("");
    try {
      const r = await apiPost<{ ok?: boolean; skipped?: string; error?: string;
        proposer?: string; specs_tested?: number;
        promotion_candidate?: unknown }>("/api/lab/shipyard", { n: 3 });
      setShipyardMsg(
        r.skipped ?? r.error ??
        `${r.specs_tested} spec(s) walk-forward tested (${r.proposer}); ` +
        (r.promotion_candidate ? "one cleared the bar - see promotion candidates above." : "none cleared the deflated-Sharpe bar tonight."),
      );
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setShipyardMsg("Design round failed - API unreachable.");
    } finally {
      setDesigning(false);
    }
  }

  const pending = experiments.filter((e) => e.status === "awaiting_approval");
  // Awaiting-approval specs already sit in "Promotion candidates"; listing
  // them twice made them look like two different things.
  const designed = experiments
    .filter((e) => e.family === "dsl_rotation" && e.status !== "awaiting_approval")
    .slice(0, 8);
  const designedPending = pending.filter((e) => e.family === "dsl_rotation").length;

  return (
    <Section
      title="Evolution"
      info="Candidates come from Gemini (or a labeled grid fallback). Fitness is judged only on out-of-sample walk-forward results (last 30% of 4 years, never used for tuning), with costs, deflated by trials-in-family. In-sample numbers are context, never the judge. Nothing promotes itself. Designed specs use a restricted grammar (factor weights + trend filter + top-N + rebalance cadence), never generated code."
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={designSpecs} disabled={designing}>
            {designing ? "Designing + backtesting…" : "Design new strategies"}
          </Button>
          <Button onClick={evolve} disabled={running}>
            {running ? "Testing candidates on real data…" : "Run an evolution round"}
          </Button>
        </div>
      }
    >
      {err && (
        <div className="mb-3 border-l-2 border-amber bg-amber/5 px-4 py-2.5 text-body text-amber">
          {err}
        </div>
      )}
      {shipyardMsg && <p className="mb-3 font-mono text-micro text-ink2">{shipyardMsg}</p>}

      {pending.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {pending.map((e) => (
            <div key={e.id} className="panel-inset p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stamp tone="amber">promotion candidate</Stamp>
                <span className="font-mono text-micro text-ink2">{e.family.replace(/_/g, " ")}</span>
                <span className="font-mono text-micro text-ink2">from {e.parent_version}</span>
                {e.proposed_by === "gemini" && (
                  <span className="font-serif text-micro italic text-ink">Ai · gemini</span>
                )}
              </div>
              <p className="mt-2 text-body">{e.hypothesis}</p>
              <p className="mt-1 text-body text-ink2">{e.verdict_reason}</p>
              {e.backtest && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-body sm:grid-cols-5">
                  <Metric label="OOS Sharpe" v={e.backtest.oos_sharpe?.toFixed(2)} strong />
                  <Metric label="IS Sharpe" v={e.backtest.is_sharpe?.toFixed(2)} />
                  <Metric label="OOS return/yr" v={fmtPct(e.backtest.ann_return)} />
                  <Metric label="Max drawdown" v={fmtPct(e.backtest.max_dd)} />
                  <Metric label="Monthly win rate" v={fmtPct(e.backtest.win_rate, 0)} />
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button disabled={deciding !== ""} onClick={() => decide(e.id, true)}>
                  {deciding === e.id ? "Promoting…" : "Promote to champion"}
                </Button>
                <Button variant="ghost" disabled={deciding !== ""} onClick={() => decide(e.id, false)}>
                  Archive
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {designedPending > 0 && (
        <p className="mb-2 font-mono text-micro text-indigo">
          {designedPending} designed spec{designedPending > 1 ? "s" : ""} awaiting your call above.
        </p>
      )}
      {designed.length > 0 && (
        <ul className="mb-5 space-y-2">
          {designed.map((e) => (
            <li key={e.id} className="panel-inset px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Stamp tone={STATUS_STAMP[e.status]?.tone ?? "plain"}>{e.status.replace("_", " ")}</Stamp>
                {e.proposed_by === "gemini" && (
                  <span className="font-serif text-micro italic text-ink">Ai · gemini</span>
                )}
                <span className="font-mono text-micro tabular-nums text-ink2">
                  OOS Sharpe {e.backtest?.oos_sharpe?.toFixed(2) ?? "-"} · DD{" "}
                  {e.backtest?.max_dd != null ? fmtPct(e.backtest.max_dd) : "-"}
                </span>
              </div>
              <p className="mt-1.5 text-body leading-relaxed">{e.hypothesis}</p>
              <p className="mt-0.5 font-mono text-micro text-ink2">{e.verdict_reason}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-hairline pt-3">
        <div className="mb-2 font-mono text-micro uppercase tracking-[0.12em] text-ink2">
          Experiment lineage - failures included, that is the point
        </div>
        {!loaded && <Skeleton rows={5} />}
        {loaded && experiments.length === 0 && (
          <EmptyState
            title="No experiments yet"
            body="Run an evolution round - candidates are tested against real historical data, and only genuinely better ones reach your desk."
          />
        )}
        {experiments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Hypothesis</th>
                  <th className="pb-2 font-medium">Change</th>
                  <th className="pb-2 text-right font-medium">OOS Sharpe</th>
                  <th className="pb-2 text-right font-medium">Max DD</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e) => (
                  <tr key={e.id} className="border-b border-hairline/60 align-top">
                    <td className="py-2 whitespace-nowrap font-mono text-micro text-ink2">
                      {fmtTs(e.created_at)}
                    </td>
                    <td className="max-w-[260px] py-2 text-body leading-relaxed">{e.hypothesis}</td>
                    <td
                      className="py-2 font-mono text-micro text-ink2"
                      title={JSON.stringify(e.params_delta)}
                    >
                      {summarizeParams(e.params_delta)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {e.backtest?.oos_sharpe?.toFixed(2) ?? "-"}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtPct(e.backtest?.max_dd)}</td>
                    <td className="py-2">
                      <Stamp tone={STATUS_STAMP[e.status]?.tone ?? "plain"}>
                        {e.status.replace("_", " ")}
                      </Stamp>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

// -------------------------------------------------------------- mining

/** Centered mini bar: IC in [-0.2, 0.2] spans the half-width; sign colors it. */
function IcBar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-body text-ink2">-</span>;
  const half = Math.min(Math.abs(v) / 0.2, 1) * 50;
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-1.5 w-24 overflow-hidden bg-hairline/70">
        <span className="absolute left-1/2 top-0 h-full w-px bg-ink2/40" />
        <span
          className={`absolute top-0 h-full ${v >= 0 ? "bg-green" : "bg-red"}`}
          style={v >= 0 ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }}
        />
      </span>
      <span className={`font-mono text-body tabular-nums ${v >= 0 ? "text-green" : "text-red"}`}>
        {v >= 0 ? "+" : ""}
        {v.toFixed(3)}
      </span>
    </span>
  );
}

export function MiningSection() {
  const [miningBusy, setMiningBusy] = useState("");
  const [miningMsg, setMiningMsg] = useState("");

  const miningQ = useApi<MiningState>("/api/lab/mining", 60000);
  const factorsQ = useApi<{ factors: FactorDoc }>("/api/factors", 5 * 60000);
  const miningState = miningQ.data ?? null;
  const factors = factorsQ.data?.factors ?? null;
  const loaded =
    (miningQ.data !== undefined || miningQ.error !== undefined) &&
    (factorsQ.data !== undefined || factorsQ.error !== undefined);

  async function mineRound() {
    setMiningBusy("round");
    setMiningMsg("");
    try {
      const r = await apiPost<{ ok?: boolean; skipped?: string; error?: string; tried?: number;
        tried_total?: number; surfaced?: { name: string } | null }>("/api/lab/mine", {});
      setMiningMsg(
        r.skipped ?? r.error ??
        `${r.tried} expression(s) tried (${r.tried_total} lifetime - the deflation bar rises with every try); ` +
        (r.surfaced ? `[${r.surfaced.name}] survived and awaits your approval.` : "nothing beat the deflated-IC bar."),
      );
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setMiningMsg("Mining round failed - API unreachable.");
    } finally {
      setMiningBusy("");
    }
  }

  async function decideMining(id: string, approve: boolean) {
    setMiningBusy(id);
    try {
      await apiPost("/api/lab/mining/decide", { candidate_id: id, approve });
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setMiningMsg("Decision did not go through - API unreachable or refused.");
    } finally {
      setMiningBusy("");
    }
  }

  const pendingCandidates = (miningState?.mining?.pending ?? []).filter(
    (c) => c.status === "awaiting_approval",
  );

  return (
    <Section
      title="Factor mining"
      info="Factor radar: nightly cross-sectional rank-IC vs forward 5-day returns over the scout pool + core list, ~250-day window. Factor mine: restricted expression search over the SAME registry (2-3 factor blends, never invented code); deflated IC uses the expected max of all past tries, so the miner cannot fool itself by searching harder. Survivors wait for your approval; admitted factors are re-graded nightly and flagged when their edge decays."
      actions={
        <Button variant="ghost" onClick={mineRound} disabled={miningBusy !== ""}>
          {miningBusy === "round" ? "Searching + grading…" : "Mine expressions"}
        </Button>
      }
    >
      {miningMsg && <p className="mb-3 font-mono text-micro text-ink2">{miningMsg}</p>}

      {!loaded ? (
        <Skeleton rows={6} />
      ) : factorsQ.error || miningQ.error ? (
        <p className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 font-mono text-micro text-amber">
          Factor data unreachable - shown data may be stale.
        </p>
      ) : !factors || factors.rows.length === 0 ? (
        <EmptyState
          title={factors?.refused ? "Cross-section too thin" : "No factor scan yet"}
          body={factors?.refused ?? "The night job grades the factor registry daily once the scout pool has enough names."}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] max-w-3xl text-body">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  <th className="pb-2 font-medium">Factor</th>
                  <th className="pb-2 font-medium">Recent IC (60d)</th>
                  <th className="pb-2 text-right font-medium">Mean IC</th>
                  <th className="pb-2 text-right font-medium">t-stat</th>
                  <th className="pb-2 text-right font-medium">Days</th>
                </tr>
              </thead>
              <tbody>
                {factors.rows.map((r) => (
                  <tr key={r.factor} className="border-b border-hairline/60">
                    <td className="py-1.5 font-mono text-body">{r.factor}</td>
                    <td className="py-1.5">
                      <IcBar v={r.ic_recent} />
                    </td>
                    <td className="py-1.5 text-right font-mono text-body tabular-nums text-ink2">
                      {r.ic_mean != null ? r.ic_mean.toFixed(3) : "-"}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono text-body tabular-nums ${
                        r.t_stat != null && Math.abs(r.t_stat) >= 2 ? "font-semibold text-indigo" : "text-ink2"
                      }`}
                    >
                      {r.t_stat != null ? r.t_stat.toFixed(1) : "-"}
                    </td>
                    <td className="py-1.5 text-right font-mono text-body tabular-nums text-ink2">
                      {r.n_days}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 font-mono text-micro text-ink2">
            {factors.universe_size} names · {factors.window_days}d window · forward {factors.fwd_days}d
            returns · {fmtTs(factors.ts)}
          </p>
        </>
      )}

      {pendingCandidates.map((c) => (
        <div key={c.id} className="panel-inset mt-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp tone="amber">awaiting approval</Stamp>
            <span className="font-mono text-body">{c.name}</span>
          </div>
          <p className="mt-1 font-mono text-micro tabular-nums text-ink2">
            deflated IC {c.deflated_ic != null ? c.deflated_ic.toFixed(3) : "-"} · raw{" "}
            {c.ic_mean != null ? c.ic_mean.toFixed(3) : "-"} · {c.n_days}d of evidence
          </p>
          <div className="mt-2 flex gap-2">
            <Button disabled={miningBusy !== ""} onClick={() => decideMining(c.id, true)}>
              {miningBusy === c.id ? "Admitting…" : "Admit to library"}
            </Button>
            <Button variant="ghost" disabled={miningBusy !== ""} onClick={() => decideMining(c.id, false)}>
              Archive
            </Button>
          </div>
        </div>
      ))}

      {(miningState?.library?.factors ?? []).length > 0 ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="font-mono text-micro uppercase tracking-[0.12em] text-ink2">
            Library ({(miningState!.library!.factors ?? []).length}) · visible to the designer
          </div>
          <ul className="mt-1 space-y-1">
            {(miningState!.library!.factors ?? []).map((f) => {
              const last = f.ic_history[f.ic_history.length - 1];
              return (
                <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 text-body">
                  <span className="font-mono">{f.name}</span>
                  <span className="font-mono text-micro tabular-nums text-ink2">
                    admitted {f.admission_ic != null ? f.admission_ic.toFixed(3) : "-"} · now{" "}
                    {last?.ic_recent != null ? last.ic_recent.toFixed(3) : "-"}{" "}
                    {f.decayed && <Stamp tone="red">decayed</Stamp>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        loaded &&
        pendingCandidates.length === 0 && (
          <p className="mt-3 font-mono text-micro text-ink2">
            Library empty · {miningState?.mining?.tried_total ?? 0} expressions tried so far. The bar
            is deliberately hard: a candidate must beat the expected best of ALL past tries by pure luck.
          </p>
        )
      )}
    </Section>
  );
}

// ------------------------------------------------------- weather validation

export function ValidationSection() {
  const [wxBusy, setWxBusy] = useState(false);
  const [err, setErr] = useState("");
  // The backend caches the validation per day; fetching on mount means the
  // page remembers a study that was already run instead of playing dumb.
  const wxQ = useApi<WeatherValidation>("/api/lab/weather-validation");
  const wx = wxQ.data ?? (wxQ.error ? { ok: false, error: "validation failed - is the API running?" } : null);
  const wxLoading = wxQ.isLoading || wxBusy;

  async function rerun(force: boolean) {
    setWxBusy(true);
    try {
      await apiGet<WeatherValidation>(`/api/lab/weather-validation${force ? "?force=true" : ""}`);
      await refreshAll();
    } catch {
      setErr("Validation run failed - API unreachable.");
    } finally {
      setWxBusy(false);
    }
  }

  return (
    <Section
      title="Weather floor validation"
      info="Does pausing new trades in stormy weather actually help? Walk-forward study: choose the weather floor on the first 70% of 4 years of momentum returns, judge it on the last 30%. Vol-only proxy, honestly labeled; negative results are shown, not hidden. Cached per day."
      actions={
        <Button variant="ghost" disabled={wxLoading} onClick={() => rerun(wx != null)}>
          {wxLoading ? "Backtesting 4 years…" : wx ? "Re-run" : "Run validation"}
        </Button>
      }
    >
      {err && <p className="mb-2 font-mono text-micro text-red">{err}</p>}
      {wxLoading && !wx ? <Skeleton rows={3} /> : null}
      {wx && !wx.ok && <EmptyState title={wx.error ?? "validation failed"} />}
      {wx?.ok && wx.oos && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp tone={VERDICT_TONE[wx.oos.verdict] ?? "plain"}>out-of-sample: {wx.oos.verdict}</Stamp>
            <Stamp tone="plain">chosen floor {wx.oos.floor}</Stamp>
            <Stamp tone="plain">{wx.oos.storm_days} storm days in OOS</Stamp>
            {wx.cached && <Stamp tone="plain">cached today</Stamp>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-body sm:grid-cols-4">
            <Metric label="OOS Sharpe (no gate)" v={wx.oos.baseline.sharpe?.toFixed(2)} />
            <Metric label="OOS Sharpe (gated)" v={wx.oos.gated.sharpe?.toFixed(2)} strong />
            <Metric label="Max DD (no gate)" v={fmtPct(wx.oos.baseline.max_dd)} />
            <Metric label="Max DD (gated)" v={fmtPct(wx.oos.gated.max_dd)} />
          </div>
          <p className="text-body leading-relaxed text-ink2">{wx.proxy_note}</p>
          {wx.window && (
            <p className="font-mono text-micro text-ink2">
              {wx.window.start} to {wx.window.end} - {wx.window.is_days} in-sample days,{" "}
              {wx.window.oos_days} out-of-sample days.
            </p>
          )}
        </div>
      )}
      {!wx && !wxLoading && (
        <EmptyState
          title="Not run yet"
          body="Runs a walk-forward study of the market-weather floor against 4 years of momentum returns. Cached per day once computed."
        />
      )}
    </Section>
  );
}

// ---------------------------------------------------------- crew performance

export function CrewStatsSection() {
  const compass = useApi<{ compass: CompassDoc | null }>("/api/compass", 5 * 60000).data?.compass ?? null;
  if (!compass) return null;
  const rows = Object.entries(compass.families)
    .map(([fam, buckets]) => ({ fam, stats: buckets[compass.regime.label] }))
    .filter((r) => r.stats);
  if (rows.length === 0) return null;

  return (
    <Section
      title="Family performance in this regime"
      hint={compass.regime.label.replace(/_/g, " ")}
      info="Walk-forward returns per strategy family inside the CURRENT regime only - refused under 120 days of evidence. The full matrix lives in the API."
    >
      <table className="w-full max-w-3xl text-body">
        <tbody>
          {rows.map(({ fam, stats }) => (
            <tr key={fam} className="border-b border-hairline/60">
              <td className="py-1.5 text-ink/85">{fam.replace(/_/g, " ")}</td>
              <td className="py-1.5 text-right font-mono text-body tabular-nums text-ink2">
                {stats!.refused ? (
                  <span className="font-mono text-micro text-ink2">not enough history</span>
                ) : (
                  <>
                    Sharpe{" "}
                    <span className={stats!.sharpe != null && stats!.sharpe >= 0 ? "text-green" : "text-red"}>
                      {stats!.sharpe?.toFixed(2) ?? "—"}
                    </span>
                    {stats!.win_rate != null && <> · win {(stats!.win_rate * 100).toFixed(0)}%</>}
                    {stats!.n_days != null && <> · {stats!.n_days}d</>}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
