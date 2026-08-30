import { useVoyage } from "@/lib/store";
import { formatNyTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { JournalKind } from "@/lib/types";

const TONE: Partial<Record<JournalKind, "gold" | "teal" | "coral" | "amber" | "signal" | "mist">> = {
  proposal: "amber",
  verdict: "coral",
  fill: "teal",
  approval: "gold",
  forecast: "signal",
  debate: "gold",
  order: "signal",
  pnl: "teal",
};

export function LiveFeed() {
  const journal = useVoyage((s) => s.journal);
  const items = journal.slice(0, 8);
  return (
    <section className="panel min-w-0 p-4">
      <div className="kicker">Live feed</div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-mist">Quiet. The first pass will write here.</p>
      ) : (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {items.map((ev, i) => (
            <li
              key={ev.id}
              className="animate-feed-in flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <Badge tone={TONE[ev.kind] ?? "mist"}>{ev.kind}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-ink">{ev.title}</span>
              <span className="num shrink-0 text-micro text-mist">{formatNyTime(ev.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
