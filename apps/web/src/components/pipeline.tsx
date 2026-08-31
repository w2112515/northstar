"use client";

/** The agent pipeline as a step list with status dots, satellite chips and
 *  the debate council - the Grok prototype's readable alternative to a flow
 *  graph. Live state comes from the real pass-progress feed; when idle, the
 *  last traced pass stays lit. AI advises (gold), code decides (signal). */

import { useEffect, useState } from "react";
import { fmtTs } from "@/lib/api";
import type { PassProgress, Trace } from "@/lib/types";

type StepId = "perceive" | "prefilter" | "triage" | "signals" | "compile_gate_execute" | "explain" | "record";

const FLOW: { id: StepId; label: string; kind: "code" | "ai" }[] = [
  { id: "perceive", label: "perceive", kind: "code" },
  { id: "prefilter", label: "guard", kind: "code" },
  { id: "triage", label: "triage", kind: "ai" },
  { id: "signals", label: "signals", kind: "code" },
  { id: "compile_gate_execute", label: "gate + execute", kind: "code" },
  { id: "explain", label: "explain", kind: "ai" },
  { id: "record", label: "record", kind: "code" },
];

const SATS: { id: string; label: string; kind: "code" | "ai"; near: StepId; note?: string }[] = [
  { id: "scout", label: "scout", kind: "code", near: "perceive" },
  { id: "weather", label: "weather", kind: "code", near: "triage" },
  { id: "timesfm", label: "TimesFM", kind: "ai", near: "signals" },
];

const COUNCIL = ["advocate", "critic", "judge"] as const;

const ORDER: StepId[] = FLOW.map((f) => f.id);

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Pipeline({
  trace,
  progress,
  scoutNote,
  weatherNote,
  forecastNote,
  debateLive,
}: {
  trace: Trace | null;
  progress: PassProgress | null;
  scoutNote: string | null;
  weatherNote: string | null;
  forecastNote: string | null;
  debateLive: boolean;
}) {
  // A hung pass stops producing new progress objects; while one is "running"
  // we re-render on a slow tick so the staleness guard can fire.
  const [, setStalenessTick] = useState(0);
  const running = progress?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setStalenessTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [running]);

  const live =
    !!progress &&
    progress.status === "running" &&
    // eslint-disable-next-line react-hooks/purity
    Date.now() - Date.parse(progress.ts) < 4 * 60_000;

  const activeIdx = live ? ORDER.indexOf(progress!.node as StepId) : -1;
  const traced = new Map((trace?.nodes ?? []).map((n) => [n.name, n.ms]));

  const stepState = (id: StepId): "current" | "done" | "off" => {
    if (live) {
      const idx = ORDER.indexOf(id);
      if (idx < activeIdx) return "done";
      if (idx === activeIdx) return "current";
      return "off";
    }
    return traced.has(id) ? "done" : "off";
  };

  const satNotes: Record<string, string | null | undefined> = {
    scout: scoutNote,
    weather: weatherNote,
    timesfm: forecastNote,
  };

  const facts = trace?.facts;

  return (
    <div className="flex h-full min-h-52 flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {SATS.map((s) => (
          <span
            key={s.id}
            title={satNotes[s.id] ?? undefined}
            // title alone is hover-only; expose the live note to AT too
            aria-label={satNotes[s.id] ? `${s.label}: ${satNotes[s.id]}` : undefined}
            className={cn(
              "rounded-sm bg-panel px-1.5 py-0.5 text-micro text-mist",
              satNotes[s.id] && (s.kind === "ai" ? "text-gold shadow-tone-gold" : "text-signal shadow-tone-signal"),
            )}
          >
            {s.label}
          </span>
        ))}
      </div>

      <ol className="relative flex-1 pl-4">
        <span className="absolute bottom-1.5 left-[5px] top-1.5 w-px bg-line" aria-hidden />
        {FLOW.map((n) => {
          const st = stepState(n.id);
          const on = st !== "off";
          return (
            <li key={n.id} className="relative flex items-center gap-2 py-1">
              <span
                className={cn(
                  "absolute -left-4 size-2.5 rounded-full",
                  on ? (n.kind === "ai" ? "bg-gold" : "bg-signal") : "bg-line",
                  st === "current" && "motion-safe:animate-pulse-node",
                )}
              />
              <span className={cn("text-xs", on ? "text-ink" : "text-mist")}>
                {n.label}
                {!live && traced.has(n.id) && (
                  <span className="ml-1.5 font-mono text-micro text-mist">
                    {traced.get(n.id)! >= 1000
                      ? `${(traced.get(n.id)! / 1000).toFixed(1)}s`
                      : `${Math.round(traced.get(n.id)!)}ms`}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "ml-auto text-micro font-medium uppercase tracking-wider",
                  n.kind === "ai" ? "text-gold" : "text-signal",
                  !on && "opacity-40",
                )}
              >
                {n.kind === "ai" ? "AI" : "CODE"}
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <div className="kicker mb-1">Debate council</div>
        <div className="flex flex-wrap gap-1">
          {COUNCIL.map((c) => (
            <span
              key={c}
              className={cn(
                "rounded-sm bg-panel px-1.5 py-0.5 text-micro",
                debateLive ? "text-gold shadow-tone-gold" : "text-mist",
              )}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {facts && (
        <p className="font-mono text-micro text-mist">
          Last pass{trace!.dry_run ? " (dry run)" : ""}: triage said{" "}
          <span className="text-ink">{facts.triage_mode ?? "—"}</span> · {facts.n_proposals}{" "}
          proposal(s) → {facts.n_executed} executed, {facts.n_exits} exit(s), {facts.n_rejected}{" "}
          blocked, {facts.n_needs_human} for you · {fmtTs(trace!.ts)}
        </p>
      )}
    </div>
  );
}
