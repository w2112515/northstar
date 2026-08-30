"use client";

import { ReactNode, useState } from "react";

/* UI primitives in the Grok-prototype visual language (the approved visual
 *  authority). Panels carry content; badges carry tone; kickers label
 *  sections. Copy blacklist still applies - see docs/DESIGN.md. */

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// --------------------------------------------------------------------- Panel

export function Panel({
  children,
  className = "",
  tone,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** semantic 1px tone ring for states (waiting, danger, champion) */
  tone?: "gold" | "teal" | "coral" | "amber" | "signal";
  id?: string;
}) {
  return (
    <section id={id} className={cn("panel", tone && `shadow-tone-${tone}`, className)}>
      {children}
    </section>
  );
}

// ------------------------------------------------------------- Panel header

/** The standard panel header: kicker label + optional right-side note. */
export function PanelHead({
  title,
  right,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className="kicker">{title}</span>
      {right}
    </div>
  );
}

// --------------------------------------------------------------------- Badge

const BADGE_TONES = {
  mist: "text-mist bg-panel",
  gold: "text-gold bg-gold-dim",
  teal: "text-teal bg-teal-dim",
  coral: "text-coral bg-coral-dim",
  amber: "text-amber bg-amber-dim",
  signal: "text-signal bg-signal-dim",
  ink: "text-ink bg-panel",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "mist",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Map a journal event to its badge tone. The verdict payload's
 *  discriminator is `verdict: "approved" | "rejected" | "needs_human"`. */
export function eventTone(e: { kind: string; payload?: Record<string, unknown> }): BadgeTone {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  if (e.kind === "verdict") {
    if (p.verdict === "rejected") return "coral";
    if (p.verdict === "approved") return "teal";
    return "amber";
  }
  const map: Record<string, BadgeTone> = {
    fill: "teal",
    pnl: "teal",
    order: "signal",
    forecast: "signal",
    scout: "signal",
    proposal: "amber",
    approval: "amber",
    debate: "gold",
    digest: "gold",
    experiment: "mist",
    trace: "mist",
    system: "mist",
  };
  return map[e.kind] ?? "mist";
}

// -------------------------------------------------------------------- Button

type ButtonVariant = "gold" | "teal" | "coral" | "signal" | "ghost" | "quiet" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  gold: "bg-gold text-void hover:bg-gold/90 shadow-tone-gold",
  teal: "bg-teal text-void hover:bg-teal/90",
  coral: "bg-coral text-void hover:bg-coral/90",
  signal: "bg-signal text-ink hover:bg-signal/90",
  ghost: "bg-transparent text-ink hover:bg-panel shadow-border",
  quiet: "bg-panel text-ink hover:bg-panel/80 shadow-border",
  danger: "bg-coral-dim text-coral hover:bg-coral/20 shadow-tone-coral",
};

export function Button({
  children,
  onClick,
  variant = "quiet",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,box-shadow,transform,opacity] duration-150 ease-out",
        "rounded-md text-sm active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-9 rounded-sm px-3 text-xs" : size === "lg" ? "h-11 rounded-lg px-5" : "h-10 px-3.5",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// --------------------------------------------------------------------- Input

export function Input({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <input
      aria-label={label ?? props.placeholder}
      className={cn(
        "h-10 w-full rounded-md bg-void px-3 text-sm text-ink shadow-border placeholder:text-mist/60",
        className,
      )}
      {...props}
    />
  );
}

// -------------------------------------------------------------------- Switch

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150",
        checked ? "bg-teal" : "bg-panel shadow-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all duration-150",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------- Tabs

export function Tabs({
  tabs,
  active,
  onChange,
  dot,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  /** show an amber dot on tabs with a pending human decision */
  dot?: Record<string, boolean>;
}) {
  return (
    <div role="tablist" className="flex gap-0.5 overflow-x-auto rounded-md bg-void p-0.5 shadow-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative h-9 shrink-0 rounded-sm px-3 text-2xs uppercase tracking-[0.12em] transition-[color,background-color] duration-150",
            active === t.id ? "bg-panel text-ink" : "text-mist hover:text-ink",
          )}
        >
          {t.label}
          {dot?.[t.id] && (
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber"
              title="Waiting on your decision"
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Skeleton

/** Shimmer placeholder rows shown before the first fetch lands, so pages
 *  never flash a fake "nothing here yet" while data is on the wire. */
export function Skeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel h-3.5" style={{ width: `${88 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

// --------------------------------------------------------------- EmptyState

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-8 text-center">
      <div className="kicker">{title}</div>
      {body ? <div className="mx-auto mt-2 max-w-md text-sm text-mist">{body}</div> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------- Stat

export function Stat({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className={cn("num mt-0.5 text-sm", tone ?? "text-ink")}>{v}</div>
    </div>
  );
}

// ---------------------------------------------------------------- PageTitle

/** One h1 per page: big tracking-tight title + optional one-line context. */
export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      {sub ? <p className="mt-1 text-sm text-mist">{sub}</p> : null}
    </div>
  );
}

// ----------------------------------------------------------------- InfoNote

/** Long explainers behind an inline disclosure (native title tooltips are
 *  keyboard-invisible and unreadable at length). */
export function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="contents">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="About this section"
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-2xs text-mist shadow-border hover:text-ink"
      >
        i
      </button>
      {open && (
        <span className="mt-2 block rounded-md bg-panel p-3 text-xs leading-relaxed text-mist shadow-border">
          {text}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- PaperBadge

export function PaperBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Practice money. No account is real."
      className={cn(
        "inline-flex items-center rounded-full bg-amber-dim px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.14em] text-amber",
        className,
      )}
    >
      PAPER
    </span>
  );
}

// ------------------------------------------------------------ NorthStarMark

export function NorthStarMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden>
      <path
        d="M12 1.4 L13.35 9.4 L21.6 12 L13.35 14.6 L12 22.6 L10.65 14.6 L2.4 12 L10.65 9.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}
