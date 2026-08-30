import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IcBars } from "@/components/viz/ic-bars";
import { MonteCarloChart } from "@/components/viz/monte-carlo";
import { CandleChart } from "@/components/viz/candles";
import { useVoyage } from "@/lib/store";
import {
  REGIME,
  buildCandles,
  buildForecast,
  sampleOptionWatch,
  sampleScouts,
} from "@/lib/seed";
import { pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { arrivalOdds, monteCarloBand } from "@/lib/plan";
import { remainingMonths, targetOf } from "@/lib/voyage-math";
import { useMemo, useState } from "react";

export function ResearchWorkbench() {
  return (
    <Tabs defaultValue="radar">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="radar">Radar</TabsTrigger>
        <TabsTrigger value="compass">Compass</TabsTrigger>
        <TabsTrigger value="evolution">Evolution</TabsTrigger>
        <TabsTrigger value="mining">Mining</TabsTrigger>
      </TabsList>
      <TabsContent value="radar">
        <RadarTab />
      </TabsContent>
      <TabsContent value="compass">
        <CompassTab />
      </TabsContent>
      <TabsContent value="evolution">
        <EvolutionTab />
      </TabsContent>
      <TabsContent value="mining">
        <MiningTab />
      </TabsContent>
    </Tabs>
  );
}

function RadarTab() {
  const scouts = sampleScouts();
  const opts = sampleOptionWatch();
  const log = useVoyage((s) => s.log);
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel p-4">
        <div className="kicker">Scout candidates</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-md text-left text-sm">
            <thead className="text-xs text-mist">
              <tr className="border-b border-line">
                <th className="pb-2 font-medium">Symbol</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Why</th>
                <th className="pb-2 font-medium">Flavor</th>
              </tr>
            </thead>
            <tbody>
              {scouts.map((s) => (
                <tr key={s.id} className="border-b border-line/60 align-top">
                  <td className="py-2.5 pr-3 font-medium">{s.symbol}</td>
                  <td className="num py-2.5 pr-3 text-signal">{s.score}</td>
                  <td className="py-2.5 pr-3 text-xs text-mist">{s.why}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {s.flavors.map((f) => (
                        <Badge key={f}>{f}</Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex flex-col gap-3">
        <section className="panel p-4">
          <div className="kicker">Options watch · yields</div>
          <ul className="mt-3 space-y-3">
            {opts.map((o) => (
              <li key={o.id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink">{o.humanName}</span>
                  <span className="num text-xs text-teal">{pct(o.yield * 100)}</span>
                </div>
                <div className="text-2xs text-mist">
                  {o.dte} DTE · IV {(o.iv * 100).toFixed(0)}% · {o.note}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-4">
          <div className="kicker">Captain's log</div>
          {log.sentences.map((s) => (
            <p key={s} className="mt-2 text-sm text-ink">
              {s}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}

function CompassTab() {
  const voyage = useVoyage((s) => s.voyage);
  const advice = useVoyage((s) => s.advice);
  const adopt = useVoyage((s) => s.adoptAdvice);
  const dismiss = useVoyage((s) => s.dismissAdvice);
  const [open, setOpen] = useState(false);
  const monthsLeft = remainingMonths(voyage.startedAt, voyage.deadlineMonths);
  const target = targetOf(voyage);
  const band = useMemo(
    () => monteCarloBand(voyage.startingCapital, monthsLeft, voyage.temperament),
    [voyage, monthsLeft],
  );
  const candles = useMemo(() => buildCandles("SPY", 644.2), []);
  const forecast = useMemo(() => buildForecast(644.2), []);
  const families = [
    { name: "Core Trend", sharpe: 1.61, note: "Keeps edge in up × calm." },
    { name: "Drift Harvest", sharpe: 1.28, note: "IC holds; costs fine." },
    { name: "Scout Options", sharpe: 0.74, note: "IV rank too low. Stay docked." },
    { name: "Weather Floor", sharpe: 1.82, note: "Champion in this analog." },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">
            {REGIME.direction} × {REGIME.weather}
          </Badge>
          <span className="kicker">regime</span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Stat k="streak" v={`${REGIME.streak}d`} />
          <Stat k="vol" v={`${REGIME.volPct.toFixed(1)}%`} />
          <Stat k="breadth" v={pct(REGIME.breadth * 100, 0)} />
        </dl>
        <div className="mt-4">
          <button type="button" className="text-left" onClick={() => setOpen((o) => !o)}>
            <div className="kicker">AI hypothesis</div>
            <p className="mt-1 text-sm text-ink">
              Calm-up analog from 2017/2019 still fits. Do not add Friday hedges until Night Watch graduates.
            </p>
            {!open && <span className="text-xs text-signal">Expand</span>}
          </button>
          {open && (
            <p className="mt-2 text-xs leading-relaxed text-mist">
              Clamped: we do not extrapolate beyond the analog set. Breadth 62% is supportive, not euphoric.
              Weather score 74. Historical estimate, not a promise.
            </p>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {families.map((f) => (
            <div key={f.name} className="flex items-baseline justify-between rounded-md bg-panel px-3 py-2">
              <div>
                <div className="text-sm text-ink">{f.name}</div>
                <div className="text-2xs text-mist">{f.note}</div>
              </div>
              <div className="num text-xs text-mist">Sharpe {f.sharpe.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-col gap-3">
        <section className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kicker">Helm advice</div>
              <div className="mt-1 text-sm font-medium text-ink">{advice.title}</div>
              <p className="mt-1 text-xs text-mist">{advice.body}</p>
            </div>
            {advice.adopted === true && <Badge tone="teal">adopted</Badge>}
            {advice.adopted === false && <Badge>dismissed</Badge>}
          </div>
          {advice.adopted == null && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="teal" onClick={adopt}>
                Adopt
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          )}
        </section>
        <section className="panel p-4">
          <div className="kicker">TimesFM 5-day fan · SPY</div>
          <div className="mt-2 h-44">
            <CandleChart candles={candles} forecast={forecast} />
          </div>
          <p className="mt-2 text-2xs text-mist">
            Historical estimate, not a promise. Odds of voyage arrival{" "}
            {(
              arrivalOdds(voyage.startingCapital, target, monthsLeft, voyage.temperament) * 100
            ).toFixed(0)}
            %.
          </p>
        </section>
        <section className="panel hidden p-4 lg:block">
          <div className="kicker">Arrival band (remaining months)</div>
          <div className="h-36">
            <MonteCarloChart band={band} target={target} start={voyage.startingCapital} />
          </div>
        </section>
      </div>
    </div>
  );
}

function EvolutionTab() {
  const promotions = useVoyage((s) => s.promotions);
  const experiments = useVoyage((s) => s.experiments);
  const promote = useVoyage((s) => s.promote);
  const archive = useVoyage((s) => s.archivePromo);
  const live = promotions.filter((p) => p.status === "challenger");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {live.map((p) => (
          <article key={p.id} className="panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-ink">{p.name}</div>
              <Badge tone="gold">challenger</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat k="OOS Sharpe" v={p.oosSharpe.toFixed(2)} />
              <Stat k="max DD" v={pct(-p.maxDd * 100, 1)} />
              <Stat k="win" v={pct(p.winRate * 100, 0)} />
            </dl>
            <p className="mt-3 text-xs text-mist">{p.note}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="gold" onClick={() => promote(p.id)}>
                Promote
              </Button>
              <Button size="sm" variant="ghost" onClick={() => archive(p.id)}>
                Archive
              </Button>
            </div>
          </article>
        ))}
      </div>
      <section className="panel p-4">
        <div className="kicker">Weather-floor validation</div>
        <p className="mt-2 text-sm text-ink">
          2018 and 2022 analogs: overlay cut size within 4 sessions of stress above 0.62. Max DD 5.4% vs 11.8% without
          the floor. Study holds. Champion stays.
        </p>
      </section>
      <section className="panel p-4">
        <div className="kicker">Shipyard · DSL specs</div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-void p-3 text-xs text-mist">
{`strategy NightWatch v0.4
  when weekday=Fri and time>=14:30ET
    if weather.stress > 0.45: collar beta 1x
    else: stand down
  validate walk_forward 2016-2025
  status shipyard`}
        </pre>
      </section>
      <section className="panel overflow-x-auto p-4">
        <div className="kicker">Experiment lineage — including failures</div>
        <table className="mt-3 w-full min-w-lg text-left text-sm">
          <thead className="text-xs text-mist">
            <tr className="border-b border-line">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Family</th>
              <th className="pb-2 font-medium">Result</th>
              <th className="pb-2 font-medium">OOS Sharpe</th>
              <th className="pb-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((e) => (
              <tr key={e.id} className="border-b border-line/60">
                <td className="py-2 pr-3">{e.name}</td>
                <td className="py-2 pr-3 text-mist">{e.family}</td>
                <td className="py-2 pr-3">
                  <Badge
                    tone={
                      e.result === "promoted" ? "gold" : e.result === "failed" ? "coral" : e.result === "running" ? "signal" : "mist"
                    }
                  >
                    {e.result}
                  </Badge>
                </td>
                <td className="num py-2 pr-3">{e.oosSharpe.toFixed(2)}</td>
                <td className="py-2 text-xs text-mist">{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MiningTab() {
  const factors = useVoyage((s) => s.factors);
  const admit = useVoyage((s) => s.admitFactor);
  const dismiss = useVoyage((s) => s.dismissFactor);
  const pending = factors.filter((f) => f.pending);
  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="panel p-4">
        <div className="kicker">Factor IC</div>
        <div className="mt-4">
          <IcBars rows={factors} />
        </div>
      </section>
      <div className="flex flex-col gap-3">
        {pending.map((f) => (
          <article key={f.id} className="rounded-xl bg-night p-4 shadow-tone-amber">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-ink">{f.name}</div>
              <Badge tone="amber">mine</Badge>
            </div>
            <p className="mt-2 text-xs text-mist">
              Raw IC {f.ic.toFixed(3)} looks pretty. Deflated IC {f.deflatedIc.toFixed(3)} is the number that matters.
              Multiple-testing tax applied.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="teal" onClick={() => admit(f.id)}>
                Admit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(f.id)}>
                Dismiss
              </Button>
            </div>
          </article>
        ))}
        <section className="panel p-4">
          <div className="kicker">Admitted library</div>
          <ul className="mt-3 space-y-2">
            {factors
              .filter((f) => f.admitted)
              .map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span>{f.name}</span>
                  <Badge
                    tone={f.decay === "fresh" ? "teal" : f.decay === "aging" ? "amber" : "coral"}
                  >
                    {f.decay}
                  </Badge>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className={cn("num mt-0.5 text-sm text-ink")}>{v}</div>
    </div>
  );
}
