import { ReactNode, useState } from "react";

/* Night Ledger primitives - docs/DESIGN.md v4.1.
   Rounded panels lifted off the void (prototype texture) carrying the
   ledger's grammar: kicker headers, stamps for verdicts, field notes for
   AI attribution. Indigo for interaction, teal for deterministic code,
   gold for star moments only (primary CTA / FieldNote / the target). */

// ------------------------------------------------------------------ Section

/** The base layout unit: a rounded panel with a kicker header. The ring is
 *  a shadow (.panel), so nested content never shifts by a border width. */
export function Section({
  title,
  hint,
  info,
  actions,
  children,
  className = "",
  id,
}: {
  title: string;
  /** right-aligned micro note on the header row */
  hint?: string;
  /** full explainer behind a hover/focus ⓘ */
  info?: string;
  /** section-level actions, right-aligned on the header row */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel px-5 py-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 pb-3">
        <h2 className="font-mono text-micro font-semibold uppercase tracking-[0.14em] text-ink2">
          {title}
        </h2>
        {info ? <InfoNote text={info} /> : null}
        {hint ? <span className="ml-auto font-mono text-micro text-ink2">{hint}</span> : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Section explainers as an inline disclosure, not a title tooltip: native
 *  tooltips don't appear on keyboard focus and can't be read at length. */
function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="contents">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="About this section"
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-hairline text-micro text-ink2 hover:text-ink"
      >
        i
      </button>
      {open && (
        <span className="block w-full border-l-2 border-hairline py-0.5 pl-3 text-body leading-relaxed text-ink2">
          {text}
        </span>
      )}
    </span>
  );
}

// -------------------------------------------------------------------- Stamp

export type StampTone = "red" | "green" | "amber" | "indigo" | "plain";

/** A verdict stamp: bordered chip, monospaced uppercase, faint tone wash.
 *  The visual signature of the ledger - decisions look like they were
 *  stamped. */
export function Stamp({ children, tone = "plain" }: { children: ReactNode; tone?: StampTone }) {
  const cls = {
    red: "border-red/60 bg-red/10 text-red",
    green: "border-green/60 bg-green/10 text-green",
    amber: "border-amber/60 bg-amber/10 text-amber",
    indigo: "border-indigo/60 bg-indigo/10 text-indigo",
    plain: "border-ink2/30 bg-inset/60 text-ink2",
  }[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[5px] border px-1.5 py-px font-mono text-micro font-semibold uppercase tracking-[0.12em] ${cls}`}
    >
      {children}
    </span>
  );
}

/** Map a journal event to its ledger stamp. The verdict payload's
 *  discriminator is `verdict: "approved" | "rejected" | "needs_human"`
 *  (GateVerdict, domain.py); anything unknown falls back to the kind label. */
export function eventStamp(e: { kind: string; payload?: Record<string, unknown> }): {
  label: string;
  tone: StampTone;
} {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  switch (e.kind) {
    case "fill":
      return { label: "FILLED", tone: "green" };
    case "pnl": {
      const v = Number(p.realized ?? p.pnl ?? p.value ?? 0);
      return { label: v >= 0 ? "+P&L" : "-P&L", tone: v >= 0 ? "green" : "red" };
    }
    case "verdict": {
      if (p.verdict === "rejected") return { label: "REJECTED", tone: "red" };
      if (p.verdict === "approved") return { label: "APPROVED", tone: "green" };
      if (p.verdict === "needs_human") return { label: "NEEDS YOU", tone: "amber" };
      return { label: "VERDICT", tone: "plain" };
    }
    case "approval":
      return { label: "NEEDS YOU", tone: "amber" };
    case "order":
      return { label: "ORDER", tone: "plain" };
    case "proposal":
      return { label: "PROPOSAL", tone: "plain" };
    case "forecast":
      return { label: "FORECAST", tone: "plain" };
    case "scout":
      return { label: "SCOUT", tone: "plain" };
    case "debate":
      return { label: "DEBATE", tone: "plain" };
    case "digest":
      return { label: "BRIEF", tone: "plain" };
    case "experiment":
      return { label: "EXPERIMENT", tone: "plain" };
    case "trace":
      return { label: "TRACE", tone: "plain" };
    default:
      return { label: e.kind.toUpperCase(), tone: "plain" };
  }
}

// --------------------------------------------------------------- FieldNote

/** AI attribution is a texture AND the star color: serif italic narration
 *  on a faint gold wash. Deterministic facts never wear this costume. */
export function FieldNote({
  by,
  ts,
  meta,
  children,
}: {
  /** e.g. "gemini" or "template" - always labeled, never hidden */
  by: string;
  ts?: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <figure className="rounded-r-xl border-l-2 border-star/40 bg-star/[0.06] px-4 py-3">
      <blockquote className="font-serif text-body italic leading-relaxed text-ink/90">
        {children}
      </blockquote>
      <figcaption className="mt-1.5 font-mono text-micro text-ink2">
        narrated by {by}
        {ts ? ` · ${ts}` : ""}
        {meta ? ` · ${meta}` : ""} · AI narration, not a decision
      </figcaption>
    </figure>
  );
}

// --------------------------------------------------------------- PageHeader

/** One h1 per page. Pages declare who they are. */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-page font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="mt-1 max-w-2xl text-body text-ink2">{sub}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// -------------------------------------------------------------------- Button

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "affirm" | "ghost" | "danger" | "subtle";
  size?: "md" | "sm";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    // The primary action is a star moment: gold plate, night text.
    primary:
      "bg-star text-paper font-semibold hover:bg-star/90 disabled:opacity-40 disabled:cursor-not-allowed",
    // Money-in / confirmation: teal plate (prototype approve language).
    affirm:
      "bg-teal text-paper font-semibold hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed",
    ghost:
      "border border-hairline text-ink hover:border-ink/40 disabled:opacity-40",
    subtle: "bg-inset text-ink hover:bg-hairline/50 disabled:opacity-40",
    danger: "border border-red/60 text-red hover:bg-red/5 disabled:opacity-40",
  }[variant];
  const sizing = size === "sm" ? "px-3 py-1" : "px-4 py-2";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg text-body transition-colors ${sizing} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- PaperTag

/** Always visible: this is practice money. A gold-ringed pill, the one
 *  permanent honesty mark in the chrome. */
export function PaperTag() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-star/60 bg-star/10 px-2.5 py-0.5 font-mono text-micro font-semibold uppercase tracking-[0.14em] text-star"
      title="Practice account with simulated money. No real dollars are at risk."
    >
      PAPER
    </span>
  );
}

// --------------------------------------------------------------- EmptyState

/** Borderless: a ledger records absence with one line, not a dashed box. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="py-8 text-center">
      <div className="font-mono text-micro uppercase tracking-[0.12em] text-ink2">{title}</div>
      {body ? <div className="mx-auto mt-1.5 max-w-md text-body text-ink2">{body}</div> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ----------------------------------------------------------------- Skeleton

/** Shimmering inset bars while the first fetch lands (prototype .skel);
 *  static under prefers-reduced-motion. */
export function Skeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skel h-3.5"
          style={{ width: `${88 - ((i * 17) % 40)}%` }}
        />
      ))}
    </div>
  );
}
