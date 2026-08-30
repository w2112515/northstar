import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useVoyage } from "@/lib/store";
import { dayHeading, dayKey, formatNyTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { JournalKind } from "@/lib/types";

export const Route = createFileRoute("/journal")({ component: JournalPage });

const KINDS: JournalKind[] = [
  "proposal",
  "verdict",
  "order",
  "fill",
  "pnl",
  "approval",
  "debate",
  "digest",
  "scout",
  "forecast",
  "experiment",
  "trace",
  "system",
];

const TONE: Partial<Record<JournalKind, "gold" | "teal" | "coral" | "amber" | "signal" | "mist">> = {
  proposal: "amber",
  verdict: "coral",
  fill: "teal",
  approval: "gold",
  forecast: "signal",
  debate: "gold",
  order: "signal",
  pnl: "teal",
  experiment: "mist",
  digest: "gold",
};

function JournalPage() {
  const journal = useVoyage((s) => s.journal);
  const [kind, setKind] = useState<JournalKind | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return journal.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (!needle) return true;
      return (
        e.title.toLowerCase().includes(needle) ||
        e.body.toLowerCase().includes(needle) ||
        e.kind.includes(needle)
      );
    });
  }, [journal, kind, q]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const k = dayKey(e.ts);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <AppShell>
      <div className="mb-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the log"
          aria-label="Search the log"
        />
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
          all
        </FilterChip>
        {KINDS.map((k) => (
          <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
            {k}
          </FilterChip>
        ))}
      </div>

      {groups.length === 0 ? (
        <section className="panel px-5 py-12 text-center">
          <div className="kicker">Day one</div>
          <p className="mx-auto mt-3 max-w-md text-sm text-mist">
            Nothing in the log yet besides what you just filtered out — or the book is cash and waiting for the
            open. Run a pass from the helm. Every proposal, verdict, and no from the gate will land here in plain
            English.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([k, rows]) => (
            <section key={k}>
              <div className="sticky top-14 z-10 mb-2 bg-void/90 py-1.5 backdrop-blur-sm">
                <h2 className="text-sm font-medium text-ink">{dayHeading(rows[0]!.ts)}</h2>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((e) => {
                  const expanded = open === e.id;
                  return (
                    <li key={e.id} className="panel overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
                        onClick={() => setOpen(expanded ? null : e.id)}
                      >
                        <span className="num mt-0.5 w-16 shrink-0 text-2xs text-mist">
                          {formatNyTime(e.ts)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge tone={TONE[e.kind] ?? "mist"}>{e.kind}</Badge>
                            {e.aiNarrated && <Badge tone="gold">AI</Badge>}
                            <span className="text-sm text-ink">{e.title}</span>
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-mist">{e.body}</span>
                        </span>
                      </button>
                      {expanded && (
                        <div className="border-t border-line bg-void/40 px-4 py-3">
                          <div className="kicker">Raw + lineage</div>
                          <pre className="mt-2 overflow-x-auto text-2xs leading-relaxed text-mist">
                            {JSON.stringify({ refs: e.refs, raw: e.raw, id: e.id, ts: e.ts }, null, 2)}
                          </pre>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3 text-xs transition-[color,background-color,box-shadow] duration-150 shadow-border",
        active ? "bg-panel text-ink" : "bg-night text-mist hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
