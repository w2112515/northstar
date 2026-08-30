import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  mist: "text-mist bg-panel",
  gold: "text-gold bg-gold-dim",
  teal: "text-teal bg-teal-dim",
  coral: "text-coral bg-coral-dim",
  amber: "text-amber bg-amber-dim",
  signal: "text-signal bg-signal-dim",
  ink: "text-ink bg-panel",
} as const;

export function Badge({
  tone = "mist",
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
