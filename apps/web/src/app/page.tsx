"use client";

/** Track - the daily screen. Answers one question: "am I going to get there,
 *  and how do I know". Hero = plan-vs-reality trajectory; then what needs a
 *  human, today's brief, and what the account holds. */

import { useState } from "react";
import Link from "next/link";
import { apiPost, fmtPct, fmtTs, fmtUsd, humanSymbol } from "@/lib/api";
import { useApi } from "@/lib/data";
import {
  Button,
  EmptyState,
  FieldNote,
  Section,
  Skeleton,
  Stamp,
} from "@/components/ui";
import { ProbStrip, TrajectoryHero } from "@/components/trajectory";
import type {
  AdvisorState,
  Approval,
  BandsDoc,
  Brief,
  CompassDoc,
  EngineState,
  JEvent,
  OpenOrder,
  Position,
} from "@/lib/types";

const FEASIBILITY_TEXT: Record<string, string> = {
  green: "realistic destination",
  yellow: "stretch goal - doable, not likely",
  red: "honestly unrealistic on this setup",
};

export default function Track() {
  const [closeArm, setCloseArm] = useState("");
  const [closeMsg, setCloseMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [actErr, setActErr] = useState("");

  const stateQ = useApi<EngineState>("/api/engine/state", 20000);
  const state = stateQ.data ?? null;
  const bands = useApi<BandsDoc>("/api/goal/bands", 60000).data ?? null;
  const equityCurve =
    useApi<{ points: { t: string; equity: number }[] }>("/api/equity-history", 5 * 60000).data
      ?.points ?? [];
  const approvalsQ = useApi<{ pending: Approval[] }>("/api/approvals", 20000);
  const approvals = approvalsQ.data?.pending ?? [];
  const posQ = useApi<{ positions: Position[]; open_orders: OpenOrder[] }>("/api/positions", 20000);
  const positions = posQ.data?.positions ?? [];
  const openOrders = posQ.data?.open_orders ?? [];
  const advisor = useApi<{ compass: CompassDoc | null; advisor: AdvisorState }>(
    "/api/compass",
    5 * 60000,
  ).data?.advisor ?? null;
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

  // A failed query must never masquerade as an empty account.
  const err = stateQ.error
    ? "Can't reach the trading service - shown data may be stale."
    : posQ.error || approvalsQ.error
      ? "Some account data is unreachable - shown data may be stale."
      : actErr;

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

  async function closePosition(symbol: string) {
    setBusy(`close:${symbol}`);
    setCloseMsg("");
    try {
      const r = await apiPost<{ ok: boolean; outcome?: string; human?: string; error?: string }>(
        "/api/positions/close",
        { symbol },
      );
      setCloseMsg(
        r.error
          ? r.error
          : r.outcome === "rejected"
            ? `Gate refused the close: ${r.human ?? symbol}`
            : `${r.outcome === "needs_human" ? "Close queued for your approval" : "Close order placed"}: ${r.human ?? symbol}`,
      );
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setCloseMsg(`Close failed for ${symbol} - API unreachable.`);
    } finally {
      setCloseArm("");
      setBusy("");
      setTimeout(() => setCloseMsg(""), 10000);
    }
  }

  if (!state) {
    return (
      <div className="space-y-6">
        {err ? <EmptyState title={err} /> : <Skeleton rows={6} />}
      </div>
    );
  }

  const goal = state.goal;
  const plan = state.plan;
  const equity = state.account.equity;
  const target = goal?.target_amount ?? bands?.target_amount ?? null;
  const base = goal?.capital_base ?? bands?.base ?? null;

  const soft = plan?.guardrails?.breaker_soft_dd ?? -0.08;
  const hard = plan?.guardrails?.breaker_hard_dd ?? -0.12;
  const dd = state.drawdown_from_peak;
  const breaker = dd <= hard ? "hard" : dd <= soft ? "soft" : null;

  const advice = advisor?.proposal?.status === "pending" ? advisor.proposal : null;
  const pastAdvice = !advice
    ? (advisor?.history ?? []).filter((h) => h && h.status && h.status !== "pending").at(-1) ?? null
    : null;
  const needsYou = approvals.length > 0 || !!advice;

  return (
    <div className="space-y-10">
      <h1 className="sr-only">Track - plan progress and account state</h1>
      {err && (
        <div className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 text-body text-amber">
          {err}
        </div>
      )}
      {state.kill_switch && (
        <div className="border-l-2 border-red bg-red/5 px-4 py-3 text-body text-red">
          Kill switch is ON - no new trades will be placed until you turn it off. Controls live
          under <Link href="/activity" className="underline">Activity</Link>.
        </div>
      )}
      {breaker && !state.kill_switch && (
        <div
          className={`border-l-2 px-4 py-3 text-body ${
            breaker === "hard" ? "border-red bg-red/5 text-red" : "border-amber bg-amber/5 text-amber"
          }`}
        >
          {breaker === "hard"
            ? `Hard circuit breaker: ${fmtPct(dd)} from peak. Trading is stopped.`
            : `Soft circuit breaker: ${fmtPct(dd)} from peak. New trades wait for your approval.`}
        </div>
      )}

      {/* ---------------------------------------------------------- hero */}
      <section className="grid gap-8 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
        <div>
          <div className="font-mono text-micro uppercase tracking-[0.14em] text-ink2">
            Portfolio equity · paper account
          </div>
          <div className="mt-2 font-mono text-hero font-semibold tabular-nums tracking-tight">
            {fmtUsd(equity)}
          </div>
          <div
            className={`mt-1 font-mono text-section tabular-nums ${
              state.day_pnl_pct >= 0 ? "text-green" : "text-red"
            }`}
          >
            {state.day_pnl_pct >= 0 ? "+" : ""}
            {fmtPct(state.day_pnl_pct, 2)} today
          </div>
          {plan && bands?.bands?.p50?.length && base != null && (
            <div className="mt-5">
              <ProbStrip
                bands={bands.bands}
                base={base}
                target={target}
                probability={plan.probability}
              />
            </div>
          )}
          {plan && !bands?.bands?.p50?.length && (
            <p className="mt-4 font-mono text-micro text-ink2">
              {Math.round(plan.probability * 100)}% odds of arrival · Monte Carlo ·{" "}
              {FEASIBILITY_TEXT[plan.feasibility] ?? plan.feasibility.replace(/_/g, " ")} · estimate,
              not a promise
            </p>
          )}
        </div>
        <div>
          {goal ? (
            <TrajectoryHero
              bands={bands?.bands?.p50?.length ? bands.bands : null}
              months={bands?.months ?? goal.horizon_months ?? 12}
              target={target}
              base={base ?? undefined}
              start={bands?.start}
              equity={equityCurve}
            />
          ) : (
            <div className="border border-hairline px-6 py-8">
              <h2 className="text-page font-semibold">Set your North Star</h2>
              <p className="mt-1 max-w-xl text-body text-ink2">
                Tell us the destination - &quot;grow $100k to $110k in a year&quot; - and we&apos;ll
                show you honest odds before a single simulated dollar moves.
              </p>
              <div className="mt-4">
                <Link href="/start">
                  <Button>Plan it</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ needs you */}
      {needsYou && (
        <Section
          title="Needs you"
          id="needs-you"
          hint={`${approvals.length + (advice ? 1 : 0)} pending`}
          info="Nothing unusual happens without your tap. Silence is an automatic no after the timeout."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {approvals.map((a) => (
              <div key={a.id} className="border border-hairline bg-raised p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stamp tone="amber">needs you</Stamp>
                  <span className="font-mono text-micro text-ink2">{fmtTs(a.created_at)}</span>
                </div>
                <div className="mt-2.5 text-body">{a.order_plan.human}</div>
                <div className="mt-1 text-body text-ink2">
                  Why it paused:{" "}
                  {a.verdict.reason_codes.map((c) => c.replace(/_/g, " ")).join(", ")} · worst case{" "}
                  {fmtUsd(a.order_plan.est_max_loss)}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    disabled={busy !== ""}
                    onClick={() => act("approve", () => apiPost(`/api/approvals/${a.id}`, { approve: true }))}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={() => act("reject", () => apiPost(`/api/approvals/${a.id}`, { approve: false }))}
                  >
                    Skip this one
                  </Button>
                </div>
              </div>
            ))}
            {advice && (
              <div className="border border-hairline bg-raised p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stamp tone="amber">needs you</Stamp>
                  <span className="font-mono text-micro text-ink2">{fmtTs(advice.ts)}</span>
                </div>
                <div className="mt-2.5 text-body">
                  Plan advice: tilt toward{" "}
                  <span className="font-medium">{advice.best_family.replace(/_/g, " ")}</span>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-micro leading-snug text-ink2">
                  {advice.evidence.map((line, i) => (
                    <li key={i}>· {line}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(advice.tilts).map(([fam, d]) => (
                    <span
                      key={fam}
                      className={`border px-1.5 py-px font-mono text-micro tabular-nums ${
                        d >= 0 ? "border-green/50 text-green" : "border-red/50 text-red"
                      }`}
                    >
                      {fam.replace(/_/g, " ")} {d >= 0 ? "+" : ""}
                      {(d * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    disabled={busy !== ""}
                    onClick={() => act("advice", () => apiPost("/api/advisor/decide", { adopt: true }))}
                  >
                    {busy === "advice" ? "Applying…" : "Adopt tilt"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={() => act("advice", () => apiPost("/api/advisor/decide", { adopt: false }))}
                  >
                    Dismiss
                  </Button>
                </div>
                <p className="mt-2 text-micro leading-relaxed text-ink2">
                  Bounded plan-weight tilt, reversible; dismissed advice is still scored so the
                  record stays honest.
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ---------------------------------------------------------- today */}
      <Section
        title="Today"
        hint={brief ? fmtTs(brief.ts) : undefined}
        info="Filed nightly: what the system did, who earned their keep, what it watches tomorrow. Every number is a journaled fact; when the AI narrates them, the narrator is labeled."
      >
        {!brief ? (
          <EmptyState
            title="No brief yet"
            body="After each trading day the night job files an honest recap here."
          />
        ) : (
          <div>
            {brief.log.narrator === "gemini" ? (
              <FieldNote by="gemini" ts={fmtTs(brief.ts)}>
                {brief.log.narrative}
              </FieldNote>
            ) : (
              <p className="border-l-2 border-hairline pl-4 text-body leading-relaxed text-ink/90">
                {brief.log.narrative}
              </p>
            )}
            {(Object.keys(brief.log.realized_by_family).length > 0 || brief.log.gate_rejections > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(brief.log.realized_by_family).map(([fam, v]) => (
                  <span
                    key={fam}
                    className={`border px-1.5 py-px font-mono text-micro tabular-nums ${
                      v >= 0 ? "border-green/50 text-green" : "border-red/50 text-red"
                    }`}
                  >
                    {fam.replace(/_/g, " ")} {v >= 0 ? "+" : ""}
                    {v.toFixed(0)}
                  </span>
                ))}
                {brief.log.gate_rejections > 0 && (
                  <Stamp tone="red">gate said no ×{brief.log.gate_rejections}</Stamp>
                )}
              </div>
            )}
            {brief.log.watch_tomorrow.length > 0 && (
              <p className="mt-2 font-mono text-micro text-ink2">
                watching {brief.log.watch_tomorrow.join(", ")} tomorrow
              </p>
            )}
          </div>
        )}
        {pastAdvice && (
          <p className="mt-3 border-t border-hairline pt-2 font-mono text-micro text-ink2">
            Last plan advice: tilt toward {pastAdvice.best_family.replace(/_/g, " ")} ·{" "}
            {pastAdvice.status}
            {pastAdvice.ts ? ` · ${fmtTs(pastAdvice.ts)}` : ""}
          </p>
        )}
      </Section>

      {/* ------------------------------------------------------ positions */}
      <Section
        title="Positions"
        hint={state.clock.is_open ? "market open" : "market closed - orders queue"}
        info="What the account holds, and what is queued for the next open. Close steps out of one position at a market-ish limit; option legs close as their whole structure, and the closing order still passes the risk gate like any other."
      >
        {positions.length === 0 && openOrders.length === 0 ? (
          posQ.error ? (
            <p className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 font-mono text-micro text-amber">
              Positions unreachable - the account may not be empty. Data may be stale.
            </p>
          ) : (
            <EmptyState
              title="Nothing held yet"
              body="Run a pass from Activity - proposals that clear the gate turn into queued orders, then fills."
            />
          )
        ) : (
          <>
            {positions.length > 0 && (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-body">
                <thead>
                  <tr className="border-b border-hairline text-left font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                    <th className="pb-2 text-right font-medium">P&amp;L</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-hairline/60">
                      <td className="py-2 font-mono text-body" title={p.symbol}>
                        {humanSymbol(p.symbol)}
                      </td>
                      <td className="py-2 tabular-nums">{p.qty}</td>
                      <td className="py-2 text-right tabular-nums">{fmtUsd(p.market_value)}</td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          p.unrealized_pl >= 0 ? "text-green" : "text-red"
                        }`}
                      >
                        {p.unrealized_pl >= 0 ? "+" : ""}
                        {fmtUsd(p.unrealized_pl)}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        {closeArm === p.symbol ? (
                          <span className="inline-flex gap-1">
                            <button
                              onClick={() => closePosition(p.symbol)}
                              disabled={busy === `close:${p.symbol}`}
                              className="border border-red bg-red/5 px-2 py-0.5 font-mono text-micro font-medium text-red transition-colors hover:bg-red/10 disabled:opacity-50"
                            >
                              {busy === `close:${p.symbol}` ? "Closing…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setCloseArm("")}
                              className="border border-hairline px-2 py-0.5 font-mono text-micro text-ink2 hover:text-ink"
                            >
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setCloseArm(p.symbol)}
                            disabled={!!busy}
                            className="border border-hairline px-2 py-0.5 font-mono text-micro text-ink2 transition-colors hover:border-red/60 hover:text-red disabled:opacity-40"
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {openOrders.length > 0 && (
              <div className={positions.length > 0 ? "mt-3 border-t border-hairline pt-3" : ""}>
                <div className="mb-1.5 flex items-center gap-2 font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  Queued orders
                  <Stamp tone="amber">{state.clock.is_open ? "working" : "waits for open"}</Stamp>
                </div>
                <ul className="space-y-1">
                  {openOrders.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-baseline justify-between gap-3 text-body tabular-nums"
                    >
                      <span className="min-w-0 truncate font-mono" title={o.symbol}>
                        <span className={o.side === "buy" ? "text-green" : "text-red"}>
                          {o.side === "buy" ? "+ buy" : "- sell"}
                        </span>{" "}
                        {o.qty != null ? `${Math.round(o.qty)} × ` : ""}
                        {humanSymbol(o.symbol)}
                      </span>
                      <span className="shrink-0 font-mono text-ink2">
                        {o.limit_price != null ? `lim ${fmtUsd(o.limit_price, 2)}` : o.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {closeMsg && <p className="mt-2 font-mono text-micro text-ink2">{closeMsg}</p>}
          </>
        )}
      </Section>
    </div>
  );
}
