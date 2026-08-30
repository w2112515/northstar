"use client";

/** Market panel: real daily candles (Alpaca data), our own fills as honest
 *  trade markers, and the TimesFM 5-day quantile band drawn into the future.
 *  Print-financial-chart styling on an inset plate. Read-only - nothing on
 *  this panel can place an order. */

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
import { apiGet, fmtUsd } from "@/lib/api";
import { CHART } from "@/lib/theme";
import type { ForecastDoc } from "@/lib/types";

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
type Marker = { date: string; side: string; symbol: string; qty: number; label: string };

// All canvas colors come from lib/theme.ts (the single chart-theme source,
// mirroring the ledger tokens) - never define hex values locally.
const UP = CHART.green;
const DOWN = CHART.red;
const BAND = CHART.ink2;
const MUTED = CHART.ink2;
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
        horzLine: { labelBackgroundColor: CHART.hairline },
        vertLine: { labelBackgroundColor: CHART.hairline },
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
          color: b.c >= b.o ? CHART.greenFill : CHART.redFill,
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
      mk(forecast.q90, BAND, 1, true);
      mk(forecast.q50, CHART.median, 1, true);
      mk(forecast.q10, BAND, 1, true);
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

  return <div ref={holder} className="h-72 w-full sm:h-80 xl:h-[380px]" />;
}

export type WatchGroup = { label: string; symbols: string[] };

export function MarketPanel({
  symbols,
  groups,
  forecastDoc,
}: {
  symbols: string[];
  /** Optional rail grouping (e.g. Holdings / Scout / Core). Must cover `symbols`. */
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
    // paint under the wrong symbol; SWR would refetch the same data on every
    // symbol hop without that guarantee, so this stays hand-rolled.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(active);
  }, [active, load]);

  // The parent refetches the forecast doc on a poll, producing a new object
  // with identical content. Key the chart's forecast input by *content* so the
  // chart is not destroyed and rebuilt (and the user's pan/zoom reset) on
  // every poll tick.
  const fcRaw = forecastDoc?.symbols?.[active] ?? null;
  const fcKey = fcRaw ? JSON.stringify(fcRaw) : "";
  const fc = useMemo<ForecastDoc["symbols"][string] | null>(
    () => (fcKey ? JSON.parse(fcKey) : null),
    [fcKey],
  );

  if (symbols.length === 0) return null;
  const inSync = shownSymbol === active;
  const lastBar = inSync ? bars[bars.length - 1] : undefined;
  // Lots of symbols read better as a watchlist rail than a wall of chips.
  const useRail = symbols.length > 6;
  const railGroups: WatchGroup[] =
    groups && groups.some((g) => g.symbols.length > 0)
      ? groups.filter((g) => g.symbols.length > 0)
      : [{ label: "", symbols }];

  const symbolButton = (s: string, rail: boolean) => (
    <button
      key={s}
      onClick={() => setSel(s)}
      aria-pressed={s === active}
      className={
        rail
          ? `rounded-sm px-2 py-1 text-left font-mono text-body transition-colors ${
              s === active
                ? "bg-inset font-semibold text-ink"
                : "text-ink2 hover:bg-inset/60 hover:text-ink"
            }`
          : `-mb-px border-b-2 px-1.5 py-0.5 font-mono text-micro transition-colors ${
              s === active
                ? "border-indigo font-semibold text-ink"
                : "border-transparent text-ink2 hover:text-ink"
            }`
      }
    >
      {s}
    </button>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-body font-semibold">{active}</span>
          {lastBar && (
            <span className="font-mono text-body tabular-nums text-ink">
              {fmtUsd(lastBar.c, 2)}
            </span>
          )}
        </div>
        <div className={`flex flex-wrap gap-1.5 ${useRail ? "xl:hidden" : ""}`}>
          {symbols.map((s) => symbolButton(s, false))}
        </div>
      </div>
      <div className={useRail ? "xl:flex xl:items-stretch xl:gap-3" : ""}>
        {useRail && (
          <div className="hidden xl:block xl:w-[112px] xl:shrink-0">
            <div className="flex max-h-[380px] flex-col gap-0.5 overflow-y-auto border-r border-hairline pr-2">
              {railGroups.map((g, gi) => (
                <div key={g.label || gi} className="flex flex-col gap-0.5">
                  {g.label && (
                    <div className={`px-2 font-mono text-micro uppercase tracking-[0.12em] text-ink2 ${gi > 0 ? "mt-2.5" : ""}`}>
                      {g.label}
                    </div>
                  )}
                  {g.symbols.map((s) => symbolButton(s, true))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="panel-inset min-w-0 flex-1 px-2 py-2">
          {inSync && err ? (
            <p className="py-10 text-center text-body text-ink2">{err}</p>
          ) : !inSync || bars.length === 0 ? (
            <p className="py-10 text-center font-mono text-micro text-ink2">
              Loading {active} candles…
            </p>
          ) : (
            <Chart bars={bars} markers={markers} forecast={fc} />
          )}
        </div>
      </div>
      <p className="mt-1.5 font-mono text-micro text-ink2">
        real candles · arrows are our own fills · dashed lines are the TimesFM band (model
        estimates, not promises) · read-only
      </p>
    </div>
  );
}
