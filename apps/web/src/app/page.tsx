"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, fmtPct, fmtUsd } from "@/lib/api";
import { Button, Card, Chip, EmptyState, SectionTitle, Stat } from "@/components/ui";

type EngineState = {
  clock: { is_open: boolean; next_open: string };
  account: { equity: number; last_equity: number; cash: number; options_level: number };
  peak_equity: number;
  drawdown_from_peak: number;
  day_pnl_pct: number;
  kill_switch: boolean;
  plan: {
    id: string;
    probability: number;
    feasibility: string;
    guardrails: Record<string, number>;
    status: string;
  } | null;
  goal: {
    capital_base: number;
    target_amount: number | null;
    horizon_months: number | null;
    monthly_target: number | null;
    mode: string;
    risk_level: string;
  } | null;
};

type Approval = {
  id: string;
  created_at: string;
  status: string;
  order_plan: { human: string; est_max_loss: number };
  proposal: { thesis_human: string; underlying: string };
  verdict: { reason_codes: string[] };
};

type JEvent = {
  id: string;
  ts: string;
  kind: string;
  human: string;
  payload: Record<string, unknown>;
};

type Position = {
  symbol: string;
  qty: number;
  asset_class: string;
  market_value: number;
  unrealized_pl: number;
};

const KIND_TONES: Record<string, "gold" | "teal" | "coral" | "blue" | "amber" | "line"> = {
  fill: "teal",
  order: "blue",
  verdict: "amber",
  proposal: "line",
  digest: "gold",
  approval: "coral",
  system: "line",
};

