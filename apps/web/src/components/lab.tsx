"use client";

/** Research workbench - Evolution and Mining tabs. The honest pipeline:
 *  propose -> walk-forward backtest -> deflated scoring -> a human decides.
 *  Grok-prototype visual language, real API data. */

import { useState } from "react";
import { apiGet, apiPost, fmtPct, fmtTs, summarizeParams } from "@/lib/api";
import { refreshAll, useApi } from "@/lib/data";
import { Badge, Button, EmptyState, Panel, Skeleton, Stat } from "@/components/ui";
import type { Experiment, FactorDoc, MiningState, WeatherValidation } from "@/lib/types";

const STATUS_TONE: Record<string, "gold" | "teal" | "coral" | "amber" | "signal" | "mist"> = {
  promoted: "gold",
  champion: "gold",
  awaiting_approval: "amber",
  trial: "signal",
  backtested: "mist",
  archived: "mist",
};

const VERDICT_TONE: Record<string, "teal" | "amber" | "coral"> = {
  helps: "teal",
  mixed: "amber",
  "does not help": "coral",
};

// ------------------------------------------------------------ evolution tab

export function EvolutionTab() {
  const [running, setRunning] = useState(false);
  const [deciding, setDeciding] = useState("");
  const [actErr, setActErr] = useState("");
  const [wxBusy, setWxBusy] = useState(false);
  const [designing, setDesigning] = useState(false);
  const [shipyardMsg, setShipyardMsg] = useState("");

  const expQ = useApi<{ experiments: Experiment[] }>("/api/lab/experiments", 60000);
  const experiments = expQ.data?.experiments ?? [];
  // The backend caches the validation per day; fetching on mount means the
  // tab remembers a study that was already run instead of playing dumb.
  const wxQ = useApi<WeatherValidation>("/api/lab/weather-validation");
  const wx = wxQ.data ?? (wxQ.error ? { ok: false, error: "validation failed - is the API running?" } : null);
  const wxLoading = wxQ.isLoading || wxBusy;
  const loaded = expQ.data !== undefined || expQ.error !== undefined;
  const err = expQ.error ? "Experiments unreachable - shown results may be stale." : actErr;

  async function rerunWeatherValidation(force: boolean) {
    setWxBusy(true);
    try {
      await apiGet<WeatherValidation>(`/api/lab/weather-validation${force ? "?force=true" : ""}`);
      await refreshAll();
    } catch {
      setActErr("Validation run failed - can't reach the trading service.");
    } finally {
      setWxBusy(false);
    }
  }

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
      setShipyardMsg("Design round failed - can't reach the trading service.");
    } finally {
      setDesigning(false);
    }
  }

  const pending = experiments.filter((e) => e.status === "awaiting_approval");
  // Awaiting-approval specs already sit in the candidate cards; listing them
  // twice made them look like two different things.
  const designed = experiments
    .filter((e) => e.family === "dsl_rotation" && e.status !== "awaiting_approval")
    .slice(0, 8);
  const designedPending = pending.filter((e) => e.family === "dsl_rotation").length;

  return (
    <div className="flex flex-col gap-3">
      {err && (
        <div className="rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber">
          {err}
        </div>
      )}

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="max-w-xl text-sm text-mist">
          Propose → walk-forward backtest → deflated scoring → your approval. Fitness is judged
          only on out-of-sample results; nothing promotes itself.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={designSpecs} disabled={designing}>
            {designing ? "Designing + backtesting…" : "Design new strategies"}
          </Button>
          <Button variant="gold" onClick={evolve} disabled={running}>
            {running ? "Testing candidates on real data…" : "Run an evolution round"}
          </Button>
        </div>
      </Panel>
      {shipyardMsg && <p className="font-mono text-micro text-mist">{shipyardMsg}</p>}

      {pending.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {pending.map((e) => (
            <article key={e.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-ink">{e.family.replace(/_/g, " ")}</div>
                <Badge tone="amber">your call</Badge>
              </div>
              <p className="mt-2 text-xs text-mist">{e.hypothesis}</p>
              {e.backtest && (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Stat k="OOS Sharpe" v={e.backtest.oos_sharpe?.toFixed(2) ?? "-"} />
                  <Stat k="max DD" v={fmtPct(e.backtest.max_dd)} />
                  <Stat k="win/mo" v={fmtPct(e.backtest.win_rate, 0)} />
                </dl>
              )}
              <p className="mt-2 text-2xs text-mist">{e.verdict_reason}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="gold" disabled={deciding !== ""} onClick={() => decide(e.id, true)}>
                  {deciding === e.id ? "Promoting…" : "Promote"}
                </Button>
                <Button size="sm" variant="ghost" disabled={deciding !== ""} onClick={() => decide(e.id, false)}>
                  Archive
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="kicker">Weather-floor validation</span>
          <Button variant="ghost" size="sm" disabled={wxLoading} onClick={() => rerunWeatherValidation(wx != null)}>
            {wxLoading ? "Backtesting 4 years…" : wx ? "Re-run" : "Run validation"}
          </Button>
        </div>
        {wxLoading && !wx ? <Skeleton rows={3} className="mt-3" /> : null}
        {wx && !wx.ok && <EmptyState title={wx.error ?? "validation failed"} />}
        {wx?.ok && wx.oos && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={VERDICT_TONE[wx.oos.verdict] ?? "mist"}>out-of-sample: {wx.oos.verdict}</Badge>
              <Badge>floor {wx.oos.floor}</Badge>
              <Badge>{wx.oos.storm_days} storm days OOS</Badge>
              {wx.cached && <Badge>cached today</Badge>}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k="OOS Sharpe (no gate)" v={wx.oos.baseline.sharpe?.toFixed(2) ?? "-"} />
              <Stat k="OOS Sharpe (gated)" v={wx.oos.gated.sharpe?.toFixed(2) ?? "-"} tone="text-gold" />
              <Stat k="Max DD (no gate)" v={fmtPct(wx.oos.baseline.max_dd)} />
              <Stat k="Max DD (gated)" v={fmtPct(wx.oos.gated.max_dd)} />
            </dl>
            <p className="text-xs leading-relaxed text-mist">{wx.proxy_note}</p>
            {wx.window && (
              <p className="font-mono text-micro text-mist">
                {wx.window.start} to {wx.window.end} · {wx.window.is_days} in-sample days,{" "}
                {wx.window.oos_days} out-of-sample days
              </p>
            )}
          </div>
        )}
        {!wx && !wxLoading && (
          <EmptyState
            title="Not run yet"
            body="Walk-forward study of the market-weather floor against 4 years of momentum returns. Cached per day once computed."
          />
        )}
      </Panel>

      <Panel className="p-4">
        <div className="kicker">Strategy design · DSL specs</div>
        {designedPending > 0 && (
          <p className="mt-2 font-mono text-micro text-gold">
            {designedPending} designed spec{designedPending > 1 ? "s" : ""} awaiting your call above.
          </p>
        )}
        {!loaded ? (
          <Skeleton rows={3} className="mt-3" />
        ) : designed.length === 0 && designedPending === 0 ? (
          <EmptyState
            title="No specs designed yet"
            body="Each round proposes ~3 rotation specs from the factor registry and walk-forward tests them on 4 years of real bars."
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {designed.map((e) => (
              <li key={e.id} className="rounded-lg bg-panel px-3 py-2.5 shadow-border">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[e.status] ?? "mist"}>{e.status.replace("_", " ")}</Badge>
                  {e.proposed_by === "gemini" && <Badge tone="gold">AI</Badge>}
                  <span className="num text-micro text-mist">
                    OOS Sharpe {e.backtest?.oos_sharpe?.toFixed(2) ?? "-"} · DD{" "}
                    {e.backtest?.max_dd != null ? fmtPct(e.backtest.max_dd) : "-"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink">{e.hypothesis}</p>
                <p className="mt-0.5 font-mono text-micro text-mist">{e.verdict_reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="overflow-x-auto p-4">
        <div className="kicker">Experiment lineage - including failures</div>
        {!loaded && <Skeleton rows={5} className="mt-3" />}
        {loaded && experiments.length === 0 && (
          <EmptyState
            title="No experiments yet"
            body="Run an evolution round - candidates are tested against real historical data, and only genuinely better ones reach your desk."
          />
        )}
        {experiments.length > 0 && (
          <table className="mt-3 w-full min-w-lg text-left text-sm">
            <thead className="text-xs text-mist">
              <tr className="border-b border-line">
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
                <tr key={e.id} className="border-b border-line/60 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-2xs text-mist">
                    {fmtTs(e.created_at)}
                  </td>
                  <td className="max-w-[280px] py-2 pr-3 text-xs leading-relaxed">{e.hypothesis}</td>
                  <td className="py-2 pr-3 font-mono text-2xs text-mist" title={JSON.stringify(e.params_delta)}>
                    {summarizeParams(e.params_delta)}
                  </td>
                  <td className="num py-2 pr-3 text-right">{e.backtest?.oos_sharpe?.toFixed(2) ?? "-"}</td>
                  <td className="num py-2 pr-3 text-right">{fmtPct(e.backtest?.max_dd)}</td>
                  <td className="py-2">
                    <Badge tone={STATUS_TONE[e.status] ?? "mist"}>{e.status.replace("_", " ")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------- mining tab

/** Centered mini bar: IC in [-0.2, 0.2] spans the half-width; sign colors it. */
function IcBar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-sm text-mist">-</span>;
  const half = Math.min(Math.abs(v) / 0.2, 1) * 50;
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-panel">
        <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
        <span
          className={`absolute top-0 h-full ${v >= 0 ? "bg-teal" : "bg-coral"}`}
          style={v >= 0 ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }}
        />
      </span>
      <span className={`num text-xs ${v >= 0 ? "text-teal" : "text-coral"}`}>
        {v >= 0 ? "+" : ""}
        {v.toFixed(3)}
      </span>
    </span>
  );
}

export function MiningTab() {
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
      setMiningMsg("Mining round failed - can't reach the trading service.");
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
    <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="kicker">Factor IC · screening known factors</span>
          <Button variant="ghost" size="sm" onClick={mineRound} disabled={miningBusy !== ""}>
            {miningBusy === "round" ? "Searching + grading…" : "Mine expressions"}
          </Button>
        </div>
        {miningMsg && <p className="mt-2 font-mono text-micro text-mist">{miningMsg}</p>}
        {!loaded ? (
          <Skeleton rows={6} className="mt-3" />
        ) : factorsQ.error || miningQ.error ? (
          <p className="mt-3 rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber">
            Factor data unreachable - shown data may be stale.
          </p>
        ) : !factors || factors.rows.length === 0 ? (
          <EmptyState
            title={factors?.refused ? "Cross-section too thin" : "No factor scan yet"}
            body={factors?.refused ?? "The night job grades the factor registry daily once the scout pool has enough names."}
          />
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-md text-left text-sm">
                <thead className="text-xs text-mist">
                  <tr className="border-b border-line">
                    <th className="pb-2 font-medium">Factor</th>
                    <th className="pb-2 font-medium">Recent IC (60d)</th>
                    <th className="pb-2 text-right font-medium">Mean IC</th>
                    <th className="pb-2 text-right font-medium">t-stat</th>
                    <th className="pb-2 text-right font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {factors.rows.map((r) => (
                    <tr key={r.factor} className="border-b border-line/60">
                      <td className="py-1.5 pr-2 font-mono text-xs">{r.factor}</td>
                      <td className="py-1.5 pr-2">
                        <IcBar v={r.ic_recent} />
                      </td>
                      <td className="num py-1.5 pr-2 text-right text-mist">
                        {r.ic_mean != null ? r.ic_mean.toFixed(3) : "-"}
                      </td>
                      <td
                        className={`num py-1.5 pr-2 text-right ${
                          r.t_stat != null && Math.abs(r.t_stat) >= 2 ? "text-gold" : "text-mist"
                        }`}
                      >
                        {r.t_stat != null ? r.t_stat.toFixed(1) : "-"}
                      </td>
                      <td className="num py-1.5 text-right text-mist">{r.n_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-micro text-mist">
              {factors.universe_size} names · {factors.window_days}d window · forward {factors.fwd_days}d
              returns · {fmtTs(factors.ts)}
            </p>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-3">
        {pendingCandidates.map((c) => (
          <article key={c.id} className="rounded-xl bg-night p-4 shadow-tone-amber">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm font-medium text-ink">{c.name}</div>
              <Badge tone="amber">your call</Badge>
            </div>
            <p className="mt-2 text-xs text-mist">
              Raw IC {c.ic_mean != null ? c.ic_mean.toFixed(3) : "-"} looks pretty. Deflated IC{" "}
              {c.deflated_ic != null ? c.deflated_ic.toFixed(3) : "-"} is the number that matters.
              Multiple-testing tax applied · {c.n_days}d of evidence.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="teal" disabled={miningBusy !== ""} onClick={() => decideMining(c.id, true)}>
                {miningBusy === c.id ? "Admitting…" : "Admit"}
              </Button>
              <Button size="sm" variant="ghost" disabled={miningBusy !== ""} onClick={() => decideMining(c.id, false)}>
                Dismiss
              </Button>
            </div>
          </article>
        ))}
        <Panel className="p-4">
          <div className="kicker">Admitted library</div>
          {(miningState?.library?.factors ?? []).length > 0 ? (
            <ul className="mt-3 space-y-2">
              {(miningState!.library!.factors ?? []).map((f) => {
                const last = f.ic_history[f.ic_history.length - 1];
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-mono text-xs">{f.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="num text-2xs text-mist">
                        {f.admission_ic != null ? f.admission_ic.toFixed(3) : "-"} →{" "}
                        {last?.ic_recent != null ? last.ic_recent.toFixed(3) : "-"}
                      </span>
                      <Badge tone={f.decayed ? "coral" : "teal"}>{f.decayed ? "decayed" : "fresh"}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-mist">
              {loaded
                ? `Empty. ${miningState?.mining?.tried_total ?? 0} expressions tried so far - the bar is deliberately hard.`
                : ""}
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
