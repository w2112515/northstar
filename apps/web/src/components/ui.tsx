import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: "gold" | "teal" | "coral" | "none";
}) {
  const ring =
    accent === "gold"
      ? "border-gold/40"
      : accent === "teal"
        ? "border-teal/40"
        : accent === "coral"
          ? "border-coral/50"
          : "border-line";
  return (
    <div className={`rounded-2xl border ${ring} bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">{children}</h2>
      {sub ? <p className="mt-1 text-xs text-muted/70">{sub}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "ink",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "ink" | "teal" | "coral" | "gold" | "muted";
  hint?: string;
}) {
  const color =
    tone === "teal"
      ? "text-teal"
      : tone === "coral"
        ? "text-coral"
        : tone === "gold"
          ? "text-gold"
          : tone === "muted"
            ? "text-muted"
            : "text-ink";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted/70">{hint}</div> : null}
    </div>
  );
}

export function Chip({
  children,
  tone = "line",
}: {
  children: ReactNode;
  tone?: "line" | "gold" | "teal" | "coral" | "blue" | "amber";
}) {
  const cls = {
    line: "border-line text-muted",
    gold: "border-gold/50 text-gold",
    teal: "border-teal/50 text-teal",
    coral: "border-coral/60 text-coral",
    blue: "border-skyblue/50 text-skyblue",
    amber: "border-amber/60 text-amber",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "subtle";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary:
      "bg-gold text-night font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed",
    ghost:
      "border border-line text-ink hover:border-gold/60 hover:text-gold disabled:opacity-40",
    subtle: "bg-surface2 text-ink hover:bg-line/60 disabled:opacity-40",
    danger: "border border-coral/60 text-coral hover:bg-coral/10 disabled:opacity-40",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm transition-colors ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function PaperBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber/70 bg-amber/10 px-3 py-1 text-[11px] font-bold tracking-wider text-amber"
      title="Practice account with simulated money. No real dollars are at risk."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
      PAPER · practice money
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-sm font-medium text-muted">{title}</div>
      {body ? <div className="mx-auto mt-1 max-w-md text-xs text-muted/70">{body}</div> : null}
    </div>
  );
}
