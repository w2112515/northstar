import { GoalOrbit } from "@/components/viz/goal-orbit";
import { Badge } from "@/components/ui/badge";
import { bookEquity, useVoyage } from "@/lib/store";
import { arrivalOdds } from "@/lib/plan";
import { formatNyTime, money } from "@/lib/format";
import { remainingMonths, targetOf } from "@/lib/voyage-math";

export function CockpitHero() {
  const voyage = useVoyage((s) => s.voyage);
  const cash = useVoyage((s) => s.cash);
  const positions = useVoyage((s) => s.positions);
  const oddsOverride = useVoyage((s) => s.oddsOverride);
  const equity = bookEquity(cash, positions);
  const monthsLeft = remainingMonths(voyage.startedAt, voyage.deadlineMonths);
  const odds =
    oddsOverride ??
    arrivalOdds(voyage.startingCapital, targetOf(voyage), monthsLeft, voyage.temperament);
  const target = targetOf(voyage);

  return (
    <section className="panel grid min-w-0 overflow-hidden lg:grid-cols-[minmax(15rem,0.3fr)_1fr]">
      <div className="flex flex-col justify-between gap-5 p-5">
        <div>
          <div className="kicker">Destination</div>
          <div className="mt-1.5 text-lg font-medium tracking-tight text-ink">{money(target)}</div>
          <p className="mt-1 text-2xs leading-relaxed text-mist">
            {money(voyage.startingCapital)} → {voyage.deadlineMonths} months. Paper book.
          </p>
        </div>
        <LogLine className="border-t border-line pt-3" />
      </div>
      <div className="min-h-48 min-w-0 overflow-hidden p-2 lg:min-h-72">
        <GoalOrbit start={voyage.startingCapital} equity={equity} target={target} odds={odds} />
      </div>
    </section>
  );
}

function LogLine({ className }: { className?: string }) {
  const log = useVoyage((s) => s.log);
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="kicker">Log</span>
        {log.aiNarrated ? <Badge tone="gold">fleet</Badge> : <Badge>system</Badge>}
        <span className="num ml-auto text-micro text-mist">{formatNyTime(log.ts)}</span>
      </div>
      <p className="mt-1 line-clamp-4 text-2xs leading-relaxed text-mist">{log.sentences.join(" ")}</p>
    </div>
  );
}
