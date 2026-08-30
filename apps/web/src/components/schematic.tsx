"use client";

/** Evidence-layer agent visuals: the live run schematic (the real ADK
 *  workflow, drawn as a lab schematic), the AI debate record, and the
 *  TimesFM forecast fan. Light ledger styling; AI attribution is
 *  typographic (serif italic "Ai" tag), never a color. */

import { useEffect, useMemo, useState } from "react";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtTs } from "@/lib/api";
import { AXIS_TICK, CHART, RECHARTS_TOOLTIP } from "@/lib/theme";
import { Button, FieldNote, Stamp } from "@/components/ui";
import type { Debate, ForecastDoc, PassProgress, Trace } from "@/lib/types";

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

// ------------------------------------------------------- live run schematic

const MAIN_ORDER = [
  "perceive", "prefilter", "triage", "signals", "compile_gate_execute", "explain", "record",
] as const;

type StageStatus = "running" | "done" | "pending" | "idle";

type StageData = {
  label: string;
  sub: string;
  tag?: "CODE" | "AI";
  status: StageStatus;
};

const STATUS_CLASS: Record<StageStatus, string> = {
  running: "border-indigo bg-indigo/5",
  done: "border-ink/30 bg-raised",
  pending: "border-hairline bg-raised opacity-50",
  idle: "border-hairline bg-raised opacity-70",
};

