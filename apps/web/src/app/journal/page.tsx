"use client";

/** Journal: the append-only record. Every proposal, every gate verdict
 *  (including rejections), every order and fill - grouped by day, expandable
 *  to raw JSON. Nothing is edited after the fact. */

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Check,
  DollarSign,
  FileText,
  FlaskConical,
  NotebookPen,
  Radar,
  ShieldCheck,
  TrendingUp,
  Waves,
} from "lucide-react";
import { fmtDay, fmtTs, fmtUsd } from "@/lib/api";
import { useApi } from "@/lib/data";
import { Badge, Button, Input, PageTitle, Panel, Skeleton, eventTone } from "@/components/ui";
import type { JEvent } from "@/lib/types";

const KIND_ICON: Record<string, typeof Check> = {
  proposal: FileText,
  verdict: ShieldCheck,
  order: ArrowRightLeft,
  fill: Check,
  pnl: DollarSign,
  approval: Bell,
  debate: Waves,
  digest: NotebookPen,
  scout: Radar,
  forecast: TrendingUp,
  experiment: FlaskConical,
  trace: Activity,
  system: Activity,
};

// Canonical filter order; kinds that only exist in the data get appended.
const KIND_ORDER = [
  "proposal", "verdict", "order", "fill", "pnl", "approval",
  "debate", "digest", "scout", "forecast", "experiment", "trace", "system",
];

function dayHeading(ts: string): string {
  const day = fmtDay(ts);
  const today = fmtDay(new Date().toISOString());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (day === today) return "Today";
  if (day === fmtDay(yest.toISOString())) return "Yesterday";
  return day;
}

export default function Journal() {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(300);

  const eventsQ = useApi<{ events: JEvent[] }>(`/api/journal?limit=${limit}`, 30000);
  const events = useMemo(() => eventsQ.data?.events ?? [], [eventsQ.data]);
  const loaded = eventsQ.data !== undefined || eventsQ.error !== undefined;
  const err = eventsQ.error ? "Can't reach the trading service - shown entries may be stale." : "";
  // A full page of results means older history exists.
  const maybeMore = events.length >= limit;

  const kinds = useMemo(() => {
    const present = new Set(events.map((e) => e.kind));
    const ordered = KIND_ORDER.filter((k) => present.has(k));
    for (const k of present) if (!ordered.includes(k)) ordered.push(k);
    return ["all", ...ordered];
  }, [events]);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (kind === "all" || e.kind === kind) &&
          (q === "" ||
            e.human.toLowerCase().includes(q.toLowerCase()) ||
            JSON.stringify(e.refs ?? {}).toLowerCase().includes(q.toLowerCase()) ||
            JSON.stringify(e.payload ?? {}).toLowerCase().includes(q.toLowerCase())),
      ),
    [events, kind, q],
  );

  // The record's basic unit is the day. Group by market-time date, keeping
  // the API's (newest-first) order inside each day.
  const dayGroups = useMemo(() => {
    const groups: [string, JEvent[]][] = [];
    const byDay = new Map<string, JEvent[]>();
    for (const e of filtered) {
      const day = fmtDay(e.ts);
      const bucket = byDay.get(day);
      if (bucket) bucket.push(e);
      else {
        byDay.set(day, [e]);
        groups.push([day, byDay.get(day)!]);
      }
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PageTitle
        title="Journal"
        sub="Append-only. Every proposal, every gate verdict - including rejections - every order and fill. Nothing is edited after the fact."
      />

      {err && (
        <div className="rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber">
          {err}
        </div>
      )}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the record - text, id, or payload"
        label="Search the record"
      />
      <div className="flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`h-9 rounded-full px-3 text-xs shadow-border transition-[color,background-color,box-shadow] duration-150 ${
              kind === k ? "bg-panel text-ink" : "bg-night text-mist hover:text-ink"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {!loaded ? (
        <Panel className="p-5">
          <Skeleton rows={8} />
        </Panel>
      ) : dayGroups.length === 0 ? (
        <Panel className="px-5 py-12 text-center">
          <div className="kicker">{events.length === 0 ? "Day one" : "No matches"}</div>
          <p className="mx-auto mt-3 max-w-md text-sm text-mist">
            {events.length === 0
              ? "Nothing on record yet. Run a pass from the controls strip - every proposal, verdict, and no from the gate will land here in plain English."
              : "Nothing matches this filter. Try another kind or clear the search."}
          </p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          {dayGroups.map(([day, rows]) => {
            // Day net: sum realized P&L events when they carry amounts.
            let net = 0;
            let hasNet = false;
            for (const e of rows) {
              if (e.kind !== "pnl") continue;
              const v = Number(e.payload?.realized ?? e.payload?.pnl ?? e.payload?.value ?? NaN);
              if (Number.isFinite(v)) {
                net += v;
                hasNet = true;
              }
            }
            return (
            <section key={day}>
              <div className="sticky top-14 z-10 mb-2 flex items-baseline justify-between bg-void/90 py-1.5 backdrop-blur-sm">
                <h2 className="text-sm font-medium text-ink">{dayHeading(rows[0]!.ts)}</h2>
                <span className="num text-micro text-mist">
                  {rows.length} entr{rows.length === 1 ? "y" : "ies"}
                  {hasNet && (
                    <span className={net >= 0 ? "text-teal" : "text-coral"}>
                      {" · net "}
                      {net >= 0 ? "+" : ""}
                      {fmtUsd(net)}
                    </span>
                  )}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((e) => {
                  const expanded = open === e.id;
                  const Icon = KIND_ICON[e.kind] ?? Activity;
                  return (
                    <li key={e.id} className="panel overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
                        onClick={() => setOpen(expanded ? null : e.id)}
                        aria-expanded={expanded}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-panel text-mist">
                          <Icon className="size-3.5" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge tone={eventTone(e)}>{e.kind}</Badge>
                            <span className="text-sm text-ink">{e.human || "(no summary)"}</span>
                          </span>
                        </span>
                        <span className="num ml-auto mt-0.5 shrink-0 text-2xs text-mist">
                          {fmtTs(e.ts)}
                        </span>
                      </button>
                      {expanded && (
                        <div className="border-t border-line bg-void/40 px-4 py-3">
                          <div className="kicker">Raw + lineage</div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-2xs text-mist">
                            <span>{e.id}</span>
                            {Object.entries(e.refs || {})
                              .filter(([, v]) => v)
                              .map(([k, v]) => (
                                <span key={k} className="text-signal">
                                  {k}={v}
                                </span>
                              ))}
                          </div>
                          <pre className="mt-2 max-h-72 overflow-x-auto text-2xs leading-relaxed text-mist">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
            );
          })}
        </div>
      )}

      {loaded && maybeMore && (
        <div className="text-center">
          <Button variant="ghost" onClick={() => setLimit((n) => n + 500)}>
            Load older entries (showing {events.length})
          </Button>
        </div>
      )}
    </div>
  );
}
