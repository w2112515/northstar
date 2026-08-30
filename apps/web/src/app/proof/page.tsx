"use client";

/** Proof - the trust page. The append-only ledger with verdict stamps, the
 *  forecast scorecard (predictions graded against reality), gate rejection
 *  statistics, and the AI debate record. Nothing is edited after the fact. */

import { useMemo, useState } from "react";
import { apiPost, fmtDay, fmtTs } from "@/lib/api";
import { useApi } from "@/lib/data";
import { EmptyState, PageHeader, Section, Skeleton, Stamp, eventStamp } from "@/components/ui";
import { DebatePanel, ForecastFan } from "@/components/schematic";
import type { Debate, ForecastDoc, ForecastSkill, JEvent } from "@/lib/types";

// Canonical filter order; kinds that only exist in the data get appended.
const KIND_ORDER = [
  "proposal", "verdict", "order", "fill", "pnl", "approval",
  "debate", "digest", "scout", "forecast", "experiment", "trace", "system",
];

export default function Proof() {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(300);

  const eventsQ = useApi<{ events: JEvent[] }>(`/api/journal?limit=${limit}`, 30000);
  const events = useMemo(() => eventsQ.data?.events ?? [], [eventsQ.data]);
  const loaded = eventsQ.data !== undefined || eventsQ.error !== undefined;
  const err = eventsQ.error ? "Can't reach the trading service - shown entries may be stale." : "";
  // The API returns up to `limit` entries; a full page means older history exists.
  const maybeMore = events.length >= limit;

  const forecastQ = useApi<{
    forecast: ForecastDoc | null;
    available: boolean;
    skill: ForecastSkill;
  }>("/api/forecast", 60000);
  const skill = forecastQ.data?.skill ?? null;

  const debateQ = useApi<{ events: JEvent[] }>("/api/journal?kinds=debate&limit=1", 60000);
  const debateEv = debateQ.data?.events[0];
  const debate = debateEv
    ? { payload: debateEv.payload as unknown as Debate, ts: debateEv.ts }
    : null;

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

  // A ledger's basic unit is the day. Group by market-time date, keeping the
  // API's (newest-first) order inside each day.
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

  // Gate statistics: why does the gate say no? Only true rejections count -
  // needs_human holds carry reason codes too, and they are not rejections.
  const gateStats = useMemo(() => {
    const counts = new Map<string, number>();
    let rejections = 0;
    for (const e of events) {
      if (e.kind !== "verdict") continue;
      const p = e.payload ?? {};
      if (p.verdict !== "rejected") continue;
      const codes =
        (p.reason_codes as string[] | undefined) ?? (p.reasons as string[] | undefined) ?? [];
      rejections += 1;
      for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { rejections, rows };
  }, [events]);

  async function refreshForecast() {
    setBusy(true);
    try {
      await apiPost("/api/engine/forecast", {});
      window.dispatchEvent(new Event("northstar:refresh"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proof"
        sub="Every proposal, every gate verdict (including rejections), every order and fill - on record, unedited."
      />

      {err && (
        <div className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 text-body text-amber">
          {err}
        </div>
      )}

      {/* --------------------------------------------------------- ledger */}
      <Section title="The ledger" hint={loaded ? `${filtered.length} entries` : undefined}>
        <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-1.5">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`-mb-[7px] border-b-2 px-1.5 py-0.5 font-mono text-micro uppercase tracking-wide transition-colors ${
                kind === k
                  ? "border-indigo font-semibold text-ink"
                  : "border-transparent text-ink2 hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
          <input
            placeholder="search text, id or payload…"
            aria-label="Search ledger entries"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ml-auto w-56 rounded-lg border border-hairline bg-inset px-3 py-1.5 font-mono text-body"
          />
        </div>

        {!loaded ? (
          <Skeleton rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={events.length === 0 ? "The ledger is empty" : "No entries match this filter"}
            body={
              events.length === 0
                ? "Run a pass from Activity and every step will be recorded here."
                : "Try another kind or clear the search."
            }
          />
        ) : (
          dayGroups.map(([day, evs]) => (
            <div key={day} className="mb-5">
              <div className="sticky top-12 z-10 flex items-baseline justify-between border-b border-hairline bg-paper/95 py-1.5 backdrop-blur-sm">
                <h3 className="font-mono text-micro font-semibold uppercase tracking-[0.14em] text-ink2">
                  {day}
                </h3>
                <span className="font-mono text-micro text-ink2">
                  {evs.length} entr{evs.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <div>
                {evs.map((e) => {
                  const s = eventStamp(e);
                  return (
                    <details key={e.id} className="group border-b border-hairline/60">
                      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-2">
                        <span className="w-24 shrink-0">
                          <Stamp tone={s.tone}>{s.label}</Stamp>
                        </span>
                        <p className="min-w-0 flex-1 text-body leading-snug">{e.human || "(no summary)"}</p>
                        <span className="shrink-0 font-mono text-micro tabular-nums text-ink2">
                          {fmtTs(e.ts)}
                        </span>
                        <span className="shrink-0 text-ink2 transition-transform group-open:rotate-90">›</span>
                      </summary>
                      <div className="pb-3 pl-[108px]">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-micro text-ink2">
                          <span>{e.id}</span>
                          {Object.entries(e.refs || {})
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                              <span key={k} className="text-indigo/80">
                                {k}={v}
                              </span>
                            ))}
                        </div>
                        <pre className="panel-inset mt-2 max-h-72 overflow-auto p-3 font-mono text-micro leading-relaxed text-ink2">
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {loaded && maybeMore && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setLimit((n) => n + 500)}
              className="rounded-lg border border-hairline px-4 py-2 font-mono text-micro text-ink2 transition-colors hover:border-ink/40 hover:text-ink"
            >
              Load older entries (showing {events.length})
            </button>
          </div>
        )}
      </Section>

      {/* ---------------------------------------------- forecast scorecard */}
      <Section
        title="Forecast scorecard"
        info="TimesFM draws q10-q90 bands for the next 5 sessions. Every forecast is snapshotted and graded against what actually happened: band coverage (should catch ~80% of outcomes) and pinball loss per quantile. The grade is shown especially when it is unflattering."
      >
        {skill && skill.n_checks ? (
          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                q10–q90 coverage
              </div>
              <div
                className={`font-mono text-display font-semibold tabular-nums ${
                  (skill.coverage_q10_q90 ?? 0) >= 0.7
                    ? "text-green"
                    : (skill.coverage_q10_q90 ?? 0) >= 0.5
                      ? "text-amber"
                      : "text-red"
                }`}
              >
                {skill.coverage_q10_q90 != null ? `${(skill.coverage_q10_q90 * 100).toFixed(0)}%` : "—"}
              </div>
              <div className="font-mono text-micro text-ink2">target ~80%</div>
            </div>
            <div>
              <div className="font-mono text-micro uppercase tracking-[0.12em] text-ink2">checks</div>
              <div className="font-mono text-display font-semibold tabular-nums">{skill.n_checks}</div>
            </div>
            {skill.pinball_q50_pct != null && (
              <div>
                <div className="font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  median-line pinball
                </div>
                <div className="font-mono text-display font-semibold tabular-nums">
                  {skill.pinball_q50_pct.toFixed(2)}%
                </div>
                <div className="font-mono text-micro text-ink2">of price</div>
              </div>
            )}
          </div>
        ) : (
          <p className="mb-4 font-mono text-micro text-ink2">
            No grades yet - forecasts are graded nightly once realized closes exist.
          </p>
        )}
        <ForecastFan
          doc={forecastQ.data?.forecast ?? null}
          available={forecastQ.data?.available ?? false}
          busy={busy}
          onRefresh={refreshForecast}
        />
      </Section>

      {/* ------------------------------------------------------ gate stats */}
      {gateStats.rows.length > 0 && (
        <Section
          title="Gate rejections, by reason"
          hint={`${gateStats.rejections} on record`}
          info="Rejections are first-class records: the gate's 'no' is as much evidence as its 'yes'."
        >
          <table className="w-full max-w-2xl text-body">
            <tbody>
              {gateStats.rows.map(([code, n]) => (
                <tr key={code} className="border-b border-hairline/60">
                  <td className="py-1.5 font-mono text-body">{code.replace(/_/g, " ")}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-ink2">×{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ---------------------------------------------------------- debate */}
      <Section
        title="Latest debate"
        info="Disagree-or-Commit: an AI advocate argues the trade, an AI critic attacks it with fresh headlines the advocate never saw, and deterministic code judges the outcome before anything may reach the risk gate."
      >
        {debateQ.error ? (
          <p className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 font-mono text-micro text-amber">
            Debate record unreachable - data may be stale.
          </p>
        ) : debate ? (
          <DebatePanel debate={debate.payload} ts={debate.ts} />
        ) : (
          <EmptyState
            title="No debate on record"
            body="When the AI analyst proposes a trade, the advocate-versus-critic record lands here."
          />
        )}
      </Section>
    </div>
  );
}
