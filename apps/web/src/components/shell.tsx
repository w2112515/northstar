"use client";

/** App shell, APEX-iteration edition (the approved screenshots): top bar with
 *  mark + wordmark + nav + date/clock + LIVE + PAPER; a full-width KPI strip
 *  with hairline separators; the controls strip on the Overview page only.
 *  The /onboarding wizard is the one chromeless room. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { OctagonX, Play } from "lucide-react";
import { apiPost, fmtPct, fmtUsd } from "@/lib/api";
import { useApi, useRefreshBridge } from "@/lib/data";
import { Button, NorthStarMark, PaperBadge, Switch, useTweenNumber } from "@/components/ui";
import type { CompassDoc, EngineState, Position, Weather } from "@/lib/types";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/research", label: "Research" },
  { href: "/strategies", label: "Strategies" },
  { href: "/journal", label: "Journal" },
] as const;

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const CLOCK_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Date + live clock, isolated so the 1s tick only re-renders this span. */
function DateClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);
  if (!now) return null;
  return (
    <span className="num hidden text-xs text-mist md:inline">
      {DATE_FMT.format(now)} · {CLOCK_FMT.format(now)} ET
    </span>
  );
}

const REGIME_SHORT: Record<string, string> = {
  up_calm: "up · calm",
  up_stressed: "up · stressed",
  flat_choppy: "flat · choppy",
  down_calm: "down · calm",
  down_stressed: "down · stressed",
  unknown: "unknown",
};

function Kpi({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="kicker">{label}</span>
      <span className={cn("num text-sm", tone ?? "text-ink")}>{children}</span>
    </div>
  );
}

function Sep() {
  return <span className="hidden h-3 w-px bg-line sm:block" />;
}

/** Controls strip: Overview page only. */
function Controls({ state }: { state: EngineState | null }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const autopilot = useApi<{ autopilot: boolean }>("/api/loop/status", 15000).data?.autopilot ?? false;

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      setErr("");
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      // The next poll repaints truth, but "your command did not land" must be
      // said out loud - especially for the kill switch.
      setErr(`"${label === "tick" ? "Run one pass" : label === "kill" ? "Kill switch" : "Autopilot"}" did not go through - API unreachable or refused.`);
    } finally {
      setBusy("");
    }
  }

  const blocked = state?.kill_switch ?? false;

  return (
    <>
      <section
        aria-label="Controls"
        className="flex items-center gap-2 overflow-x-auto border-b border-line px-3 py-1.5 md:gap-3 md:px-4"
      >
        <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-ink md:min-h-9">
          <Switch
            checked={autopilot}
            disabled={blocked || busy !== ""}
            onChange={(v) => act("autopilot", () => apiPost("/api/loop/autopilot", { on: v }))}
            label="Autopilot"
          />
          <span>
            Auto<span className="hidden sm:inline">pilot</span>
          </span>
        </label>
        <Button
          size="sm"
          variant="signal"
          className="min-h-11 shrink-0 md:min-h-9"
          disabled={blocked || busy !== ""}
          onClick={() => act("tick", () => apiPost("/api/loop/tick", { reason: "manual" }))}
        >
          <Play className="size-3.5" />
          {busy === "tick" ? "Passing…" : "Run one pass"}
        </Button>
        {!state?.clock.is_open && (
          <span className="hidden shrink-0 text-2xs text-signal sm:inline">closed - orders queue</span>
        )}
        <div className="ml-auto shrink-0">
          <Button
            size="sm"
            variant={state?.kill_switch ? "quiet" : "danger"}
            className="min-h-11 md:min-h-9"
            disabled={busy !== "" || !state}
            onClick={() =>
              act("kill", () => apiPost("/api/engine/kill-switch", { on: !state?.kill_switch }))
            }
          >
            <OctagonX className="size-3.5" />
            {state?.kill_switch ? "Release kill switch" : "Kill switch"}
          </Button>
        </div>
      </section>
      {err && (
        <p role="alert" className="border-b border-line bg-coral-dim px-3 py-1.5 text-xs text-coral md:px-4">
          {err}
        </p>
      )}
    </>
  );
}