function StageNode({ data }: NodeProps) {
  const d = data as StageData;
  const hidden = "!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";
  // Handle ids are typed: source handles on r/b/sl, target handles on
  // l/t/bt/tr. Edges must reference a handle of the matching type or xyflow
  // silently drops them.
  return (
    <div className={`w-48 rounded-sm border px-3 py-2 transition-colors duration-150 ${STATUS_CLASS[d.status]}`}>
      <Handle type="target" position={Position.Left} id="l" className={hidden} />
      <Handle type="target" position={Position.Top} id="t" className={hidden} />
      <Handle type="target" position={Position.Bottom} id="bt" className={hidden} />
      <Handle type="target" position={Position.Right} id="tr" className={hidden} />
      <Handle type="source" position={Position.Right} id="r" className={hidden} />
      <Handle type="source" position={Position.Bottom} id="b" className={hidden} />
      <Handle type="source" position={Position.Left} id="sl" className={hidden} />
      <div className="flex items-center gap-1.5 text-body font-medium text-ink">
        {d.status === "running" && (
          <span className="h-1.5 w-1.5 bg-indigo" />
        )}
        <span className="truncate">{d.label}</span>
        {d.tag && (
          <span
            className={`ml-auto shrink-0 text-micro font-bold tracking-wide ${
              d.tag === "AI" ? "font-serif italic text-ink" : "font-mono text-ink2"
            }`}
          >
            {d.tag === "AI" ? "Ai" : "CODE"}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate font-mono text-micro tabular-nums text-ink2">{d.sub}</div>
    </div>
  );
}

const NODE_TYPES = { stage: StageNode };

// Serpentine layout: satellites on top, the loop reads left-to-right across
// two legs, the debate council sits on the bottom row. Span is 992x410, so
// the min-w-880 container keeps fitView labels at ~11px.
const POS: Record<string, { x: number; y: number }> = {
  scout: { x: 0, y: 0 },
  weather: { x: 480, y: 0 },
  timesfm: { x: 720, y: 0 },
  perceive: { x: 0, y: 110 },
  prefilter: { x: 240, y: 110 },
  triage: { x: 480, y: 110 },
  signals: { x: 720, y: 110 },
  compile_gate_execute: { x: 0, y: 230 },
  explain: { x: 240, y: 230 },
  record: { x: 480, y: 230 },
  judge: { x: 240, y: 352 },
  advocate: { x: 520, y: 352 },
  critic: { x: 800, y: 352 },
};

const NODE_W = 192;
const NODE_H = 56;

const EDGE_BASE = { type: "default" as const };
const ARROW = (color: string) => ({
  markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color },
});

export function RunSchematic({
  trace,
  progress,
  debate,
  weatherBucket,
  forecastNote,
  scoutNote,
}: {
  trace: Trace | null;
  progress: PassProgress | null;
  debate: Debate | null;
  weatherBucket: string | null | undefined;
  forecastNote: string | null;
  scoutNote: string | null;
}) {
  // Freshness check reads the wall clock on purpose: progress polls every 3s,
  // so each poll re-render re-evaluates whether the pass went stale. A hung
  // pass stops producing new progress objects, so while one is "running" we
  // also re-render on a slow tick to let the staleness guard fire.
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
  const liveIdx = live ? MAIN_ORDER.indexOf(progress.node as (typeof MAIN_ORDER)[number]) : -1;
  const traced = useMemo(
    () => new Map((trace?.nodes ?? []).map((n) => [n.name, n.ms])),
    [trace],
  );

  const mainStatus = (name: string, idx: number): StageStatus => {
    if (live) return idx < liveIdx ? "done" : idx === liveIdx ? "running" : "pending";
    if (!trace) return "idle";
    return traced.has(name) ? "done" : "pending";
  };
  const mainSub = (name: string, status: StageStatus, fallback: string) => {
    if (status === "running") return "running…";
    if (!live && traced.has(name)) return fmtMs(traced.get(name)!);
    return fallback;
  };

  const llmUsed = (name: string) =>
    name === "triage" ? !!trace?.facts.triage_llm : name === "explain" ? !!trace?.facts.digest_llm : false;

  const outcomeShort: Record<Debate["outcome"], string> = {
    committed: "committed",
    committed_with_caveat: "caveat haircut",
    dropped_objection: "trade dropped",
    dropped_unreviewed: "dropped (offline)",
  };

  const nodes: Node[] = useMemo(() => {
    const mains: Record<string, { label: string; sub: string; tag?: "CODE" | "AI" }> = {
      perceive: { label: "Perceive", sub: "account · positions · plan", tag: "CODE" },
      prefilter: { label: "Guard", sub: "kill switch · breaker", tag: "CODE" },
      triage: { label: "Triage", sub: "act or observe" },
      signals: { label: "Signals", sub: "6 strategies + analyst", tag: "CODE" },
      compile_gate_execute: { label: "Gate + Execute", sub: "12 hard checks", tag: "CODE" },
      explain: { label: "Explain", sub: "plain-words digest" },
      record: { label: "Record", sub: "journal · trace" },
    };
    const out: Node[] = MAIN_ORDER.map((name, idx) => {
      const status = mainStatus(name, idx);
      const base = mains[name];
      const isLlm = name === "triage" || name === "explain";
      return {
        id: name,
        type: "stage",
        position: POS[name],
        width: NODE_W,
        height: NODE_H,
        data: {
          ...base,
          sub: mainSub(name, status, base.sub),
          tag: isLlm ? (llmUsed(name) ? "AI" : undefined) : base.tag,
          status,
        } satisfies StageData,
      };
    });
    out.push(
      {
        id: "scout",
        type: "stage",
        position: POS.scout,
        width: NODE_W,
        height: NODE_H,
        data: {
          label: "Scout",
          sub: scoutNote ?? "no scan yet",
          tag: "CODE",
          status: scoutNote ? "done" : "idle",
        } satisfies StageData,
      },
      {
        id: "weather",
        type: "stage",
        position: POS.weather,
        width: NODE_W,
        height: NODE_H,
        data: {
          label: "Weather feed",
          sub: weatherBucket ? `regime: ${weatherBucket}` : "no reading yet",
          tag: "CODE",
          status: weatherBucket ? "done" : "idle",
        } satisfies StageData,
      },
      {
        id: "timesfm",
        type: "stage",
        position: POS.timesfm,
        width: NODE_W,
        height: NODE_H,
        data: {
          label: "TimesFM",
          sub: forecastNote ?? "no forecast yet",
          tag: "AI",
          status: forecastNote ? "done" : "idle",
        } satisfies StageData,
      },
      {
        id: "advocate",
        type: "stage",
        position: POS.advocate,
        width: NODE_W,
        height: NODE_H,
        data: {
          label: "Advocate",
          sub: debate ? `${debate.symbol} · ${Math.round(debate.bull.confidence * 100)}% bull` : "waits for analyst",
          tag: "AI",
          status: debate ? "done" : "idle",
        } satisfies StageData,
      },
      {
        id: "critic",
        type: "stage",
        position: POS.critic,
        width: NODE_W,
        height: NODE_H,
        data: {
          label: "Critic",
          sub: debate ? `${debate.bear.verdict} · ${Math.round(debate.bear.confidence * 100)}%` : "red-team attack",
          tag: "AI",
          status: debate ? "done" : "idle",
        } satisfies StageData,
      },
      {
        id: "judge",
        type: "stage",
        position: POS.judge,
        width: NODE_W,
        height: NODE_H,
        data: {
          label: "Judge",
          sub: debate ? outcomeShort[debate.outcome] ?? debate.outcome : "disagree-or-commit",
          tag: "CODE",
          status: debate ? "done" : "idle",
        } satisfies StageData,
      },
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, progress, debate, weatherBucket, forecastNote, scoutNote, live, liveIdx, traced]);

  const edges: Edge[] = useMemo(() => {
    const grey = CHART.hairline;
    const faint = CHART.ink2;
    const active = CHART.indigo;
    // The loop snakes onto a second leg after "signals": that hop leaves the
    // bottom of signals and enters the top of the gate on the row below.
    const CHAIN_HANDLES: Record<string, { sh: string; th: string }> = {
      "signals-compile_gate_execute": { sh: "b", th: "t" },
    };
    const chain: Edge[] = MAIN_ORDER.slice(0, -1).map((name, i) => {
      const next = MAIN_ORDER[i + 1];
      const isActive = live && MAIN_ORDER.indexOf(progress!.node as never) === i + 1;
      const handles = CHAIN_HANDLES[`${name}-${next}`] ?? { sh: "r", th: "l" };
      // no marching-dash animation: the indigo stroke carries the live state,
      // and the ledger's motion contract forbids perpetual animation
      return {
        id: `${name}-${next}`,
        source: name,
        target: next,
        sourceHandle: handles.sh,
        targetHandle: handles.th,
        style: { stroke: isActive ? active : grey, strokeWidth: isActive ? 2 : 1.2 },
        ...EDGE_BASE,
        ...ARROW(isActive ? active : grey),
      };
    });
    const dashed = (id: string, source: string, target: string, sh: string, th: string, color: string): Edge => ({
      id,
      source,
      target,
      sourceHandle: sh,
      targetHandle: th,
      style: { stroke: color, strokeDasharray: "5 4", strokeWidth: 1.1 },
      ...EDGE_BASE,
      ...ARROW(color),
    });
    return [
      ...chain,
      dashed("scout-perceive", "scout", "perceive", "b", "t", faint),
      dashed("weather-signals", "weather", "signals", "b", "t", faint),
      dashed("timesfm-signals", "timesfm", "signals", "b", "t", faint),
      dashed("signals-advocate", "signals", "advocate", "b", "t", grey),
      dashed("signals-critic", "signals", "critic", "b", "t", grey),
      {
        id: "advocate-critic",
        source: "advocate",
        target: "critic",
        sourceHandle: "r",
        targetHandle: "l",
        label: "debate",
        labelStyle: { fontSize: 11, fill: CHART.ink2 },
        labelBgStyle: { fill: CHART.paper, fillOpacity: 0.9 },
        style: { stroke: faint, strokeDasharray: "4 3", strokeWidth: 1.1, opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: faint },
        markerStart: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: faint },
        ...EDGE_BASE,
      },
      // cross-row edges use the source-left / target-right handles
      dashed("advocate-judge", "advocate", "judge", "sl", "tr", grey),
      dashed("critic-judge", "critic", "judge", "b", "bt", grey),
      dashed("judge-gate", "judge", "compile_gate_execute", "sl", "bt", faint),
    ];
  }, [live, progress]);

  const facts = trace?.facts;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-micro text-ink2">
        <span>AI advises (Ai) · code decides (CODE)</span>
        {live && (
          <Stamp tone="indigo">pass running · {progress!.reason}</Stamp>
        )}
      </div>
      {/* Small screens scroll the schematic horizontally at a readable zoom
          instead of shrinking 960px of graph into ant-sized labels. */}
      <div className="overflow-x-auto border border-hairline bg-inset">
        <div className="h-[340px] min-w-[880px] sm:h-[400px] [&_.react-flow__attribution]:!bg-transparent [&_.react-flow__attribution]:!text-micro [&_.react-flow__attribution]:!text-ink2">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.04 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            panOnDrag={false}
            panOnScroll={false}
            preventScrolling={false}
            style={{ background: "transparent" }}
          />
        </div>
      </div>
      {facts && (
        <p className="mt-2 font-mono text-micro text-ink2">
          Last pass{trace!.dry_run ? " (dry run)" : ""}: triage said{" "}
          <span className="text-ink">{facts.triage_mode ?? "—"}</span> · {facts.n_proposals}{" "}
          proposal(s) → {facts.n_executed} executed, {facts.n_exits} exit(s), {facts.n_rejected}{" "}
          blocked, {facts.n_needs_human} for you · {fmtTs(trace!.ts)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- AI debate

const OUTCOME_STAMP: Record<Debate["outcome"], { label: string; tone: "green" | "amber" | "red" }> = {
  committed: { label: "committed", tone: "green" },
  committed_with_caveat: { label: "committed with caveat", tone: "amber" },
  dropped_objection: { label: "dropped - critic won", tone: "red" },
  dropped_unreviewed: { label: "dropped - critic offline", tone: "red" },
};

export function DebatePanel({ debate, ts }: { debate: Debate | null; ts?: string }) {
  if (!debate) return null;
  const outcome = OUTCOME_STAMP[debate.outcome] ?? { label: debate.outcome, tone: "amber" as const };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-body font-medium">{debate.symbol}</span>
        <Stamp tone={debate.direction === "bullish" ? "green" : "red"}>{debate.direction}</Stamp>
        <Stamp tone={outcome.tone}>{outcome.label}</Stamp>
        {ts && <span className="font-mono text-micro text-ink2">{fmtTs(ts)}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldNote by="gemini · advocate" meta={`confidence ${Math.round(debate.bull.confidence * 100)}%`}>
          {debate.bull.thesis}
        </FieldNote>
        <FieldNote
          by="gemini · critic"
          meta={`${debate.bear.verdict} · ${Math.round(debate.bear.confidence * 100)}%`}
        >
          {debate.bear.objection || "Conceded: the trade survives my best attack."}
        </FieldNote>
      </div>
      {(debate.headlines?.length ?? 0) > 0 && (
        <div className="mt-3 border border-hairline bg-inset px-3 py-2.5">
          <div className="mb-1 font-mono text-micro font-semibold uppercase tracking-[0.12em] text-ink2">
            Fresh headlines the critic saw (advocate didn&apos;t)
          </div>
          <ul className="space-y-0.5 text-micro leading-snug text-ink2">
            {debate.headlines!.map((h, i) => (
              <li key={i} className="truncate" title={h}>
                · {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- TimesFM fan

export function ForecastFan({
  doc,
  available,
  onRefresh,
  busy,
}: {
  doc: ForecastDoc | null;
  available: boolean;
  onRefresh: () => void;
  busy: boolean;
}) {
  const symbols = doc ? Object.keys(doc.symbols) : [];
  const [sel, setSel] = useState<string>("");
  const active = sel && symbols.includes(sel) ? sel : symbols[0] ?? "";
  if (!available && !doc) return null;

  const f = doc && active ? doc.symbols[active] : null;
  const rows = f
    ? [
        { day: "now", band: [f.last_close, f.last_close] as [number, number], q50: f.last_close, point: f.last_close },
        ...f.point.map((p, i) => ({
          day: `+${i + 1}d`,
          band: [f.q10[i], f.q90[i]] as [number, number],
          q50: f.q50[i],
          point: p,
        })),
      ]
    : [];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {symbols.map((s) => (
            <button
              key={s}
              onClick={() => setSel(s)}
              aria-pressed={s === active}
              className={`border px-2 py-0.5 font-mono text-micro transition-colors ${
                s === active
                  ? "border-ink/50 bg-inset font-semibold text-ink"
                  : "border-hairline text-ink2 hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={onRefresh} disabled={busy} className="!px-2.5 !py-1 text-micro">
          {busy ? "Forecasting…" : doc ? "Refresh" : "Run first forecast"}
        </Button>
      </div>
      {!doc ? (
        <p className="text-body text-ink2">
          No forecasts yet. The night job draws them daily; the first manual run downloads the
          model checkpoint (~800MB) once.
        </p>
      ) : (
        f && (
          <>
            <div className="h-44 border border-hairline bg-inset px-2 py-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                  <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                  />
                  <Tooltip
                    contentStyle={RECHARTS_TOOLTIP}
                    formatter={(value: unknown, name: unknown) =>
                      Array.isArray(value)
                        ? [`$${Number(value[0]).toFixed(2)} – $${Number(value[1]).toFixed(2)}`, "q10–q90 band"]
                        : typeof value === "number"
                          ? [`$${value.toFixed(2)}`, name === "point" ? "point forecast" : "median (q50)"]
                          : ["—", String(name)]
                    }
                  />
                  <Area dataKey="band" stroke="none" fill={CHART.cone} isAnimationActive={false} />
                  <Line dataKey="q50" stroke={CHART.median} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  <Line dataKey="point" stroke={CHART.indigo} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 font-mono text-micro text-ink2">
              {active}: expected{" "}
              <span className={f.exp_5d_pct >= 0 ? "text-green" : "text-red"}>
                {f.exp_5d_pct >= 0 ? "+" : ""}
                {f.exp_5d_pct}%
              </span>{" "}
              in 5 days, plausible range {f.q10_5d_pct >= 0 ? "+" : ""}
              {f.q10_5d_pct}% to {f.q90_5d_pct >= 0 ? "+" : ""}
              {f.q90_5d_pct}% · {doc.model} · {fmtTs(doc.ts)} · model estimate, not a promise
            </p>
          </>
        )
      )}
    </div>
  );
}
