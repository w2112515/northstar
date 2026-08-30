"use client";

/** The top bar: one hairline-delimited row with the wordmark, the four-page
 *  nav, and the few numbers that must be visible from everywhere - equity,
 *  today, plan progress, needs-you count, market clock. Self-fetching; SWR
 *  keys are shared with the pages so each endpoint is fetched once. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtPct, fmtUsd } from "@/lib/api";
import { useApi, useRefreshBridge } from "@/lib/data";
import { PaperTag, Stamp } from "@/components/ui";
import type { EngineState, Weather } from "@/lib/types";

const NAV = [
  { href: "/", label: "Track" },
  { href: "/activity", label: "Activity" },
  { href: "/proof", label: "Proof" },
  { href: "/system", label: "System" },
];

function clockIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

/** Isolated so the 1s tick only re-renders this span. */
function NyClock() {
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
    <span
      className="hidden font-mono text-micro tabular-nums text-ink2 lg:inline"
      title={`UTC ${clockIn("UTC", now)}`}
    >
      NY {clockIn("America/New_York", now)}
    </span>
  );
}

/** The thin ruled meter: plan progress as a measuring stick, not a widget.
 *  Monthly-income plans have no lump target - show the income goal as text
 *  instead of pretending no goal exists. Hidden below xl: the bar must never
 *  crowd the nav off the row. */
function ProgressRuler({ state }: { state: EngineState }) {
  const goal = state.goal;
  if (!goal) {
    return (
      <Link
        href="/start"
        className="font-mono text-micro font-semibold uppercase tracking-[0.12em] text-indigo hover:underline"
      >
        Set a goal →
      </Link>
    );
  }
  const target = goal.target_amount;
  if (target == null || target <= goal.capital_base) {
    return goal.mode === "monthly_income" && goal.monthly_target ? (
      <span
        className="hidden font-mono text-micro tabular-nums text-ink2 xl:inline"
        title="Monthly income goal"
      >
        {fmtUsd(goal.monthly_target, 0)}/mo goal
      </span>
    ) : null;
  }
  const progress = Math.min(
    Math.max((state.account.equity - goal.capital_base) / (target - goal.capital_base), 0),
    1,
  );
  return (
    <div className="hidden items-center gap-2 xl:flex" title={`Plan progress toward ${fmtUsd(target)}`}>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full bg-star" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className="font-mono text-micro tabular-nums text-ink2">
        {fmtPct(progress, 0)} → {fmtUsd(target, 0)}
      </span>
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  // Actions anywhere dispatch northstar:refresh; this bridge turns it into a
  // cache-wide revalidation. The top bar is on every page.
  useRefreshBridge();

  const state = useApi<EngineState>("/api/engine/state", 15000).data ?? null;
  const weather = useApi<{ weather: Weather }>("/api/weather", 60000).data?.weather ?? null;
  const approvals =
    useApi<{ pending: { id: string }[] }>("/api/approvals", 20000).data?.pending.length ?? 0;
  // Needs-you must match the Track page's count: approvals + pending advice.
  const advisorPending = useApi<{ advisor: { proposal?: { status?: string } | null } | null }>(
    "/api/compass",
    5 * 60000,
  ).data?.advisor?.proposal?.status === "pending"
    ? 1
    : 0;
  const needsYou = approvals + advisorPending;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-raised/85 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-body text-star" aria-hidden>
            ✦
          </span>
          <span className="text-section font-semibold tracking-tight">NorthStar</span>
          <span className="hidden font-mono text-micro uppercase tracking-[0.14em] text-ink2 xl:inline">
            goal-first paper trading
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-md px-2.5 py-1 text-body transition-colors ${
                  active
                    ? "bg-inset font-medium text-ink"
                    : "text-ink2 hover:bg-inset/60 hover:text-ink"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 rounded-full bg-indigo" />
                )}
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {state && (
            <span className="flex items-baseline gap-2">
              <span className="hidden font-mono text-micro uppercase tracking-[0.14em] text-ink2 md:inline">
                Equity
              </span>
              <span className="font-mono text-body font-semibold tabular-nums">
                {fmtUsd(state.account.equity, 0)}
              </span>
              <span
                className={`font-mono text-micro tabular-nums ${
                  state.day_pnl_pct >= 0 ? "text-green" : "text-red"
                }`}
              >
                {state.day_pnl_pct >= 0 ? "+" : ""}
                {fmtPct(state.day_pnl_pct, 2)}
              </span>
            </span>
          )}
          {state?.plan && (
            <span className="hidden items-baseline gap-1.5 lg:flex" title="Monte Carlo odds of reaching the goal - estimate, not a promise">
              <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink2">
                Odds
              </span>
              <span className="font-mono text-body font-semibold tabular-nums text-star">
                {Math.round(state.plan.probability * 100)}%
              </span>
            </span>
          )}
          {state && <ProgressRuler state={state} />}
          {weather?.score != null && (
            <span
              className="hidden items-baseline gap-1.5 xl:flex"
              title={`Market weather ${Math.round(weather.score)}/100 (${weather.bucket})`}
            >
              <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink2">WX</span>
              <span className="font-mono text-body font-semibold tabular-nums">
                {Math.round(weather.score)}
              </span>
            </span>
          )}
          {state && (
            <span className="hidden items-center gap-1.5 md:flex" title="US market session">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  state.clock.is_open ? "bg-green" : "bg-ink2/50"
                }`}
              />
              <span className="font-mono text-micro text-ink2">
                {state.clock.is_open ? "Open" : "Closed"}
              </span>
            </span>
          )}
          {needsYou > 0 && (
            <Link href="/#needs-you" className="animate-stamp-in">
              <Stamp tone="amber">{needsYou} need you</Stamp>
            </Link>
          )}
          {state?.kill_switch && <Stamp tone="red">kill on</Stamp>}
          <NyClock />
          <PaperTag />
        </div>
      </div>
    </header>
  );
}
