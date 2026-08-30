import { cn } from "@/lib/cn";
import type { PassStep } from "@/lib/types";

const FLOW: { id: PassStep; label: string; kind: "code" | "gemini" }[] = [
  { id: "perceive", label: "perceive", kind: "gemini" },
  { id: "guard", label: "guard", kind: "code" },
  { id: "triage", label: "triage", kind: "gemini" },
  { id: "signals", label: "signals", kind: "gemini" },
  { id: "gate", label: "gate + execute", kind: "code" },
  { id: "explain", label: "explain", kind: "gemini" },
  { id: "record", label: "record", kind: "code" },
];

const SATS: { id: string; label: string; kind: "code" | "gemini"; near: PassStep }[] = [
  { id: "scout", label: "scout", kind: "gemini", near: "perceive" },
  { id: "weather", label: "weather", kind: "code", near: "triage" },
  { id: "timesfm", label: "TimesFM", kind: "gemini", near: "signals" },
];

const COUNCIL = ["advocate", "critic", "judge"] as const;

const ORDER: PassStep[] = FLOW.map((f) => f.id);

function lit(active: PassStep, id: PassStep) {
  if (active === "idle") return false;
  return ORDER.indexOf(id) <= ORDER.indexOf(active);
}

export function AgentGraph({ active }: { active: PassStep }) {
  const running = active !== "idle";
  return (
    <div className="flex h-full min-h-52 flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {SATS.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            kind={s.kind}
            on={running && lit(active, s.near)}
            current={active === s.near}
          />
        ))}
      </div>

      <ol className="relative flex-1 pl-4">
        <span className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-line" aria-hidden />
        {FLOW.map((n) => {
          const on = running && lit(active, n.id);
          const current = active === n.id;
          return (
            <li key={n.id} className="relative flex items-center gap-2 py-1">
              <span
                className={cn(
                  "absolute -left-4 size-2.5 rounded-full",
                  on ? (n.kind === "gemini" ? "bg-gold" : "bg-signal") : "bg-line",
                  current && "motion-safe:animate-pulse-node",
                )}
              />
              <span className={cn("text-xs", on ? "text-ink" : "text-mist")}>{n.label}</span>
              <span
                className={cn(
                  "ml-auto text-micro font-medium tracking-wider uppercase",
                  n.kind === "gemini" ? "text-gold" : "text-signal",
                  !on && "opacity-40",
                )}
              >
                {n.kind === "gemini" ? "AI" : "CODE"}
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <div className="mb-1 kicker">Debate council</div>
        <div className="flex flex-wrap gap-1">
          {COUNCIL.map((c) => (
            <Chip
              key={c}
              label={c}
              kind="gemini"
              on={running && lit(active, "signals")}
              current={active === "signals"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  kind,
  on,
  current,
}: {
  label: string;
  kind: "code" | "gemini";
  on: boolean;
  current: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-sm bg-panel px-1.5 py-0.5 text-micro text-mist",
        on && kind === "gemini" && "text-gold shadow-tone-gold",
        on && kind === "code" && "text-signal shadow-tone-signal",
        current && "motion-safe:animate-pulse-node",
      )}
    >
      {label}
    </span>
  );
}
