/** GoalOrbit - the promise visual, living ONLY inside the dark /start room
 *  (docs/DESIGN.md v3: the star belongs to the promise, the ledger to the
 *  proof). An arc from the capital you start with to the target you picked,
 *  drawn under a small starfield. Pure SVG; deterministic star positions so
 *  server and client renders never disagree. Colors: CHART_DARK. */

import { fmtUsd } from "@/lib/api";
import { CHART_DARK } from "@/lib/theme";

const W = 520;
const H = 200;

// Arc control points: depart low-left, arrive high-right at the star.
const P0 = { x: 42, y: 166 };
const P1 = { x: 250, y: 22 };
const P2 = { x: 474, y: 58 };

function pointAt(t: number) {
  const u = 1 - t;
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
  };
}

const ARC_D = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

// Four-point star, centered on origin, radius ~11.
const STAR_D =
  "M 0 -11 L 2.8 -2.8 L 11 0 L 2.8 2.8 L 0 11 L -2.8 2.8 L -11 0 L -2.8 -2.8 Z";

// Deterministic starfield: [x, y, r, twinkleDelaySec | null]
const STARS: [number, number, number, number | null][] = [
  [30, 40, 1, null],
  [88, 96, 0.8, 0.4],
  [130, 30, 1.2, null],
  [168, 130, 0.8, null],
  [205, 66, 1, 1.2],
  [262, 108, 0.8, null],
  [300, 36, 1.1, 2.1],
  [338, 140, 0.9, null],
  [372, 84, 1, 0.8],
  [410, 30, 0.8, null],
  [440, 130, 1.1, 1.6],
  [500, 120, 0.9, 2.8],
  [70, 140, 0.7, null],
  [230, 170, 0.8, null],
  [490, 24, 0.8, 0.9],
];

export function GoalOrbit({
  base,
  target,
  current,
  className = "",
}: {
  base: number;
  target: number;
  /** where the ship sits; equals base before the plan starts */
  current: number;
  className?: string;
}) {
  const raw = target !== base ? (current - base) / (target - base) : 0;
  const progress = Math.min(1, Math.max(0, raw));
  // keep the ship visually on the arc even at the extremes
  const t = Math.min(0.97, Math.max(0.03, progress));
  const ship = pointAt(t);
  const pct = Math.round(progress * 100);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={`Plan progress: ${pct}% of the way from ${fmtUsd(base)} to ${fmtUsd(target)}`}
    >
      {STARS.map(([x, y, r, delay], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill={CHART_DARK.ink}
          opacity={delay === null ? 0.35 : 0.7}
          className={delay === null ? undefined : "animate-twinkle"}
          style={delay === null ? undefined : { animationDelay: `${delay}s` }}
        />
      ))}

      {/* remaining leg: dashed hairline */}
      <path
        d={ARC_D}
        fill="none"
        stroke={CHART_DARK.hairline}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      {/* sailed leg: soft glow under a solid star-gold line */}
      <path
        d={ARC_D}
        fill="none"
        stroke={CHART_DARK.star}
        strokeWidth={6}
        strokeOpacity={0.14}
        pathLength={100}
        strokeDasharray={`${t * 100} 100`}
        strokeLinecap="round"
      />
      <path
        d={ARC_D}
        fill="none"
        stroke={CHART_DARK.star}
        strokeWidth={2}
        pathLength={100}
        strokeDasharray={`${t * 100} 100`}
        strokeLinecap="round"
      />

      {/* departure */}
      <circle cx={P0.x} cy={P0.y} r={3} fill="none" stroke={CHART_DARK.ink2} strokeWidth={1.2} />
      <text x={P0.x - 6} y={P0.y + 20} fill={CHART_DARK.ink2} fontSize={11} fontFamily="var(--font-geist-mono)">
        {fmtUsd(base)}
      </text>

      {/* the North Star: the target */}
      <g transform={`translate(${P2.x} ${P2.y})`}>
        <path d={STAR_D} fill={CHART_DARK.star} className="animate-twinkle" />
        <path d={STAR_D} fill="none" stroke={CHART_DARK.star} strokeOpacity={0.35} strokeWidth={4} />
      </g>
      <text
        x={P2.x - 16}
        y={P2.y - 18}
        textAnchor="end"
        fill={CHART_DARK.star}
        fontSize={11}
        fontWeight={600}
        fontFamily="var(--font-geist-mono)"
      >
        {fmtUsd(target)}
      </text>

      {/* the ship: where the plan currently stands */}
      <circle cx={ship.x} cy={ship.y} r={9} fill={CHART_DARK.star} opacity={0.18} className="animate-pulse-slow" />
      <circle cx={ship.x} cy={ship.y} r={4} fill={CHART_DARK.star} stroke={CHART_DARK.paper} strokeWidth={1.5} />
      {progress > 0 && (
        <text
          x={ship.x}
          y={ship.y + 22}
          textAnchor="middle"
          fill={CHART_DARK.star}
          opacity={0.8}
          fontSize={11}
          fontFamily="var(--font-geist-mono)"
        >
          {pct}% of the way
        </text>
      )}
    </svg>
  );
}
