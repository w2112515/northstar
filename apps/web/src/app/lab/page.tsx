"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, fmtPct } from "@/lib/api";
import { Button, Card, Chip, EmptyState, SectionTitle } from "@/components/ui";

type Report = {
  is_sharpe: number | null;
  oos_sharpe: number | null;
  ann_return: number | null;
  max_dd: number | null;
  win_rate: number | null;
  trials_in_family: number;
  data_note: string;
};

type Experiment = {
  id: string;
  created_at: string;
  family: string;
  parent_version: string;
  hypothesis: string;
  proposed_by: string;
  params_delta: Record<string, number>;
  backtest: Report | null;
  status: string;
  verdict_reason: string;
};

const STATUS_TONE: Record<string, "gold" | "teal" | "coral" | "amber" | "line"> = {
  promoted: "gold",
  awaiting_approval: "amber",
  backtested: "line",
  archived: "line",
  trial: "teal",
};

export default function Lab() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [running, setRunning] = useState(false);
  const [deciding, setDeciding] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await apiGet<{ experiments: Experiment[] }>("/api/lab/experiments");
      setExperiments(r.experiments);
      setErr("");
    } catch {
      setErr("API unreachable");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function evolve() {
    setRunning(true);
    try {
      await apiPost("/api/lab/evolve", { family: "momentum_rotation", n_candidates: 3 });
      await refresh();
    } finally {
      setRunning(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    setDeciding(id);
    try {
      await apiPost(`/api/lab/experiments/${id}/decision`, { approve });
      await refresh();
    } finally {
      setDeciding("");
    }
  }

  const pending = experiments.filter((e) => e.status === "awaiting_approval");

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle sub="Propose (Gemini, or a labeled grid fallback) -> real walk-forward backtest -> score with a multiple-testing haircut -> your approval. Nothing promotes itself.">
            Evolution Lab
          </SectionTitle>
          <Button onClick={evolve} disabled={running}>
            {running ? "Testing candidates on real data…" : "Run an evolution round"}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted/80">
          Fitness is judged only on out-of-sample walk-forward results (last 30% of 4 years, never used
          for tuning), with costs. In-sample numbers are shown for context but never decide.
        </p>
      </Card>

      {pending.length > 0 && (
        <Card accent="gold">
          <SectionTitle>Promotion candidates - your call</SectionTitle>
          {pending.map((e) => (
            <div key={e.id} className="mb-3 rounded-xl bg-surface2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="gold">{e.family}</Chip>
                <Chip tone="line">from {e.parent_version}</Chip>
                <Chip tone={e.proposed_by === "gemini" ? "blue" : "line"}>{e.proposed_by}</Chip>
              </div>
              <p className="mt-2 text-sm">{e.hypothesis}</p>
              <p className="mt-1 text-xs text-muted">{e.verdict_reason}</p>
              {e.backtest && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
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
        </Card>
      )}

      <Card>
        <SectionTitle sub="Every experiment stays on record - including the failures. That's the point.">
          Experiment lineage
        </SectionTitle>
        {err && <EmptyState title={err} />}
        {!err && experiments.length === 0 && (
          <EmptyState
            title="No experiments yet"
            body="Run an evolution round - candidates are tested against real historical data, and only genuinely better ones reach your desk."
          />
        )}
        {experiments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2">When</th>
                  <th className="pb-2">Hypothesis</th>
                  <th className="pb-2">Change</th>
                  <th className="pb-2 text-right">OOS Sharpe</th>
                  <th className="pb-2 text-right">Max DD</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e) => (
                  <tr key={e.id} className="border-t border-line/50 align-top">
                    <td className="py-2.5 whitespace-nowrap text-xs text-muted">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-[260px] py-2.5 text-xs leading-relaxed">{e.hypothesis}</td>
                    <td className="py-2.5 font-mono text-[11px] text-muted">
                      {JSON.stringify(e.params_delta)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {e.backtest?.oos_sharpe?.toFixed(2) ?? "-"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{fmtPct(e.backtest?.max_dd)}</td>
                    <td className="py-2.5">
                      <Chip tone={STATUS_TONE[e.status] ?? "line"}>{e.status.replace("_", " ")}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, v, strong }: { label: string; v?: string | null; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-semibold text-gold" : ""}`}>{v ?? "-"}</div>
    </div>
  );
}
