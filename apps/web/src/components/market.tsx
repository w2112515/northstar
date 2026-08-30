"use client";

/** Market panel: real daily candles (Alpaca data), our own fills as honest
 *  trade markers, and the TimesFM 5-day quantile band drawn into the future.
 *  Grok-prototype visual language; read-only - nothing here places an order. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type Time,
} from "lightweight-charts";
import { Search } from "lucide-react";
import { apiGet, fmtPct } from "@/lib/api";
import { CHART } from "@/lib/theme";
import type { ForecastDoc } from "@/lib/types";

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
type Marker = { date: string; side: string; symbol: string; qty: number; label: string };

// All canvas colors come from lib/theme.ts (the single chart-theme source,
// mirroring the Night Voyage tokens) - never define hex values locally.
const UP = CHART.teal;
const DOWN = CHART.coral;
const BAND = CHART.mist;
const MUTED = CHART.mist;
const GRID = CHART.grid;

/** Next n weekdays after an ISO date (forecast band lives in the future). */
function nextWeekdays(fromIso: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${fromIso}T00:00:00Z`);
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function Chart({
  bars,
  markers,
  forecast,
}: {
  bars: Bar[];
  markers: Marker[];
  forecast: ForecastDoc["symbols"][string] | null;
}) {
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el || bars.length === 0) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: MUTED,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      // leave the bottom ~20% of the pane to the volume histogram
      rightPriceScale: { borderColor: GRID, scaleMargins: { top: 0.05, bottom: 0.24 } },
      timeScale: { borderColor: GRID, rightOffset: 2 },
      crosshair: {
        horzLine: { labelBackgroundColor: CHART.line },
        vertLine: { labelBackgroundColor: CHART.line },
      },
      // the page owns the scroll wheel; drag to pan, pinch to zoom,
      // double-click resets - no more wandering off into empty space
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
    });
    const resetView = () => chart.timeScale().fitContent();
    el.addEventListener("dblclick", resetView);

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      priceLineVisible: false, // that full-width dashed line was read as "floating"
    });
    candles.setData(
      bars.map((b) => ({ time: b.t as Time, open: b.o, high: b.h, low: b.l, close: b.c })),
    );

    // Volume sub-pane: same colors as the candles at low alpha, own scale
    // pinned to the bottom fifth so it never collides with price.
    if (bars.some((b) => b.v > 0)) {
      const volume = chart.addSeries(HistogramSeries, {
        priceScaleId: "vol",
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(
        bars.map((b) => ({
          time: b.t as Time,
          value: b.v,
          color: b.c >= b.o ? CHART.tealFill : CHART.coralFill,
        })),
      );
    }

    // TimesFM band: q10/q50/q90 drawn on future weekdays, anchored at last close
    if (forecast && bars.length) {
      const last = bars[bars.length - 1];
      const days = nextWeekdays(last.t, forecast.q50.length);
      const anchor = { time: last.t as Time, value: last.c };
      const mk = (values: number[], color: string, width: 1 | 2, dashed: boolean) => {
        const s = chart.addSeries(LineSeries, {
          color,
          lineWidth: width,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        s.setData([anchor, ...values.map((v, i) => ({ time: days[i] as Time, value: v }))]);
      };
      mk(forecast.q90, CHART.signal, 1, true);
      mk(forecast.q50, BAND, 1, true);
      mk(forecast.q10, CHART.signal, 1, true);
    }

    if (markers.length) {
      const known = new Set(bars.map((b) => b.t));
      createSeriesMarkers(
        candles,
        markers
          .filter((m) => known.has(m.date))
          .map((m) => ({
            time: m.date as Time,
            position: m.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
            color: m.side === "buy" ? UP : DOWN,
            shape: m.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
            text: `${m.side === "buy" ? "B" : "S"}${m.qty ? Math.round(m.qty) : ""}`,
          })),
      );
    }

    chart.timeScale().fitContent();
    return () => {
      el.removeEventListener("dblclick", resetView);
      chart.remove();
    };
  }, [bars, markers, forecast]);

  return <div ref={holder} className="h-full w-full" />;
}

export type WatchGroup = { label: string; symbols: string[] };

export function MarketPanel({
  symbols,
  groups,
  forecastDoc,
}: {
  symbols: string[];
  /** Rail grouping (Holdings / Scout / Core). Must cover `symbols`. */
  groups?: WatchGroup[];
  forecastDoc: ForecastDoc | null;
}) {
  const [sel, setSel] = useState("");
  const active = sel && symbols.includes(sel) ? sel : symbols[0] ?? "";
  const [bars, setBars] = useState<Bar[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  // Which symbol the bars in state actually belong to. Until it catches up
  // with `active`, the header shows no price and the pane shows a loader -
  // never another symbol's candles under the new symbol's name.
  const [shownSymbol, setShownSymbol] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState<string[]>([]);
  const seqRef = useRef(0);

  const load = useCallback(async (symbol: string) => {
    if (!symbol) return;
    const seq = ++seqRef.current;
    try {
      const [b, f] = await Promise.all([
        apiGet<{ bars: Bar[]; error?: string }>(`/api/market/bars?symbol=${symbol}&days=130`),
        apiGet<{ markers: Marker[] }>(`/api/market/fills?symbol=${symbol}`),
      ]);
      if (seq !== seqRef.current) return; // a newer request superseded this one
      setBars(b.bars);
      setMarkers(f.markers);
      setShownSymbol(symbol);
      setErr(!b.bars.length ? (b.error ? `No data: ${b.error}` : "No bars for this symbol.") : "");
    } catch {
      if (seq !== seqRef.current) return;
      setErr("Chart data unreachable.");
      setBars([]);
      setMarkers([]);
      setShownSymbol(symbol);
    }
  }, []);

  useEffect(() => {
    // Bars are keyed by a request token (seqRef) so stale responses can never
    // paint under the wrong symbol.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(active);
  }, [active, load]);

  // The parent refetches the forecast doc on a poll, producing a new object
  // with identical content. Key the chart's forecast input by *content* so the
  // chart is not destroyed and rebuilt on every poll tick.
  const fcRaw = forecastDoc?.symbols?.[active] ?? null;
  const fcKey = fcRaw ? JSON.stringify(fcRaw) : "";
  const fc = useMemo<ForecastDoc["symbols"][string] | null>(
    () => (fcKey ? JSON.parse(fcKey) : null),
    [fcKey],
  );

  const railGroups: WatchGroup[] = (
    groups && groups.some((g) => g.symbols.length > 0)
      ? groups.filter((g) => g.symbols.length > 0)
      : [{ label: "", symbols }]
  )
    .concat(custom.length ? [{ label: "Typed", symbols: custom }] : [])
    .map((g) => ({ ...g, symbols: g.symbols.slice(0, 12) }));

  const inSync = shownSymbol === active;
  const lastBar = inSync ? bars[bars.length - 1] : undefined;
  const prevBar = inSync && bars.length > 1 ? bars[bars.length - 2] : undefined;
  const change = lastBar && prevBar ? lastBar.c / prevBar.c - 1 : null;

  const pickTyped = () => {
    const typed = q.trim().toUpperCase();
    if (!/^[A-Z][A-Z.\-]{0,7}$/.test(typed)) return;
    if (!symbols.includes(typed) && !custom.includes(typed)) setCustom((c) => [...c, typed]);
    setSel(typed);
    setQ("");
  };

  if (symbols.length === 0) return null;

  return (
    <div className="flex h-full min-h-72 flex-col">
      <div className="flex min-w-0 items-center gap-2">
        <span className="kicker">Market</span>
        <span className="text-sm text-ink">{active}</span>
        {lastBar && (
          <span className={`num text-xs ${change != null && change < 0 ? "text-coral" : "text-teal"}`}>
            {lastBar.c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            {change != null ? fmtPct(change, 1) : ""}
          </span>
        )}
        <div className="relative ml-auto w-40">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pickTyped();
              }
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Any ticker"
            aria-label="Load any ticker"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-full rounded-md bg-void pl-8 pr-2 text-xs text-ink shadow-border placeholder:text-mist/60"
          />
        </div>
      </div>

      <div className={`mt-2 min-h-0 flex-1 ${!inSync ? "opacity-60" : ""} h-44`}>
        {inSync && err ? (
          <p className="py-10 text-center text-sm text-mist">{err}</p>
        ) : !inSync || bars.length === 0 ? (
          <p className="py-10 text-center font-mono text-micro text-mist">Loading {active} candles…</p>
        ) : (
          <Chart bars={bars} markers={markers} forecast={fc} />
        )}
      </div>

      <div className="mt-3 max-h-36 space-y-0.5 overflow-y-auto">
        {railGroups.map((g) => (
          <div key={g.label || "all"}>
            {g.label && (
              <div className="px-2 pt-1.5 font-mono text-micro uppercase tracking-[0.12em] text-mist">
                {g.label}
              </div>
            )}
            <ul className="grid grid-cols-2 gap-0.5">
              {g.symbols.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setSel(s)}
                    aria-pressed={s === active}
                    className={`flex h-9 w-full items-center justify-between rounded-sm px-2 text-left text-xs transition-[background-color,color] duration-150 ${
                      s === active ? "bg-panel text-ink" : "text-mist hover:bg-panel/60 hover:text-ink"
                    }`}
                  >
                    <span className="num">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-1.5 font-mono text-micro text-mist">
        real candles · arrows are our own fills · dashed lines are the TimesFM band (model
        estimates, not promises) · read-only
      </p>
    </div>
  );
}
