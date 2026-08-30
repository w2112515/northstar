import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MonteCarloChart } from "@/components/viz/monte-carlo";
import { NorthStarMark, PaperBadge } from "@/components/marks";
import { HydrateStore } from "@/components/layout/hydrate";
import { useVoyage } from "@/lib/store";
import {
  GUARDRAILS,
  allocationFor,
  arrivalOdds,
  feasibilityVerdict,
  monteCarloBand,
  redPathOptions,
  requiredAnnualized,
  scoreTemperament,
  verdictCopy,
  BEST_HISTORICAL_YEAR,
} from "@/lib/plan";
import { money, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { GoalMode, Temperament, VoyageConfig } from "@/lib/types";

const QUESTIONS: {
  q: string;
  opts: { label: string; value: Temperament }[];
}[] = [
  {
    q: "A month that is down 10% would make me…",
    opts: [
      { label: "Want the fleet paused.", value: "conservative" },
      { label: "Want a review, then decide.", value: "balanced" },
      { label: "Sit through it if the destination still looks reachable.", value: "aggressive" },
    ],
  },
  {
    q: "Options and short-dated trades…",
    opts: [
      { label: "Keep them off the book.", value: "conservative" },
      { label: "Small, gated, never more than a slice.", value: "balanced" },
      { label: "Use them when the weather is favorable.", value: "aggressive" },
    ],
  },
  {
    q: "When the risk gate rejects a trade…",
    opts: [
      { label: "That's the point of the gate.", value: "conservative" },
      { label: "Show me why. I'll usually agree.", value: "balanced" },
      { label: "I'll override if I see a reason.", value: "aggressive" },
    ],
  },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const complete = useVoyage((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [capital, setCapital] = useState(100000);
  const [mode, setMode] = useState<GoalMode>("amount");
  const [target, setTarget] = useState(110000);
  const [income, setIncome] = useState(800);
  const [months, setMonths] = useState(12);
  const [answers, setAnswers] = useState<Array<Temperament | null>>([null, null, null]);

  const temperament = scoreTemperament(answers);
  const dest = mode === "amount" ? target : capital + income * months;
  const required = requiredAnnualized(capital, dest, months);
  const odds = arrivalOdds(capital, dest, months, temperament);
  const verdict = feasibilityVerdict(odds, required);
  const band = useMemo(
    () => monteCarloBand(capital, months, temperament),
    [capital, months, temperament],
  );
  const alloc = allocationFor(temperament);
  const g = GUARDRAILS[temperament];
  const red = redPathOptions(capital, dest, months);
  const answered = answers.every(Boolean);

  const cfg = (): VoyageConfig => ({
    onboarded: true,
    startingCapital: capital,
    goalMode: mode,
    targetAmount: mode === "amount" ? target : dest,
    monthlyIncome: income,
    deadlineMonths: months,
    temperament,
    startedAt: new Date().toISOString(),
    firstDay: true,
  });

  return (
    <div className="starfield min-h-dvh">
      <HydrateStore />
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-gold">
          <NorthStarMark />
          <span className="text-sm font-medium text-ink">NorthStar</span>
        </div>
        <PaperBadge />
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <ol className="mb-8 flex gap-2">
          {["Destination", "Temperament", "Honest plan", "Confirm"].map((label, i) => (
            <li key={label} className="flex-1">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-gold" : "bg-line")} />
              <div className={cn("mt-2 text-2xs tracking-wide", i === step ? "text-ink" : "text-mist")}>
                {label}
              </div>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="panel p-6">
            <h1 className="text-2xl font-medium tracking-tight">Where is the ship going?</h1>
            <p className="mt-2 text-sm text-mist">
              Practice capital only. This is paper money. Live prices, simulated book. Try $200,000 in 12 months if you want to see the red path.
            </p>
            <div className="mt-6">
              <Label htmlFor="cap">Practice capital</Label>
              <Input
                id="cap"
                type="number"
                min={1000}
                step={1000}
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant={mode === "amount" ? "gold" : "ghost"} onClick={() => setMode("amount")}>
                Reach an amount
              </Button>
              <Button variant={mode === "income" ? "gold" : "ghost"} onClick={() => setMode("income")}>
                Monthly income
              </Button>
            </div>
            {mode === "amount" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tgt">Target</Label>
                  <Input
                    id="tgt"
                    type="number"
                    min={capital}
                    step={1000}
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mo">Deadline (months)</Label>
                  <Input
                    id="mo"
                    type="number"
                    min={1}
                    max={60}
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="inc">Monthly draw</Label>
                  <Input
                    id="inc"
                    type="number"
                    min={0}
                    step={50}
                    value={income}
                    onChange={(e) => setIncome(Number(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mo2">Horizon (months)</Label>
                  <Input
                    id="mo2"
                    type="number"
                    min={1}
                    max={60}
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="gold" onClick={() => setStep(1)} disabled={capital < 1000}>
                Next
              </Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="panel p-6">
            <h1 className="text-2xl font-medium tracking-tight">How do you take weather?</h1>
            <p className="mt-2 text-sm text-mist">Three questions. One temperament. Guardrails follow, not slogans.</p>
            <div className="mt-6 space-y-6">
              {QUESTIONS.map((q, i) => (
                <fieldset key={q.q}>
                  <legend className="text-sm text-ink">{q.q}</legend>
                  <div className="mt-2 grid gap-2">
                    {q.opts.map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => {
                            const n = [...a];
                            n[i] = o.value;
                            return n;
                          })
                        }
                        className={cn(
                          "rounded-lg px-3 py-2.5 text-left text-sm transition-[box-shadow,background-color] duration-150",
                          answers[i] === o.value
                            ? "bg-panel text-ink shadow-tone-signal"
                            : "bg-void/40 text-mist shadow-border hover:text-ink",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {answered && (
              <div className="mt-6 rounded-lg bg-panel p-4">
                <div className="kicker">Guardrails · {g.label}</div>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  <li>Max risk per trade {pct(g.maxRisk * 100, 1).replace("+", "")}</li>
                  <li>Drawdown pause at {pct(g.drawdownPause * 100, 0).replace("+", "")}</li>
                  <li>
                    Options {g.maxOptions === 0 ? "off the book" : `capped at ${Math.round(g.maxOptions * 100)}% of book`}
                  </li>
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button variant="gold" disabled={!answered} onClick={() => setStep(2)}>
                See the honest plan
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="panel p-6">
            <div className="kicker">The honest plan</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="hero-num text-gold">{(odds * 100).toFixed(0)}%</div>
              <div>
                <div className="text-sm text-ink">{verdictCopy(verdict)}</div>
                <div className="text-2xs text-mist">Historical estimate, not a promise.</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-mist">
              Needs {pct(required * 100, 0)} / year to arrive. Our best historical year was {pct(BEST_HISTORICAL_YEAR * 100, 0)}.
            </p>
            <div className="mt-4 h-52 rounded-lg bg-void/50 p-2">
              <MonteCarloChart band={band} target={dest} start={capital} />
            </div>
            <div className="mt-2 flex gap-3 text-2xs text-mist">
              <span>p10–p90 band</span>
              <span>white = p50</span>
              <span className="text-gold">gold = destination</span>
            </div>

            {verdict === "unrealistic" && (
              <div className="mt-5 rounded-lg bg-coral-dim p-4 shadow-tone-coral">
                <div className="text-sm font-medium text-coral">Red path</div>
                <p className="mt-2 text-sm text-ink">
                  {mode === "amount" && dest >= capital * 2 && months <= 12
                    ? `Doubling in ${months} months needs ${pct(required * 100, 0)} / year.`
                    : `This destination needs ${pct(required * 100, 0)} / year.`}{" "}
                  Our best historical year was {pct(BEST_HISTORICAL_YEAR * 100, 0)}. Two honest options:
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMonths(36);
                    }}
                  >
                    Extend to 3 years
                    <span className="text-mist">({pct(red.extendRequired * 100, 0)} / yr)</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMode("amount");
                      setTarget(red.lowerTarget);
                    }}
                  >
                    Lower target to {money(red.lowerTarget)}
                    <span className="text-mist">(+20%)</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {alloc.map((a) => (
                <article key={a.name} className="rounded-lg bg-panel p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink">{a.name}</span>
                    <span className="num text-xs text-mist">{a.pct}%</span>
                  </div>
                  <p className="mt-1 text-xs text-mist">{a.reason}</p>
                </article>
              ))}
            </div>
            <ul className="mt-4 space-y-1 text-xs text-mist">
              <li>Max risk per trade {pct(g.maxRisk * 100, 1).replace("+", "")}</li>
              <li>Drawdown pause {pct(g.drawdownPause * 100, 0).replace("+", "")}</li>
              <li>Every proposal hits a deterministic gate. Rejections are journaled.</li>
            </ul>
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

        {step === 3 && (
          <section className="panel p-6">
            <h1 className="text-2xl font-medium tracking-tight">Paper, not a promise</h1>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
              <li>This account is simulated. Fills are paper. Prices are live.</li>
              <li>AI can propose. The gate can say no. You can still skip or approve what it pauses.</li>
              <li>Kill switch docks the fleet instantly. Circuit breakers pause new risk.</li>
              <li>The journal is append-only. Rejections stay. Failures stay.</li>
              <li>
                Odds are a historical estimate, not a promise. Best year in the analog set: {pct(BEST_HISTORICAL_YEAR * 100, 0)}.
              </li>
            </ul>
            <div className="mt-6 rounded-lg bg-panel p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>{money(capital)} paper</Badge>
                <Badge tone="gold">{money(dest)} destination</Badge>
                <Badge>{months} months</Badge>
                <Badge tone="signal">{g.label}</Badge>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                variant="gold"
                size="lg"
                onClick={() => {
                  complete(cfg());
                  void navigate({ to: "/" });
                }}
              >
                Start the voyage
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
