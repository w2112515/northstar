import { cn } from "@/lib/cn";

export function NorthStarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden>
      <path
        d="M12 1.4 L13.35 9.4 L21.6 12 L13.35 14.6 L12 22.6 L10.65 14.6 L2.4 12 L10.65 9.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PaperBadge({ className }: { className?: string }) {
  return (
    <span
      title="Practice money. No account is real."
      className={cn(
        "inline-flex items-center rounded-full bg-amber-dim px-2 py-0.5 text-micro font-semibold tracking-[0.14em] text-amber uppercase",
        className,
      )}
    >
      PAPER
    </span>
  );
}
