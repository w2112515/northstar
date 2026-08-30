import { useMemo } from "react";
import { clamp, compactMoney } from "@/lib/format";

export function GoalOrbit({
  start,
  equity,
  target,
  odds,
}: {
  start: number;
  equity: number;
  target: number;
  odds: number;
}) {
  const progress = clamp((equity - start) / Math.max(target - start, 1), 0, 1);
  const over = equity > target;

  const geom = useMemo(() => {
    const w = 800;
    const h = 280;
    const x0 = 48;
    const y0 = 236;
    const x1 = 748;
    const y1 = 58;
    const cx = 300;
    const cy = 24;
    const d = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
    const pointAt = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * x0 + 2 * u * t * cx + t * t * x1,
        y: u * u * y0 + 2 * u * t * cy + t * t * y1,
      };
    };
    return { w, h, d, pointAt, x0, y0, x1, y1 };
  }, []);

  const ship = geom.pointAt(over ? 1 : progress);
  const stars = useMemo(
    () =>
      [
        [40, 40, 0.5, 2.1],
        [90, 90, 0.7, 3.4],
        [140, 30, 0.4, 1.8],
        [200, 110, 0.55, 4.2],
        [260, 70, 0.35, 2.6],
        [320, 150, 0.6, 3.1],
        [380, 40, 0.45, 1.4],
        [440, 120, 0.7, 2.9],
        [500, 60, 0.3, 4.6],
        [560, 170, 0.5, 2.2],
        [620, 90, 0.65, 3.7],
        [680, 200, 0.4, 1.6],
        [720, 130, 0.55, 2.4],
        [80, 200, 0.35, 3.3],
        [180, 180, 0.5, 4.8],
        [300, 220, 0.3, 2.7],
        [410, 210, 0.45, 1.9],
        [540, 230, 0.6, 3.5],
        [650, 250, 0.4, 2.0],
        [760, 90, 0.7, 4.1],
      ] as Array<[number, number, number, number]>,
    [],
  );

  const mesh = [
    [60, 80, 180, 40],
    [180, 40, 320, 90],
    [320, 90, 480, 30],
    [120, 160, 260, 100],
    [260, 100, 420, 140],
    [420, 140, 600, 80],
    [200, 220, 360, 180],
    [360, 180, 540, 160],
    [540, 160, 700, 100],
  ];

  return (
    <div className="relative h-full min-h-52 overflow-hidden rounded-xl starfield">
      <svg
        viewBox={`0 0 ${geom.w} ${geom.h}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Goal orbit. Equity ${compactMoney(equity)} of ${compactMoney(target)}. Odds ${(odds * 100).toFixed(0)} percent.`}
      >
        <defs>
          <linearGradient id="orbit-gold" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#35D0BA" />
            <stop offset="55%" stopColor="#F5C542" />
            <stop offset="100%" stopColor="#F5C542" />
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

        {mesh.map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#24334F"
            strokeWidth="0.6"
            opacity="0.55"
          />
        ))}

        {stars.map(([x, y, r, delay], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill="#E7EEF9"
            className="motion-safe:animate-twinkle"
            style={{ animationDelay: `${delay}s`, animationDuration: `${2.8 + (i % 5) * 0.4}s` }}
          />
        ))}

        <path
          d={geom.d}
          fill="none"
          stroke="#24334F"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d={geom.d}
          fill="none"
          stroke="#F5C542"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="5 7"
          opacity="0.7"
          className="motion-safe:animate-orbit-dash"
          pathLength={100}
        />
        <path
          d={geom.d}
          fill="none"
          stroke="url(#orbit-gold)"
          strokeWidth="2.4"
          strokeLinecap="round"
          filter="url(#orbit-glow)"
          pathLength={100}
          strokeDasharray={`${progress * 100} 100`}
        />

        <circle cx={geom.x0} cy={geom.y0} r="4.5" fill="#A2B3D1" />
        <text
          x={geom.x0 + 12}
          y={geom.y0 + 5}
          fill="#A2B3D1"
          fontSize="11"
          fontFamily="IBM Plex Mono, monospace"
        >
          {compactMoney(start)}
        </text>

        <g transform={`translate(${ship.x}, ${ship.y})`}>
          <circle r="10" fill="#F5C542" opacity="0.18" className="motion-safe:animate-breathe" />
          <circle r="4.2" fill="#F5C542" />
          <circle r="1.6" fill="#0B1220" />
        </g>
        <text
          x={ship.x + 12}
          y={ship.y - 10}
          fill="#F5C542"
          fontSize="11"
          fontFamily="IBM Plex Mono, monospace"
        >
          {compactMoney(equity)}
        </text>

        <g transform={`translate(${geom.x1}, ${geom.y1})`} filter="url(#star-glow)">
          <path
            d="M0 -14 L2.2 -2.4 L14 0 L2.2 2.4 L0 14 L-2.2 2.4 L-14 0 L-2.2 -2.4 Z"
            fill="#F5C542"
          />
          <circle r="2" fill="#0B1220" />
        </g>
        <text
          x={geom.x1 - 86}
          y={geom.y1 + 28}
          fill="#F5C542"
          fontSize="11"
          fontFamily="IBM Plex Mono, monospace"
        >
          {compactMoney(target)}
        </text>
      </svg>
    </div>
  );
}