/** Kill switch / circuit breaker banners - global, above every page. */
function StateBanners({ state, pathname }: { state: EngineState | null; pathname: string }) {
  if (!state) return null;
  const soft = state.plan?.guardrails?.breaker_soft_dd ?? -0.08;
  const hard = state.plan?.guardrails?.breaker_hard_dd ?? -0.12;
  const dd = state.drawdown_from_peak;
  const breaker = dd <= hard ? "hard" : dd <= soft ? "soft" : null;

  if (!state.kill_switch && !breaker) return null;
  return (
    <div className="mb-3 flex flex-col gap-2">
      {state.kill_switch && (
        <div className="rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
          Kill switch engaged - trading is stopped. No new risk.
          {pathname !== "/" && (
            <>
              {" "}
              <Link href="/" className="underline underline-offset-2 hover:text-ink">
                Release it from Overview →
              </Link>
            </>
          )}
        </div>
      )}
      {!state.kill_switch && breaker === "hard" && (
        <div className="rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
          Hard circuit breaker: {fmtPct(dd)} from peak. Trading is stopped.
        </div>
      )}
      {!state.kill_switch && breaker === "soft" && (
        <div className="rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber">
          Soft circuit breaker: {fmtPct(dd)} from peak. New trades wait for your approval.
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Actions anywhere dispatch northstar:refresh; the shell is on every page.
  useRefreshBridge();

  const state = useApi<EngineState>("/api/engine/state", 15000).data ?? null;
  const kpiEquity = useTweenNumber(state?.account.equity ?? 0);
  const kpiDayPnl = useTweenNumber(state?.day_pnl_pct ?? 0);
  const weather = useApi<{ weather: Weather }>("/api/weather", 60000).data?.weather ?? null;
  const regime =
    useApi<{ compass: CompassDoc | null }>("/api/compass", 5 * 60000).data?.compass?.regime ?? null;
  const positions =
    useApi<{ positions: Position[] }>("/api/positions", 20000).data?.positions ?? [];

  if (pathname === "/onboarding") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    // overflow-x must be `clip`, never `hidden`: hidden forces overflow-y to
    // compute as auto, which turns this div into the sticky containing block
    // and silently kills every position:sticky descendant (topbar, KPI strip,
    // journal date headers). clip crops without creating a scroll container.
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-void text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:text-signal"
      >
        Skip to content
      </a>

      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-night/95 backdrop-blur-sm">
        <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 px-3 md:px-4">
          <Link href="/" className="flex items-center gap-2 text-gold">
            <NorthStarMark className="size-5" />
            <span className="text-sm font-semibold tracking-tight text-ink">NorthStar</span>
          </Link>
          <nav className="flex items-center gap-3">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative text-sm transition-colors duration-150",
                    active ? "text-ink" : "text-mist hover:text-ink",
                  )}
                >
                  {n.label}
                  {active && <span className="absolute -bottom-1 left-0 h-px w-5 bg-gold" />}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <DateClock />
            {state && (
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    state.clock.is_open ? "bg-teal" : "bg-coral",
                  )}
                />
                <span className={cn("text-2xs", state.clock.is_open ? "text-teal" : "text-coral")}>
                  {state.clock.is_open ? "Live" : "Closed"}
                </span>
              </span>
            )}
            <PaperBadge className="shrink-0" />
          </div>
        </div>

        {/* KPI strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 md:px-4">
          {state ? (
            <>
              <Kpi label="Equity">{fmtUsd(kpiEquity, 0)}</Kpi>
              <Sep />
              <Kpi
                label="Day P/L"
                tone={state.day_pnl_pct >= 0 ? "text-teal" : "text-coral"}
              >
                {state.day_pnl_pct >= 0 ? "+" : ""}
                {fmtPct(kpiDayPnl, 2)}
              </Kpi>
              <Sep />
              <Kpi label="Buying power">
                {state.account.buying_power != null ? fmtUsd(state.account.buying_power, 0) : "—"}
              </Kpi>
              <Sep />
              <Kpi label="Positions">{positions.length}</Kpi>
            </>
          ) : (
            <span className="text-2xs text-mist">syncing…</span>
          )}
          {/* Honest placeholders: a KPI vanishing reads as a layout glitch,
              a dash reads as "no reading yet". Strip item count stays put. */}
          <Sep />
          <Kpi label="wx">
            {weather ? (
              <>
                {weather.score ?? "—"} <span className="text-mist">{weather.bucket}</span>
              </>
            ) : (
              "—"
            )}
          </Kpi>
          <Sep />
          <Kpi label="Regime">
            <span className="text-mist">
              {regime && regime.label !== "unknown"
                ? REGIME_SHORT[regime.label] ?? regime.label
                : "—"}
            </span>
          </Kpi>
        </div>

        {pathname === "/" && <Controls state={state} />}
      </header>

      <main id="main" className="min-w-0 flex-1 px-3 py-3 md:px-4">
        <StateBanners state={state} pathname={pathname} />
        <div className="min-w-0">{children}</div>
        {/* Compliance line: full-strength mist - mist/60 lands at 3.9:1, below
            AA for the smallest type on the page. */}
        <footer className="mt-6 pb-1 text-center text-micro leading-relaxed text-mist">
          Paper trading · live prices · historical odds, not a promise · not investment advice
        </footer>
      </main>
    </div>
  );
}
