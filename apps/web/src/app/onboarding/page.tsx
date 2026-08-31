"use client";

/** Onboarding: the four-step goal wizard, split-screen edition (the approved
 *  prototype composition): left rail with the mark, the promise, and the
 *  numbered steps; right column with the step content. Step 1 carries the
 *  goal orbit - the promise before the proof. Real preview/commit API. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost, fmtPct, fmtUsd } from "@/lib/api";
import { useApi } from "@/lib/data";
import { Badge, Button, Input, NorthStarMark, PaperBadge } from "@/components/ui";
import { GoalOrbit } from "@/components/orbit";
import { TrajectoryHero } from "@/components/trajectory";
import type { EngineState } from "@/lib/types";

type Alternative = { text: string; changes: Record<string, number> };

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
    honest_alternatives: Alternative[];
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
  // Raw string so the field can actually be cleared while typing - the old
  // `Number(v) || 12` snapped every backspace straight back to 12.
  const [monthsRaw, setMonthsRaw] = useState("12");
  const [monthly, setMonthly] = useState(800);
  const [answers, setAnswers] = useState<number[]>([1, 1, 1]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [nlNote, setNlNote] = useState<{ tone: "ok" | "miss"; text: string } | null>(null);

  // A returning user may only be revisiting - give them a way back out.
  const hasGoal = !!useApi<EngineState>("/api/engine/state").data?.goal;

  const months = Number(monthsRaw);

  const risk = useMemo(() => {
    const total = answers.reduce((a, b) => a + b, 0);
    return LEVELS[total <= 2 ? 0 : total <= 4 ? 1 : 2];
  }, [answers]);

  // Validate before enabling the next step - a nonsense goal produces a
  // nonsense plan, and the preview API should never see one. The horizon
  // bounds (6-60) are enforced here, not just hinted in HTML attributes.
  const capitalOk = capital >= 25000;
  const targetOk = mode === "monthly_income" ? monthly > 0 : target > capital;
  const monthsOk = Number.isInteger(months) && months >= 6 && months <= 60;
  const step0Ok = capitalOk && targetOk && monthsOk;

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

  async function parseSentence() {
    const text = nlText.trim();
    if (!text) return;
    setNlBusy(true);
    setNlNote(null);
    try {
      const r = await apiPost<{ fields: Record<string, unknown> }>("/api/goal/parse", { text });
      const f = r.fields;
      if (f.mode === "monthly_income" || f.mode === "target_amount") setMode(f.mode);
      if (typeof f.capital_base === "number") setCapital(f.capital_base);
      if (typeof f.target_amount === "number") setTarget(f.target_amount);
      if (typeof f.monthly_target === "number") setMonthly(f.monthly_target);
      if (typeof f.horizon_months === "number") setMonthsRaw(String(f.horizon_months));
      setNlNote({ tone: "ok", text: "Filled in below - check the numbers, then continue." });
    } catch {
      setNlNote({ tone: "miss", text: "Could not read a goal out of that - the fields below still work." });
    } finally {
      setNlBusy(false);
    }
  }

  async function previewWith(body: typeof goalBody) {
    setLoading(true);
    setError("");
    try {
      const p = await apiPost<Preview>("/api/goal/preview", body);
      setPreview(p);
      setStep(2);
    } catch {
      setError("Could not compute the plan - can't reach the trading service.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    return previewWith(goalBody);
  }

  /** One tap on an honest alternative: apply its numbers to the form state
   *  and recompute the plan immediately (state updates are async, so the
   *  recompute uses an explicit body instead of reading state back). */
  function applyAlternative(a: Alternative) {
    const next = { ...goalBody };
    const t = a.changes.target_amount;
    const h = a.changes.horizon_months;
    const c = a.changes.capital_base;
    if (typeof t === "number") {
      const v = Math.round(t);
      setMode("target_amount");
      setTarget(v);
      next.mode = "target_amount";
      next.target_amount = v;
      next.monthly_target = null;
    }
    if (typeof h === "number") {
      const v = Math.round(h);
      setMonthsRaw(String(v));
      next.horizon_months = v;
    }
    if (typeof c === "number") {
      const v = Math.round(c);
      setCapital(v);
      next.capital_base = v;
    }
    void previewWith(next);
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
  const destAmount =
    mode === "target_amount" ? target : capital + monthly * (Number.isFinite(months) ? months : 0);

  return (
    <div className="starfield min-h-dvh">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* left rail: the promise + the steps */}
        <div className="flex flex-col gap-6 p-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gold" aria-label="Back to Overview">
              <NorthStarMark />
              <span className="text-sm font-medium text-ink">NorthStar</span>
            </Link>
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
                    i === step ? "bg-panel text-ink" : i < step ? "text-mist hover:text-ink" : "text-mist/75"
                  }`}
                >
                  <span
                    className={`num text-xs ${i <= step ? "text-gold" : "text-mist/75"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm">{label}</span>
                  {i < step && <span className="ml-auto text-micro text-mist">done</span>}
                </button>
              </li>
            ))}
          </ol>
          {hasGoal && (
            <Link href="/" className="text-xs text-mist underline-offset-2 hover:text-ink hover:underline">
              Keep my current plan - back to the cockpit →
            </Link>
          )}
          <p className="mt-auto hidden font-mono text-micro tracking-wide text-mist lg:block">
            PAPER ONLY · NO REAL MONEY · YOU CAN CHANGE EVERYTHING LATER
          </p>
        </div>

        {/* right column: the step content */}
        <div className="flex flex-col justify-center p-4 md:p-8">
          {step === 0 && (
            <section className="panel p-6">
              {/* One sentence in, structured goal out. Suggest-only: the parse
                  prefills the fields below and the user always confirms. */}
              <div className="panel-inset mb-5 p-3">
                <label htmlFor="nl" className="kicker">Say it in one sentence</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="nl"
                    type="text"
                    maxLength={400}
                    placeholder={'e.g. "Grow $100k to $120k in 18 months" - any language works'}
                    value={nlText}
                    onChange={(e) => setNlText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !nlBusy) parseSentence();
                    }}
                  />
                  <Button variant="ghost" disabled={nlBusy || !nlText.trim()} onClick={parseSentence}>
                    {nlBusy ? "Reading…" : "Fill the fields"}
                  </Button>
                </div>
                {nlNote && (
                  <p
                    className={`mt-1.5 font-mono text-micro ${nlNote.tone === "ok" ? "text-teal" : "text-amber"}`}
                    role="status"
                  >
                    {nlNote.text}
                  </p>
                )}
              </div>
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
                        value={monthsRaw}
                        onChange={(e) => setMonthsRaw(e.target.value)}
                        className="mt-1"
                      />
                      {!monthsOk && (
                        <p className="mt-1 font-mono text-micro text-amber">
                          Horizon must be 6 to 60 whole months.
                        </p>
                      )}
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
                        value={monthsRaw}
                        onChange={(e) => setMonthsRaw(e.target.value)}
                        className="mt-1"
                      />
                      {!monthsOk && (
                        <p className="mt-1 font-mono text-micro text-amber">
                          Horizon must be 6 to 60 whole months.
                        </p>
                      )}
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
                    <legend className="text-sm text-ink">
                      {rq.q}
                      <span className="sr-only"> - choose one of three</span>
                    </legend>
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
              <div className="panel-inset mt-6 p-4">
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
                {/* Odds wear gold (star moment, contract §2); only the red
                    verdict bleeds coral. The rating text carries the grade -
                    never amber, which stays reserved for human-decision waits. */}
                <div className={`hero-num ${feas === "red" ? "text-coral" : "text-gold"}`}>
                  {fmtPct(preview.plan.probability, 0)}
                </div>
                <div>
                  <div
                    className={`text-sm ${
                      feas === "green" ? "text-teal" : feas === "red" ? "text-coral" : "text-ink"
                    }`}
                  >
                    {FEAS_TEXT[feas ?? "yellow"]}
                  </div>
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
                // coral is reserved for the red verdict; a stretch (yellow)
                // plan gets a neutral "raise the odds" block instead
                <div
                  className={`mt-5 rounded-lg p-4 ${
                    feas === "red" ? "bg-coral-dim shadow-tone-coral" : "panel-inset"
                  }`}
                >
                  <div className={`text-sm font-medium ${feas === "red" ? "text-coral" : "text-ink"}`}>
                    {feas === "red" ? "Red path - this goal needs a rethink" : "Ways to raise the odds"}
                  </div>
                  <ul className="mt-2 space-y-2 text-sm text-ink">
                    {preview.plan.honest_alternatives.map((a, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2">
                        <span className={feas === "red" ? "text-coral" : "text-mist"} aria-hidden>
                          →
                        </span>
                        <span className="min-w-0 flex-1">{a.text}</span>
                        {Object.keys(a.changes ?? {}).length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={loading}
                            onClick={() => applyAlternative(a)}
                            title="Apply these numbers and recompute the odds"
                          >
                            Use these numbers
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStep(0);
                        // land the user on the field they most likely need
                        requestAnimationFrame(() => document.getElementById("tgt")?.focus());
                      }}
                    >
                      Adjust my destination
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {preview.plan.allocations.map((a) => (
                  <article key={a.strategy_id} className="panel-inset p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm capitalize text-ink">
                        {a.strategy_id.replace(/_/g, " ")}
                      </span>
                      {/* weights are table data, not star moments */}
                      <span className="num text-xs text-ink">{fmtPct(a.weight, 0)}</span>
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
                <p className="panel-inset mt-3 p-3 text-xs leading-relaxed text-mist">
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
              <div className="panel-inset mt-6 p-4 text-sm">
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

          <p className="mt-6 text-center text-micro leading-relaxed text-mist lg:hidden">
            Paper trading only · estimates, not promises · not investment advice
          </p>
        </div>
      </div>
    </div>
  );
}
