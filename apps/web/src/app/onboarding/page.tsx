"use client";

/** Onboarding: the four-step goal wizard, split-screen edition (the approved
 *  prototype composition): left rail with the mark, the promise, and the
 *  numbered steps; right column with the step content. Step 1 carries the
 *  goal orbit - the promise before the proof. Real preview/commit API. */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, fmtPct, fmtUsd } from "@/lib/api";
import { Badge, Button, Input, NorthStarMark, PaperBadge } from "@/components/ui";
import { GoalOrbit } from "@/components/orbit";
import { TrajectoryHero } from "@/components/trajectory";

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
    q: "A month that is down 10% would make me…",
    opts: [
      { label: "Want everything paused.", score: 0 },
      { label: "Want a review, then decide.", score: 1 },
      { label: "Sit through it if the destination still looks reachable.", score: 2 },
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
    q: "When the risk gate rejects a trade…",
    opts: [
      { label: "That's the point of the gate.", score: 0 },
      { label: "Show me why. I'll usually agree.", score: 1 },
      { label: "I'll override if I see a reason.", score: 2 },
    ],
  },
];

const LEVELS = ["conservative", "balanced", "aggressive"] as const;
const STEP_LABELS = ["Destination", "Temperament", "Honest plan", "Confirm"];

const FEAS_TEXT = {
  green: "Realistic destination",
  yellow: "Stretch goal - doable, not likely",
  red: "Honestly unrealistic on this setup",
} as const;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
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

  // Validate before enabling the next step - a nonsense goal produces a
  // nonsense plan, and the preview API should never see one.
  const capitalOk = capital >= 25000;
  const targetOk = mode === "monthly_income" ? monthly > 0 : target > capital;
  const step0Ok = capitalOk && targetOk;

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
      setStep(2);
    } catch {
      setError("Could not compute the plan - can't reach the trading service.");
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

  const feas = preview?.plan.feasibility;
  const destAmount = mode === "target_amount" ? target : capital + monthly * months;

  return (
    <div className="starfield min-h-dvh">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* left rail: the promise + the steps */}
        <div className="flex flex-col gap-6 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gold">
              <NorthStarMark />
              <span className="text-sm font-medium text-ink">NorthStar</span>
            </div>
            <PaperBadge />
          </div>
          <div>
            <h1 className="text-4xl font-medium tracking-tight">Set your North Star.</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-mist">
              Pick a destination. We&apos;ll show you the honest odds before a single simulated
              dollar moves - then the gate watches every trade.
            </p>
          </div>
          <ol className="flex flex-col gap-1">
            {STEP_LABELS.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i >= step}
                  aria-label={i < step ? `Back to ${label}` : label}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ${
                    i === step ? "bg-panel text-ink" : i < step ? "text-mist hover:text-ink" : "text-mist/60"
                  }`}
                >
                  <span
                    className={`num text-xs ${i <= step ? "text-gold" : "text-mist/60"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm">{label}</span>
                  {i < step && <span className="ml-auto text-micro text-mist">done</span>}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-auto hidden font-mono text-micro tracking-wide text-mist/60 lg:block">
            PAPER ONLY · NO REAL MONEY · YOU CAN CHANGE EVERYTHING LATER
          </p>
        </div>

        {/* right column: the step content */}
        <div className="flex flex-col justify-center p-4 md:p-8">
          {step === 0 && (
            <section className="panel p-6">
              <div className="kicker">The destination</div>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <div className="hero-num text-gold">{fmtUsd(destAmount, 0)}</div>
                <div className="text-2xs text-mist">
                  {mode === "target_amount"
                    ? `${fmtUsd(capital, 0)} → ${months} months`
                    : `${fmtUsd(monthly, 0)}/mo for ${months} months`}
                </div>
              </div>

              {mode === "target_amount" && target > capital && (
                <div className="mt-4">
                  <GoalOrbit start={capital} equity={capital} target={target} odds={0} />
                </div>
              )}

              <div className="mt-5 grid gap-3">
                <div className="panel-inset p-3">
                  <label htmlFor="cap" className="kicker">Starting capital</label>
                  <Input
                    id="cap"
                    type="number"
                    min={25000}
                    step={5000}
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="mt-1"
                  />
                  {!capitalOk && (
                    <p className="mt-1 font-mono text-micro text-amber">
                      Minimum practice capital is $25,000.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={mode === "target_amount" ? "gold" : "ghost"}
                    onClick={() => setMode("target_amount")}
                  >
                    Reach an amount
                  </Button>
                  <Button
                    variant={mode === "monthly_income" ? "gold" : "ghost"}
                    onClick={() => setMode("monthly_income")}
                  >
                    Monthly income
                  </Button>
                </div>
                {mode === "target_amount" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="panel-inset p-3">
                      <label htmlFor="tgt" className="kicker">Target</label>
                      <Input
                        id="tgt"
                        type="number"
                        step={1000}
                        value={target}
                        onChange={(e) => setTarget(Number(e.target.value))}
                        className="mt-1"
                      />
                      {!targetOk && (
                        <p className="mt-1 font-mono text-micro text-amber">
                          The target has to be above your capital - growth is the point.
                        </p>
                      )}
                    </div>
                    <div className="panel-inset p-3">
                      <label htmlFor="mo" className="kicker">Horizon (months)</label>
                      <Input
                        id="mo"
                        type="number"
                        min={6}
                        max={60}
                        value={months}
                        onChange={(e) => setMonths(Number(e.target.value) || 12)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="panel-inset p-3">
                      <label htmlFor="inc" className="kicker">Monthly draw</label>
                      <Input
                        id="inc"
                        type="number"
                        min={1}
                        step={100}
                        value={monthly}
                        onChange={(e) => setMonthly(Number(e.target.value))}
                        className="mt-1"
                      />
                      {!targetOk && (
                        <p className="mt-1 font-mono text-micro text-amber">
                          Income has to be a positive number.
                        </p>
                      )}
                    </div>
                    <div className="panel-inset p-3">
                      <label htmlFor="mo2" className="kicker">Horizon (months)</label>
                      <Input
                        id="mo2"
                        type="number"
                        min={6}
                        max={60}
                        value={months}
                        onChange={(e) => setMonths(Number(e.target.value) || 12)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <Button variant="gold" onClick={() => setStep(1)} disabled={!step0Ok}>
                  Continue
                </Button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="panel p-6">
              <div className="kicker">Risk temperament</div>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">How do you take weather?</h2>
              <p className="mt-1 text-sm text-mist">
                Three questions. One temperament. Guardrails follow, not slogans.
              </p>
              <div className="mt-6 space-y-6">
                {RISK_QUESTIONS.map((rq, qi) => (
                  <fieldset key={qi}>
                    <legend className="text-sm text-ink">{rq.q}</legend>
                    <div className="mt-2 grid gap-2">
                      {rq.opts.map((o, oi) => (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? o.score : v)))}
                          aria-pressed={answers[qi] === o.score}
                          className={`rounded-lg px-3 py-2.5 text-left text-sm transition-[box-shadow,background-color] duration-150 ${
                            answers[qi] === o.score
                              ? "bg-panel text-ink shadow-tone-signal"
                              : "bg-void/40 text-mist shadow-border hover:text-ink"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="mt-6 rounded-lg bg-panel p-4">
                <div className="kicker">Guardrails · {risk}</div>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  <li>
                    Max risk per trade{" "}
                    {risk === "conservative" ? "0.5%" : risk === "balanced" ? "1%" : "2%"} of the
                    account
                  </li>
                  <li>
                    Autopilot pauses at{" "}
                    {risk === "conservative" ? "-5%" : risk === "balanced" ? "-8%" : "-10%"}{" "}
                    drawdown
                  </li>
                  <li>Every proposal hits a deterministic gate. Rejections are on record.</li>
                </ul>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button variant="gold" disabled={loading || !step0Ok} onClick={loadPreview}>
                  {loading ? "Computing honest odds…" : "See the honest plan"}
                </Button>
              </div>
              {error && <p className="mt-3 text-sm text-coral">{error}</p>}
            </section>
          )}

          {step === 2 && preview && (
            <section className="panel p-6">
              <div className="kicker">The honest plan</div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div
                  className={`hero-num ${
                    feas === "green" ? "text-teal" : feas === "yellow" ? "text-amber" : "text-coral"
                  }`}
                >
                  {fmtPct(preview.plan.probability, 0)}
                </div>
                <div>
                  <div className="text-sm text-ink">{FEAS_TEXT[feas ?? "yellow"]}</div>
                  <div className="text-2xs text-mist">Historical estimate, not a promise.</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-mist">
                Needs {fmtPct(preview.plan.required_annual_return, 0)} / year to arrive.
              </p>
              <div className="mt-4 rounded-lg bg-void/50 p-2">
                <TrajectoryHero
                  bands={preview.bands?.p50?.length ? preview.bands : null}
                  months={preview.months}
                  target={preview.target_amount}
                  base={capital}
                  equity={[]}
                />
              </div>

              {feas !== "green" && preview.plan.honest_alternatives.length > 0 && (
                <div className="mt-5 rounded-lg bg-coral-dim p-4 shadow-tone-coral">
                  <div className="text-sm font-medium text-coral">Red path</div>
                  <ul className="mt-2 space-y-2 text-sm text-ink">
                    {preview.plan.honest_alternatives.map((a, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-coral">→</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                      Adjust my destination
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {preview.plan.allocations.map((a) => (
                  <article key={a.strategy_id} className="rounded-lg bg-panel p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm capitalize text-ink">
                        {a.strategy_id.replace(/_/g, " ")}
                      </span>
                      <span className="num text-xs text-gold">{fmtPct(a.weight, 0)}</span>
                    </div>
                    <p className="mt-1 text-xs text-mist">{a.why}</p>
                  </article>
                ))}
              </div>
              <ul className="mt-4 space-y-1 text-xs text-mist">
                <li>· One trade can risk at most {fmtPct(preview.plan.guardrails.max_loss_per_trade_pct, 1)} of the account</li>
                <li>· No single company above {fmtPct(preview.plan.guardrails.single_name_concentration, 0)}</li>
                <li>· Autopilot pauses for you at {fmtPct(preview.plan.guardrails.breaker_soft_dd, 0)} drawdown</li>
                <li>· Hard stop at {fmtPct(preview.plan.guardrails.breaker_hard_dd, 0)} - no new trades, full stop</li>
                <li>· Expected worst stretch ~{fmtPct(preview.plan.max_drawdown_est, 0)} (median simulated)</li>
                <li>· Kill switch is always one click away</li>
              </ul>
              {preview.plan.baseline_note && (
                <p className="mt-3 rounded-lg bg-panel p-3 text-xs leading-relaxed text-mist">
                  {preview.plan.baseline_note}
                </p>
              )}
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button variant="gold" onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </section>
          )}

          {step === 3 && preview && (
            <section className="panel p-6">
              <div className="kicker">Confirm</div>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">Paper, not a promise</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
                <li>This account is simulated. Fills are paper. Prices are live.</li>
                <li>AI can propose. The gate can say no. You can still skip or approve what it pauses.</li>
                <li>The kill switch stops everything instantly. Circuit breakers pause new risk.</li>
                <li>The journal is append-only. Rejections stay. Failures stay.</li>
                <li>Odds are a historical estimate, not a promise.</li>
              </ul>
              <div className="mt-6 rounded-lg bg-panel p-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge>{fmtUsd(capital, 0)} paper</Badge>
                  <Badge tone="gold">
                    {mode === "target_amount"
                      ? `${fmtUsd(target, 0)} destination`
                      : `${fmtUsd(monthly, 0)}/mo draw`}
                  </Badge>
                  <Badge>{months} months</Badge>
                  <Badge tone="signal">{risk}</Badge>
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button variant="gold" size="lg" disabled={loading} onClick={commit}>
                  {loading ? "Starting…" : "Start the plan"}
                </Button>
              </div>
              {error && <p className="mt-3 text-sm text-coral">{error}</p>}
            </section>
          )}

          <p className="mt-6 text-center text-micro leading-relaxed text-mist/60 lg:hidden">
            Paper trading only · estimates, not promises · not investment advice
          </p>
        </div>
      </div>
    </div>
  );
}
