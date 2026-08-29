"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { Card, Chip, EmptyState, SectionTitle } from "@/components/ui";

type JEvent = {
  id: string;
  ts: string;
  kind: string;
  human: string;
  payload: Record<string, unknown>;
  refs: Record<string, string>;
};

const KINDS = ["all", "proposal", "verdict", "order", "fill", "approval", "digest", "experiment", "system"];

const TONES: Record<string, "gold" | "teal" | "coral" | "blue" | "amber" | "line"> = {
  fill: "teal",
  order: "blue",
  verdict: "amber",
  digest: "gold",
  approval: "coral",
  experiment: "gold",
};

export default function Journal() {
  const [events, setEvents] = useState<JEvent[]>([]);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    apiGet<{ events: JEvent[] }>("/api/journal?limit=300")
      .then((r) => setEvents(r.events))
      .catch(() => setErr("API unreachable"));
  }, []);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (kind === "all" || e.kind === kind) &&
          (q === "" ||
            e.human.toLowerCase().includes(q.toLowerCase()) ||
            JSON.stringify(e.refs).toLowerCase().includes(q.toLowerCase())),
      ),
    [events, kind, q],
  );

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle sub="Append-only lineage: every proposal, every gate verdict (including rejections), every order and fill. Nothing is edited after the fact.">
          Voyage Journal
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                kind === k ? "border-gold bg-gold/15 text-gold" : "border-line text-muted hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
          <input
            placeholder="search text or id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ml-auto w-56 rounded-xl border border-line bg-surface2 px-3 py-1.5 text-xs outline-none focus:border-gold/60"
          />
        </div>
      </Card>

      {err && <EmptyState title={err} />}
      {!err && filtered.length === 0 && <EmptyState title="Nothing here yet" />}

      <div className="space-y-2">
        {filtered.map((e) => (
          <details key={e.id} className="group rounded-xl border border-line/60 bg-surface px-4 py-3">
            <summary className="flex cursor-pointer list-none items-start gap-3">
              <Chip tone={TONES[e.kind] ?? "line"}>{e.kind}</Chip>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{e.human || "(no summary)"}</p>
                <p className="mt-0.5 text-[10px] text-muted/70">
                  {new Date(e.ts).toLocaleString()} · {e.id}
                  {Object.entries(e.refs || {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <span key={k} className="ml-2 font-mono text-skyblue/80">
                        {k}={v}
                      </span>
                    ))}
                </p>
              </div>
              <span className="text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-night p-3 text-[11px] leading-relaxed text-muted">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
}
