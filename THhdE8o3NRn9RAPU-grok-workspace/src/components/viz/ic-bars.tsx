import type { FactorRow } from "@/lib/types";
import { cn } from "@/lib/cn";

export function IcBars({ rows }: { rows: FactorRow[] }) {
  const max = Math.max(0.08, ...rows.map((r) => Math.abs(r.ic)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const mag = Math.abs(r.ic) / max;
        const pos = r.ic >= 0;
        return (
          <div key={r.id} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2">
            <div className="truncate text-xs text-mist">{r.name}</div>
            <div className="relative h-2 rounded-full bg-panel">
              <div className="absolute top-0 left-1/2 h-full w-px bg-line" />
              <div
                className={cn("absolute top-0 h-2 rounded-full", pos ? "bg-teal left-1/2" : "bg-coral")}
                style={
                  pos
                    ? { width: `${mag * 50}%` }
                    : { width: `${mag * 50}%`, left: `${50 - mag * 50}%` }
                }
              />
            </div>
            <div className={cn("num text-right text-xs", pos ? "text-teal" : "text-coral")}>
              {r.ic >= 0 ? "+" : "−"}
              {Math.abs(r.ic).toFixed(3)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
