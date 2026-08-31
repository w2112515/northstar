/** GoalOrbit - the signature visual, geometry ported from the approved Grok
 *  prototype (goal-orbit.tsx): a monotonically ASCENDING quadratic bezier
 *  from the departure point (bottom-left) up to the North Star (top-right) -
 *  the last leg of the journey must climb, never dip. Traveled arc glows
 *  teal-to-gold, the breathing ship marks the current position. Pure SVG,
 *  deterministic geometry; no hydration drift. Colors come from lib/theme
 *  (single source shared with every chart). */

import { useMemo } from "react";
import { fmtUsd } from "@/lib/api";
import { CHART } from "@/lib/theme";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function compactMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  return fmtUsd(n, abs >= 1000 ? 0 : 2);
}

// Grok prototype geometry: viewBox 800x280, departure (48,236), star (748,58),
// control point (300,24) - the curve rises fast early and glides into the star.
const G = { w: 800, h: 280, x0: 48, y0: 236, x1: 748, y1: 58, cx: 300, cy: 24 };
const RING_D = `M ${G.x0} ${G.y0} Q ${G.cx} ${G.cy} ${G.x1} ${G.y1}`;
const pointAt = (t: number) => {
  const u = 1 - clamp(t, 0, 1);
  const tt = clamp(t, 0, 1);
  return {
    x: u * u * G.x0 + 2 * u * tt * G.cx + tt * tt * G.x1,
    y: u * u * G.y0 + 2 * u * tt * G.cy + tt * tt * G.y1,
  };
};

// Deterministic star + constellation-mesh coordinates (shared by the orbit
// and the idle-hero backdrop).
const STARS = [
  [40, 40, 0.5, 2.1], [90, 90, 0.7, 3.4], [140, 30, 0.4, 1.8], [200, 110, 0.55, 4.2],
  [260, 70, 0.35, 2.6], [320, 150, 0.6, 3.1], [380, 40, 0.45, 1.4], [440, 120, 0.7, 2.9],
  [500, 60, 0.3, 4.6], [560, 170, 0.5, 2.2], [620, 90, 0.65, 3.7], [680, 200, 0.4, 1.6],
  [720, 130, 0.55, 2.4], [80, 200, 0.35, 3.3], [180, 180, 0.5, 4.8], [300, 220, 0.3, 2.7],
  [410, 210, 0.45, 1.9], [540, 230, 0.6, 3.5], [650, 250, 0.4, 2.0], [760, 90, 0.7, 4.1],
] as Array<[number, number, number, number]>;

const MESH = [
  [60, 80, 180, 40], [180, 40, 320, 90], [320, 90, 480, 30],
  [120, 160, 260, 100], [260, 100, 420, 140], [420, 140, 600, 80],
  [200, 220, 360, 180], [360, 180, 540, 160], [540, 160, 700, 100],
];

function Constellation({ twinkle }: { twinkle: boolean }) {
  return (
    <>
      {MESH.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={CHART.line} strokeWidth="0.6" opacity="0.55" />
      ))}
      {STARS.map(([x, y, r, delay], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill={CHART.ink}
          className={twinkle ? "motion-safe:animate-twinkle" : undefined}
          style={twinkle ? { animationDelay: `${delay}s`, animationDuration: `${2.8 + (i % 5) * 0.4}s` } : undefined}
        />
      ))}
    </>
  );
}

/** Static (no-motion, subdued) night-sky backdrop for the idle hero panel,
 *  so the most common cockpit state still carries the product's sky. */
export function StarfieldBackdrop({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${G.w} ${G.h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-60 ${className}`}
    >
      <Constellation twinkle={false} />
    </svg>
  );
}

export function GoalOrbit({
  start,
  equity,
  target,
  odds,
  compact = false,
}: {
  start: number;
  equity: number;
  target: number;
  odds: number;
  /** Overview pass/kill strip: keep the signature without a second empty card. */
  compact?: boolean;
}) {
  const progress = clamp((equity - start) / Math.max(target - start, 1), 0, 1);
  const over = equity > target;
  const ship = useMemo(() => pointAt(over ? 1 : progress), [over, progress]);

  // Label collision guards: at ~0 progress the ship sits on the departure
  // point (same value twice looks like a rendering bug); near 1 it sits on
  // the star. In each case the overlapping neighbor already tells the number.
  const showDeparture = progress >= 0.03 && !over;
  const showShipLabel = progress <= 0.97 && !over;

  return (
    <div
      className={`starfield relative overflow-hidden rounded-xl ${
        compact ? "min-h-36" : "h-full min-h-52"
      }`}
    >
      <svg
        viewBox={`0 0 ${G.w} ${G.h}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Goal orbit. Equity ${compactMoney(equity)} of ${compactMoney(target)}. Odds ${(odds * 100).toFixed(0)} percent.`}
      >
        <defs>
          <linearGradient id="orbit-gold" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={CHART.teal} />
            <stop offset="55%" stopColor={CHART.gold} />
            <stop offset="100%" stopColor={CHART.gold} />
          </linearGradient>
          <filter id="orbit-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="star-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Constellation twinkle />

        {/* the ring: track + animated dashed overlay + glowing traveled arc */}
        <path d={RING_D} fill="none" stroke={CHART.line} strokeWidth="2" strokeLinecap="round" />
        <path
          d={RING_D}
          fill="none"
          stroke={CHART.gold}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="5 7"
          opacity="0.7"
          className="motion-safe:animate-orbit-dash"
          pathLength={100}
        />
        <path
          d={RING_D}
          fill="none"
          stroke="url(#orbit-gold)"
          strokeWidth="2.4"
          strokeLinecap="round"
          filter="url(#orbit-glow)"
          pathLength={100}
          strokeDasharray={`${progress * 100} 100`}
        />

        {/* departure */}
        <circle cx={G.x0} cy={G.y0} r="4.5" fill={CHART.mist} />
        {showDeparture && (
          <text
            x={G.x0 + 12}
            y={G.y0 + 5}
            fill={CHART.mist}
            fontSize="11"
            fontFamily="var(--font-plex-mono), monospace"
          >
            {compactMoney(start)}
          </text>
        )}

        {/* the ship: where the plan currently stands */}
        <g transform={`translate(${ship.x}, ${ship.y})`}>
          <circle r="10" fill={CHART.gold} opacity="0.18" className="motion-safe:animate-breathe" />
          <circle r="4.2" fill={CHART.gold} />
          <circle r="1.6" fill={CHART.void} />
        </g>
        {showShipLabel && (
          <text
            x={clamp(ship.x + 12, 60, G.w - 90)}
            y={clamp(ship.y - 10, 16, G.h - 10)}
            fill={CHART.gold}
            fontSize="11"
            fontFamily="var(--font-plex-mono), monospace"
          >
            {compactMoney(equity)}
          </text>
        )}

        {/* the North Star: the destination */}
        <g transform={`translate(${G.x1}, ${G.y1})`} filter="url(#star-glow)">
          <path
            d="M0 -14 L2.2 -2.4 L14 0 L2.2 2.4 L0 14 L-2.2 2.4 L-14 0 L-2.2 -2.4 Z"
            fill={CHART.gold}
          />
          <circle r="2" fill={CHART.void} />
        </g>
        <text
          x={G.x1 - 86}
          y={G.y1 + 28}
          fill={CHART.gold}
          fontSize="11"
          fontFamily="var(--font-plex-mono), monospace"
        >
          {compactMoney(target)}
        </text>
      </svg>
    </div>
  );
}
