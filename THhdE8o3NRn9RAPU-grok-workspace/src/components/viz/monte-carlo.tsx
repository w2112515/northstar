import type { McBand } from "@/lib/types";
import { compactMoney } from "@/lib/format";

export function MonteCarloChart({
  band,
  target,
  start,
}: {
  band: McBand[];
  target: number;
  start: number;
}) {
  const w = 640;
  const h = 220;
  const pad = { l: 48, r: 16, t: 12, b: 28 };
  const max = Math.max(target * 1.15, ...band.map((b) => b.p90), start);
  const min = Math.min(start * 0.85, ...band.map((b) => b.p10));
  const span = max - min;
  const months = Math.max(band[band.length - 1]?.month ?? 1, 1);
  const x = (m: number) => pad.l + (m / months) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + ((max - v) / span) * (h - pad.t - pad.b);
  const area = `M ${band.map((b) => `${x(b.month)} ${y(b.p90)}`).join(" L ")} L ${band
    .slice()
    .reverse()
    .map((b) => `${x(b.month)} ${y(b.p10)}`)
    .join(" L ")} Z`;
  const p50 = `M ${band.map((b) => `${x(b.month)} ${y(b.p50)}`).join(" L ")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Monte Carlo p10 p50 p90 band">
      <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="#F5C542" strokeDasharray="4 4" strokeWidth="1" />
      <text x={w - pad.r} y={y(target) - 6} textAnchor="end" fill="#F5C542" fontSize="10" fontFamily="IBM Plex Mono, monospace">
        target {compactMoney(target)}
      </text>
      <path d={area} fill="#5B8DEF" opacity="0.16" />
      <path d={p50} fill="none" stroke="#E7EEF9" strokeWidth="1.6" />
      <text x={pad.l - 6} y={y(max) + 4} textAnchor="end" fill="#A2B3D1" fontSize="9" fontFamily="IBM Plex Mono, monospace">
        {compactMoney(max)}
      </text>
      <text x={pad.l - 6} y={y(min)} textAnchor="end" fill="#A2B3D1" fontSize="9" fontFamily="IBM Plex Mono, monospace">
        {compactMoney(min)}
      </text>
      <text x={pad.l} y={h - 8} fill="#A2B3D1" fontSize="9">
        now
      </text>
      <text x={w - pad.r} y={h - 8} textAnchor="end" fill="#A2B3D1" fontSize="9">
        {months} mo
      </text>
    </svg>
  );
}
