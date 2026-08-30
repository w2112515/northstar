import type { Candle, ForecastPoint } from "@/lib/types";

export function CandleChart({
  candles,
  forecast,
  height = 220,
}: {
  candles: Candle[];
  forecast: ForecastPoint[];
  height?: number;
}) {
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const w = 560;
  const h = height;
  const histN = candles.length;
  const n = histN + forecast.length;
  const allLows = [
    ...candles.map((c) => c.l),
    ...forecast.map((f) => f.lo),
  ];
  const allHighs = [
    ...candles.map((c) => c.h),
    ...forecast.map((f) => f.hi),
  ];
  const min = Math.min(...allLows);
  const max = Math.max(...allHighs);
  const span = Math.max(max - min, 1);
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const x = (i: number) => padL + ((i + 0.5) / n) * plotW;
  const y = (v: number) => padT + ((max - v) / span) * plotH;
  const cw = Math.max(3, (plotW / n) * 0.55);

  const last = candles[candles.length - 1];
  const fan = last
    ? [
        { x: x(histN - 1), mid: last.c, lo: last.c, hi: last.c },
        ...forecast.map((f, i) => ({ x: x(histN + i), ...f })),
      ]
    : [];

  const hiPath = fan.length
    ? `M ${fan.map((p) => `${p.x} ${y(p.hi)}`).join(" L ")} L ${fan
        .slice()
        .reverse()
        .map((p) => `${p.x} ${y(p.lo)}`)
        .join(" L ")} Z`
    : "";
  const midPath = fan.length ? `M ${fan.map((p) => `${p.x} ${y(p.mid)}`).join(" L ")}` : "";

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);

  const xLabels = [0, Math.floor(histN / 3), Math.floor((2 * histN) / 3), histN - 1]
    .filter((i, idx, arr) => candles[i] && arr.indexOf(i) === idx)
    .map((i) => {
      const d = new Date(candles[i]!.t);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      return { i, label };
    });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Price candles with five-day forecast band">
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={w - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="#24334F"
            strokeWidth="1"
          />
          <text
            x={padL - 6}
            y={y(v) + 3}
            textAnchor="end"
            fill="#A2B3D1"
            fontSize="9"
            fontFamily="IBM Plex Mono, monospace"
          >
            {v.toFixed(0)}
          </text>
        </g>
      ))}

      {hiPath && <path d={hiPath} fill="#5B8DEF" opacity="0.12" />}
      {midPath && (
        <path
          d={midPath}
          fill="none"
          stroke="#5B8DEF"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
      )}

      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? "#35D0BA" : "#FF6B6B";
        const cx = x(i);
        return (
          <g key={c.t}>
            <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1" />
            <rect
              x={cx - cw / 2}
              y={y(Math.max(c.o, c.c))}
              width={cw}
              height={Math.max(1, Math.abs(y(c.o) - y(c.c)))}
              fill={color}
              rx="0.5"
            />
            {c.fill && (
              <polygon
                points={
                  c.fill === "buy"
                    ? `${cx},${y(c.l) + 8} ${cx - 4},${y(c.l) + 2} ${cx + 4},${y(c.l) + 2}`
                    : `${cx},${y(c.h) - 8} ${cx - 4},${y(c.h) - 2} ${cx + 4},${y(c.h) - 2}`
                }
                fill={c.fill === "buy" ? "#35D0BA" : "#FF6B6B"}
              />
            )}
          </g>
        );
      })}

      {xLabels.map(({ i, label }) => (
        <text
          key={i}
          x={x(i)}
          y={h - 6}
          textAnchor="middle"
          fill="#A2B3D1"
          fontSize="9"
          fontFamily="IBM Plex Mono, monospace"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