export default function Cockpit() {
  const [state, setState] = useState<EngineState | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [feed, setFeed] = useState<JEvent[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [autopilot, setAutopilot] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [s, a, j, p, l] = await Promise.all([
        apiGet<EngineState>("/api/engine/state"),
        apiGet<{ pending: Approval[] }>("/api/approvals"),
        apiGet<{ events: JEvent[] }>("/api/journal?limit=12"),
        apiGet<{ positions: Position[] }>("/api/positions"),
        apiGet<{ autopilot: boolean }>("/api/loop/status"),
      ]);
      setState(s);
      setApprovals(a.pending);
      setFeed(j.events);
      setPositions(p.positions);
      setAutopilot(l.autopilot);
      setErr("");
    } catch {
      setErr("API unreachable - start it with scripts/dev.ps1");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy("");
    }
  }

  if (!state)
    return (
      <div className="grid gap-4">
        {err ? <EmptyState title={err} /> : <EmptyState title="Loading the cockpit…" />}
      </div>
    );

  const goal = state.goal;
  const plan = state.plan;
  const equity = state.account.equity;
  const target = goal?.target_amount ?? null;
  const progress =
    goal && target && target > goal.capital_base
      ? Math.min(Math.max((equity - goal.capital_base) / (target - goal.capital_base), 0), 1)
      : null;

  const soft = plan?.guardrails?.breaker_soft_dd ?? -0.08;
  const hard = plan?.guardrails?.breaker_hard_dd ?? -0.12;
  const dd = state.drawdown_from_peak;
  const breaker = dd <= hard ? "hard" : dd <= soft ? "soft" : null;

  return (
    <div className="space-y-4">
      {state.kill_switch && (
        <div className="rounded-2xl border border-coral bg-coral/10 px-4 py-3 text-sm text-coral">
          Kill switch is ON - no new trades will be placed until you turn it off.
        </div>
      )}
      {breaker && !state.kill_switch && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            breaker === "hard" ? "border-coral bg-coral/10 text-coral" : "border-amber bg-amber/10 text-amber"
          }`}
        >
          {breaker === "hard"
            ? `Hard circuit breaker: ${fmtPct(dd)} from peak. Trading is stopped.`
            : `Soft circuit breaker: ${fmtPct(dd)} from peak. New trades wait for your approval.`}
        </div>
      )}

      {!goal && (
        <Card accent="gold" className="text-center">
          <h1 className="text-2xl font-semibold">Set your North Star</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Tell us the destination - &quot;grow $100k to $110k in a year&quot; - and we&apos;ll show you honest odds
            before a single simulated dollar moves.
          </p>
          <div className="mt-4">
            <Link href="/onboarding">
              <Button>Plan my voyage</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>North Star</SectionTitle>
          {goal ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Stat label="Equity (paper)" value={fmtUsd(equity, 0)} tone="gold" />
                <Stat
                  label="Destination"
                  value={target ? fmtUsd(target, 0) : `${fmtUsd(goal.monthly_target)} / mo`}
                  hint={`${goal.horizon_months ?? 12} months · ${goal.risk_level}`}
                />
                <Stat
                  label="Today"
                  value={fmtPct(state.day_pnl_pct, 2)}
                  tone={state.day_pnl_pct >= 0 ? "teal" : "coral"}
                />
                <Stat label="From peak" value={fmtPct(dd, 1)} tone={dd < 0 ? "coral" : "muted"} />
                {plan && <Stat label="Est. odds" value={fmtPct(plan.probability, 0)} hint="recomputed nightly" />}
              </div>
              {progress !== null && (
                <div className="mt-4">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted">
                    <span>{fmtUsd(goal.capital_base, 0)}</span>
                    <span>{fmtPct(progress, 0)} of the way</span>
                    <span>{fmtUsd(target, 0)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-6">
              <Stat label="Equity (paper)" value={fmtUsd(equity, 0)} tone="gold" />
              <Stat
                label="Today"
                value={fmtPct(state.day_pnl_pct, 2)}
                tone={state.day_pnl_pct >= 0 ? "teal" : "coral"}
              />
              <Stat label="Market" value={state.clock.is_open ? "Open" : "Closed"} tone="muted" />
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Helm</SectionTitle>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Autopilot</span>
              <button
                onClick={() => act("autopilot", () => apiPost("/api/loop/autopilot", { on: !autopilot }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  autopilot ? "bg-teal" : "bg-surface2 border border-line"
                }`}
                disabled={busy !== ""}
                aria-label="toggle autopilot"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${
                    autopilot ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <Button
              variant="subtle"
              className="w-full"
              disabled={busy !== ""}
              onClick={() => act("tick", () => apiPost("/api/loop/tick", { reason: "manual" }))}
            >
              {busy === "tick" ? "Sailing one pass…" : "Run one pass now"}
            </Button>
            <Button
              variant={state.kill_switch ? "primary" : "danger"}
              className="w-full"
              disabled={busy !== ""}
              onClick={() =>
                act("kill", () => apiPost("/api/engine/kill-switch", { on: !state.kill_switch }))
              }
            >
              {state.kill_switch ? "Release kill switch" : "Kill switch - stop everything"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted/80">
              Market {state.clock.is_open ? "is open" : "closed - orders queue to next open"}. Autopilot passes
              run every 15 minutes and always go through the risk gate.
            </p>
          </div>
        </Card>
      </div>

      {approvals.length > 0 && (
        <Card accent="coral">
          <SectionTitle sub="The autopilot only proceeds here with your tap. Ignoring it = an automatic no after the timeout.">
            Waiting on you
          </SectionTitle>
          <div className="space-y-3">
            {approvals.map((a) => (
              <div key={a.id} className="rounded-xl bg-surface2 p-3">
                <div className="text-sm">{a.order_plan.human}</div>
                <div className="mt-1 text-xs text-muted">
                  Why it paused: {a.verdict.reason_codes.join(", ")} · worst case {fmtUsd(a.order_plan.est_max_loss)}
                </div>
                <div className="mt-2 flex gap-2">
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
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle sub="Everything the boat did, in plain words. Full trail in the Voyage Journal.">
            Live feed
          </SectionTitle>
          {feed.length === 0 ? (
            <EmptyState title="No activity yet" body="Run one pass from the Helm to see the loop work." />
          ) : (
            <ul className="space-y-2.5">
              {feed.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <Chip tone={KIND_TONES[e.kind] ?? "line"}>{e.kind}</Chip>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{e.human || "(event)"}</p>
                    <p className="text-[10px] text-muted/70">{new Date(e.ts).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>On board (positions)</SectionTitle>
          {positions.length === 0 ? (
            <EmptyState
              title="No positions yet"
              body="Queued orders fill when the market opens; then the cargo shows up here."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-right">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol} className="border-t border-line/50">
                    <td className="py-2 font-mono text-xs">{p.symbol}</td>
                    <td className="py-2 tabular-nums">{p.qty}</td>
                    <td className="py-2 text-right tabular-nums">{fmtUsd(p.market_value)}</td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        p.unrealized_pl >= 0 ? "text-teal" : "text-coral"
                      }`}
                    >
                      {fmtUsd(p.unrealized_pl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
