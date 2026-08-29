"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiPost, fmtPct, fmtUsd } from "@/lib/api";
import { Button, Card, Chip, SectionTitle } from "@/components/ui";

type Preview = {
  goal: Record<string, unknown>;
  plan: {
    feasibility: "green" | "yellow" | "red";
    probability: number;
    required_annual_return: number;
    max_drawdown_est: number;
    allocations: { strategy_id: string; weight: number; why: string }[];
    guardrails: Record<string, number>;
    baseline_note: string;
    honest_alternatives: string[];
  };
  bands: { p10: number[]; p50: number[]; p90: number[] };
  months: number;
  target_amount: number;
  data_note: string;
};

const RISK_QUESTIONS = [
  {
    q: "Your account drops 10% in a rough month. What's your honest reaction?",
    opts: [
      { label: "Stop everything, I can't sleep", score: 0 },
      { label: "Uncomfortable, but I'd trim risk and continue", score: 1 },
      { label: "Normal weather - stay the course", score: 2 },
    ],
  },
  {
    q: "This money is...",
    opts: [
      { label: "Savings I may need within a year", score: 0 },
      { label: "Medium-term money (1-3 years)", score: 1 },
      { label: "Long-term money I won't touch", score: 2 },
    ],
  },
  {
    q: "Which sentence sounds most like you?",
    opts: [
      { label: "Slow and steady beats sorry", score: 0 },
      { label: "Balance growth and safety", score: 1 },
      { label: "I accept bigger swings for bigger upside", score: 2 },
    ],
  },
];

