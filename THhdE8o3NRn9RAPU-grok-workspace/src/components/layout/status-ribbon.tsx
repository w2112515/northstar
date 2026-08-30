import { useEffect, useState } from "react";
import { useVoyage, bookEquity } from "@/lib/store";
import { arrivalOdds } from "@/lib/plan";
import { formatNyClock, money, pct, nySessionLabel } from "@/lib/format";
import { resolveMarketOpen } from "@/lib/market-hours";
import { Sparkline } from "@/components/viz/sparkline";
import { sampleSpark } from "@/lib/seed";
import { PaperBadge } from "@/components/marks";
import { REGIME } from "@/lib/seed";
import { cn } from "@/lib/cn";
import { remainingMonths, monthsElapsed, targetOf } from "@/lib/voyage-math";
import { Helm } from "@/components/cockpit/helm";

const TITLES: Record<string, string> = {
  "/": "Cockpit",
  "/research": "Research",
  "/strategies": "Strategies",
  "/journal": "Journal",
};

export function StatusRibbon({ pathname }: { pathname: string }) {
  const voyage = useVoyage((s) => s.voyage);
  const cash = useVoyage((s) => s.cash);
  const positions = useVoyage((s) => s.positions);
  const todayPct = useVoyage((s) => s.todayPct);
  const oddsOverride = useVoyage((s) => s.oddsOverride);
  const marketOverride = useVoyage((s) => s.marketOverride);
  const equity = bookEquity(cash, positions);
  const target = targetOf(voyage);
  const odds =
    oddsOverride ??
    arrivalOdds(
      voyage.startingCapital,
      target,
      remainingMonths(voyage.startedAt, voyage.deadlineMonths),
      voyage.temperament,
    );
  const open = resolveMarketOpen(marketOverride);
  const elapsed = monthsElapsed(voyage.startedAt);
  const [clock, setClock] = useState<string>("");
  const title = TITLES[pathname] ?? "NorthStar";

  useEffect(() => {
    const tick = () => setClock(formatNyClock());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-night/95 backdrop-blur-sm">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 md:px-4">
        <span className="kicker hidden shrink-0 md:inline">{title}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="num text-sm text-ink">{money(equity)}</span>
            <Sparkline
              data={voyage.firstDay ? [voyage.startingCapital, equity] : sampleSpark}
              className={cn("hidden h-4 w-12 sm:block", todayPct >= 0 ? "text-teal" : "text-coral")}
            />
            <span className={cn("num text-xs", todayPct >= 0 ? "text-teal" : "text-coral")}>
              {pct(todayPct)}
            </span>
          </div>
          <span className="hidden h-3 w-px bg-line sm:block" />
          <div className="flex items-baseline gap-1.5">
            <span className="kicker">odds</span>
            <span className="num text-sm text-gold">{(odds * 100).toFixed(0)}%</span>
          </div>
          <div className="hidden items-baseline gap-1.5 sm:flex">
            <span className="kicker">voyage</span>
            <span className="num text-sm">
              {Math.min(elapsed + 1, voyage.deadlineMonths)}/{voyage.deadlineMonths}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", open ? "bg-teal" : "bg-coral")} />
            <span className="text-xs text-mist">{nySessionLabel(open)}</span>
          </div>
          <div className="hidden items-baseline gap-1.5 lg:flex">
            <span className="kicker">wx</span>
            <span className="num text-sm">{REGIME.weatherScore}</span>
            <span className="text-xs text-mist">
              {REGIME.direction}·{REGIME.weather}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {clock ? <span className="num hidden text-xs text-mist sm:inline">{clock}</span> : null}
          <PaperBadge className="shrink-0" />
        </div>
      </div>
      {pathname === "/" && <Helm />}
    </div>
  );
}