const LEVELS = ["conservative", "balanced", "aggressive"] as const;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [capital, setCapital] = useState(100000);
  const [mode, setMode] = useState<"target_amount" | "monthly_income">("target_amount");
  const [target, setTarget] = useState(110000);
  const [months, setMonths] = useState(12);
  const [monthly, setMonthly] = useState(800);
  const [answers, setAnswers] = useState<number[]>([1, 1, 1]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const risk = useMemo(() => {
    const total = answers.reduce((a, b) => a + b, 0);
    return LEVELS[total <= 2 ? 0 : total <= 4 ? 1 : 2];
  }, [answers]);

  const goalBody = useMemo(
    () => ({
      mode,
      capital_base: capital,
      target_amount: mode === "target_amount" ? target : null,
      horizon_months: months,
      monthly_target: mode === "monthly_income" ? monthly : null,
      risk_level: risk,
    }),
    [mode, capital, target, months, monthly, risk],
  );

  async function loadPreview() {
    setLoading(true);
    setError("");
    try {
      const p = await apiPost<Preview>("/api/goal/preview", goalBody);
      setPreview(p);
      setStep(3);
    } catch {
      setError("Could not compute the plan - is the API running?");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setLoading(true);
    try {
      await apiPost("/api/goal/commit", goalBody);
      router.push("/");
    } catch {
      setError("Commit failed - try again.");
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!preview?.bands?.p50) return [];
    return preview.bands.p50.map((v, i) => ({
      month: i + 1,
      p10: preview.bands.p10[i],
      p50: v,
      p90: preview.bands.p90[i],
    }));
  }, [preview]);

  const feas = preview?.plan.feasibility;
  const feasTone = feas === "green" ? "teal" : feas === "yellow" ? "amber" : "coral";
  const feasText =
    feas === "green"
      ? "Realistic destination"
      : feas === "yellow"
        ? "Stretch goal - doable, not likely"
        : "Honestly unrealistic on this setup";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold ${
                step >= s ? "border-gold bg-gold/15 text-gold" : "border-line text-muted"
              }`}
            >
              {s}
            </span>
            {s < 4 && <span className="h-px w-8 bg-line" />}
          </div>
        ))}
        <span className="ml-3 text-sm text-muted">
          {["Destination", "Risk temperament", "Your honest plan", "Set sail"][step - 1]}
        </span>
      </div>

      {step === 1 && (
        <Card>
          <SectionTitle sub="Tell us where you want to go. We'll translate it into a plan - and tell you the truth about the odds.">
            Step 1 - Pick your destination
          </SectionTitle>

          <label className="mb-1 block text-xs text-muted">Practice capital (paper dollars)</label>
          <input
            type="number"
            value={capital}
            min={25000}
            step={5000}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="mb-4 w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-gold/60"
          />

          <div className="mb-4 flex gap-2">
            <Button
              variant={mode === "target_amount" ? "primary" : "ghost"}
              onClick={() => setMode("target_amount")}
            >
              Reach an amount
            </Button>
            <Button
              variant={mode === "monthly_income" ? "primary" : "ghost"}
              onClick={() => setMode("monthly_income")}
            >
              Monthly income
            </Button>
          </div>

          {mode === "target_amount" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Grow it to…</label>
                <input
                  type="number"
                  value={target}
                  step={1000}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-gold/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Within…</label>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-gold/60"
                >
                  {[6, 12, 18, 24, 36].map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Income per month</label>
                <input
                  type="number"
                  value={monthly}
                  step={100}
                  onChange={(e) => setMonthly(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-gold/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Judged over…</label>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-gold/60"
                >
                  {[6, 12, 24].map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <SectionTitle sub="Three honest questions. They set your guardrails - how much any single trade may risk and when the system stops itself.">
            Step 2 - Risk temperament
          </SectionTitle>
          {RISK_QUESTIONS.map((rq, qi) => (
            <div key={qi} className="mb-4">
              <div className="mb-2 text-sm">{rq.q}</div>
              <div className="flex flex-wrap gap-2">
                {rq.opts.map((o, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? o.score : v)))}
                    className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                      answers[qi] === o.score
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mb-4 rounded-xl bg-surface2 p-3 text-sm">
            Your temperament: <Chip tone="gold">{risk}</Chip>
            <span className="ml-2 text-xs text-muted">
              {risk === "conservative"
                ? "max 0.5% of the account at risk per trade, autopilot pauses at -5% drawdown"
                : risk === "balanced"
                  ? "max 1% of the account at risk per trade, autopilot pauses at -8% drawdown"
                  : "max 2% of the account at risk per trade, autopilot pauses at -10% drawdown"}
            </span>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={loadPreview} disabled={loading}>
              {loading ? "Computing honest odds…" : "See my plan"}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        </Card>
      )}

      {step === 3 && preview && (
        <div className="space-y-4">
          <Card accent={feasTone === "coral" ? "coral" : feasTone === "teal" ? "teal" : "none"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted">Estimated odds of reaching</div>
                <div className="text-2xl font-semibold">
                  {fmtUsd(preview.target_amount)}{" "}
                  <span className="text-sm font-normal text-muted">in {preview.months} months</span>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-4xl font-bold tabular-nums ${
                    feas === "green" ? "text-teal" : feas === "yellow" ? "text-amber" : "text-coral"
                  }`}
                >
                  {fmtPct(preview.plan.probability, 0)}
                </div>
                <Chip tone={feasTone as "teal" | "amber" | "coral"}>{feasText}</Chip>
              </div>
            </div>

            <div className="mt-4 h-56">
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#24334f" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#93a4c3", fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tick={{ fill: "#93a4c3", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{ background: "#121c30", border: "1px solid #24334f", borderRadius: 12 }}
                    formatter={(v, name) => [fmtUsd(Number(v ?? 0)), String(name)]}
                    labelFormatter={(l) => `Month ${l}`}
                  />
                  <Area dataKey="p90" name="Lucky path (90th)" stroke="none" fill="#35d0ba" fillOpacity={0.12} />
                  <Area dataKey="p10" name="Rough path (10th)" stroke="none" fill="#0b1220" fillOpacity={1} />
                  <Line dataKey="p50" name="Median" stroke="#e8c268" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted/80">{preview.data_note}</p>
          </Card>

          {feas !== "green" && (
            <Card accent="coral">
              <SectionTitle>We won&apos;t pretend - here&apos;s what would actually work</SectionTitle>
              <ul className="space-y-2 text-sm">
                {preview.plan.honest_alternatives.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-coral">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Adjust my destination
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle>The crew &amp; the guardrails</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              {preview.plan.allocations.map((a) => (
                <div key={a.strategy_id} className="rounded-xl bg-surface2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{a.strategy_id.replace("_", " ")}</span>
                    <span className="text-lg font-semibold text-gold">{fmtPct(a.weight, 0)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{a.why}</p>
                </div>
              ))}
            </div>
            <ul className="mt-4 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
              <li>· One trade can risk at most {fmtPct(preview.plan.guardrails.max_loss_per_trade_pct, 1)} of the account</li>
              <li>· No single company above {fmtPct(preview.plan.guardrails.single_name_concentration, 0)}</li>
              <li>· Autopilot pauses for you at {fmtPct(preview.plan.guardrails.breaker_soft_dd, 0)} drawdown</li>
              <li>· Hard stop at {fmtPct(preview.plan.guardrails.breaker_hard_dd, 0)} - no new trades, full stop</li>
              <li>· Expected worst stretch ~{fmtPct(preview.plan.max_drawdown_est, 0)} (median simulated)</li>
              <li>· Kill switch is always one click away</li>
            </ul>
            {preview.plan.baseline_note && (
              <p className="mt-3 rounded-xl border border-line bg-surface2 p-3 text-xs leading-relaxed text-muted">
                {preview.plan.baseline_note}
              </p>
            )}
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)}>Looks honest - continue</Button>
          </div>
        </div>
      )}

      {step === 4 && preview && (
        <Card accent="gold">
          <SectionTitle>Step 4 - Set sail (paper water first)</SectionTitle>
          <ul className="space-y-2 text-sm leading-relaxed">
            <li>
              ✦ This voyage runs on a <b>practice account</b> - simulated money, live market. No real dollars move.
            </li>
            <li>✦ The autopilot only trades inside the guardrails you just saw. Anything unusual waits for your tap.</li>
            <li>✦ Every decision - including rejected ones - lands in the Voyage Journal in plain English.</li>
            <li>✦ You can pause, change the plan, or hit the kill switch at any time.</li>
          </ul>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button onClick={commit} disabled={loading}>
              {loading ? "Raising anchor…" : "Start the voyage"}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        </Card>
      )}
    </div>
  );
}
