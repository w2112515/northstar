"use client";

/** Market panel: a faithful copy of the TradingView terminal conventions
 *  (we render with lightweight-charts, TradingView's own OSS library):
 *  crosshair-synced OHLCV legend inside the pane, MA20/50 overlays, dotted
 *  last-price line with an axis tag, range switcher (visible-range only, one
 *  fetch), and a watchlist with Last/Chg% columns. Data stays honest: real
 *  daily candles (Alpaca), our own fills as markers, TimesFM band dashed
 *  into the future. The only write is the Pin button (manual pool) - nothing
 *  here places an order. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { Pin, Search } from "lucide-react";
import { apiDelete, apiGet, apiPost, fmtPct } from "@/lib/api";
import { useApi } from "@/lib/data";
import { CHART } from "@/lib/theme";
import type { ForecastDoc } from "@/lib/types";

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
type Marker = { date: string; side: string; symbol: string; qty: number; label: string };
type Quote = { last: number; prev_close: number | null; chg: number | null; t: string };
type Pt = { t: string; v: number };

// All canvas colors come from lib/theme.ts (the single chart-theme source,
// mirroring the Night Voyage tokens) - never define hex values locally.
const UP = CHART.teal;
const DOWN = CHART.coral;
const BAND = CHART.mist;
const MUTED = CHART.mist;
const GRID = CHART.grid;
const MA_FAST = CHART.signal; // MA20
const MA_SLOW = CHART.violet; // MA50

/** How many trailing daily bars each range button reveals (trading days). */
const RANGES = [
  { key: "1M", days: 22 },
  { key: "3M", days: 66 },
  { key: "6M", days: 130 },
  { key: "1Y", days: 250 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];
const FETCH_DAYS = 260; // one fetch covers every range; buttons only re-frame

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

function sma(bars: Bar[], n: number): Pt[] {
  const out: Pt[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].c;
    if (i >= n) sum -= bars[i - n].c;
    if (i >= n - 1) out.push({ t: bars[i].t, v: sum / n });
  }
  return out;
}

const fmtNum = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${Math.round(v)}`;

function Chart({
  bars,
  markers,
  forecast,
  ma20,
  ma50,
  rangeDays,
  onHover,
}: {
  bars: Bar[];
  markers: Marker[];
  forecast: ForecastDoc["symbols"][string] | null;
  ma20: Pt[];
  ma50: Pt[];
  rangeDays: number;
  onHover: (t: string | null) => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const barsLenRef = useRef(0);
  const futureRef = useRef(0); // forecast weekdays appended after the last bar
  const rangeRef = useRef(rangeDays); // read by the dblclick reset handler

  // TradingView-style range framing: show the trailing N bars plus the
  // forecast tail, without refetching or rebuilding anything.
  const applyRange = useCallback((days: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, barsLenRef.current - days) - 0.5,
      to: barsLenRef.current + futureRef.current + 1.5,
    });
  }, []);

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
      // the product language is English; never inherit the OS locale
      localization: { locale: "en-US" },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      // leave the bottom ~20% of the pane to the volume histogram
      rightPriceScale: { borderColor: GRID, scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: GRID, rightOffset: 2 },
      crosshair: {
        horzLine: { labelBackgroundColor: CHART.line },
        vertLine: { labelBackgroundColor: CHART.line },
      },
      // terminal convention: wheel zooms the time scale (pointer over the
      // pane consumes the event so the page does not scroll). Drag pans;
      // double-click resets to the selected range.
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: false,
      },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      // terminal convention: dotted line + axis tag at the last trade price
      priceLineVisible: true,
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
      lastValueVisible: true,
    });
    candles.setData(
      bars.map((b) => ({ time: b.t as Time, open: b.o, high: b.h, low: b.l, close: b.c })),
    );

    // MA overlays (values mirrored in the legend, TradingView-style)
    const mkMa = (pts: Pt[], color: string) => {
      if (pts.length === 0) return;
      const s = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(pts.map((p) => ({ time: p.t as Time, value: p.v })));
    };
    mkMa(ma20, MA_FAST);
    mkMa(ma50, MA_SLOW);

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
    let futureDays = 0;
    if (forecast && bars.length) {
      const last = bars[bars.length - 1];
      const days = nextWeekdays(last.t, forecast.q50.length);
      futureDays = days.length;
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
    barsLenRef.current = bars.length;
    futureRef.current = futureDays;

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

    // crosshair → OHLCV legend (parent renders it; ref-guard kills churn)
    let lastT: string | null = null;
    chart.subscribeCrosshairMove((param) => {
      const t = typeof param.time === "string" ? param.time : null;
      if (t !== lastT) {
        lastT = t;
        onHover(t);
      }
    });

    const resetView = () => applyRange(rangeRef.current);
    el.addEventListener("dblclick", resetView);
    resetView();

    return () => {
      el.removeEventListener("dblclick", resetView);
      onHover(null);
      chartRef.current = null;
      chart.remove();
    };
  }, [bars, markers, forecast, ma20, ma50, onHover, applyRange]);

  useEffect(() => {
    rangeRef.current = rangeDays;
    applyRange(rangeDays);
  }, [rangeDays, applyRange]);

  return <div ref={holder} className="h-full w-full" />;
}

export type WatchGroup = { label: string; symbols: string[] };

export function MarketPanel({
  symbols,
  groups,
  forecastDoc,
  variant = "terminal",
}: {
  symbols: string[];
  /** rail = stacked chart + list for a tall narrow column */
  variant?: "terminal" | "rail";
  /** Rail grouping (Holdings / Scout / Core). Must cover `symbols`. */
  groups?: WatchGroup[];
  forecastDoc: ForecastDoc | null;
}) {
  const [sel, setSel] = useState("");
  const [custom, setCustom] = useState<string[]>([]);
  // typed tickers are selectable too - the prop list alone would silently
  // bounce the selection back to symbols[0]
  const active = sel && (symbols.includes(sel) || custom.includes(sel)) ? sel : symbols[0] ?? "";
  const [bars, setBars] = useState<Bar[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  // Which symbol the bars in state actually belong to. Until it catches up
  // with `active`, the header shows no price and the pane shows a loader -
  // never another symbol's candles under the new symbol's name.
  const [shownSymbol, setShownSymbol] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [badQ, setBadQ] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("6M");
  const [hovT, setHovT] = useState<string | null>(null);
  const seqRef = useRef(0);

  const load = useCallback(async (symbol: string) => {
    if (!symbol) return;
    const seq = ++seqRef.current;
    try {
      const [b, f] = await Promise.all([
        apiGet<{ bars: Bar[]; error?: string }>(`/api/market/bars?symbol=${symbol}&days=${FETCH_DAYS}`),
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

  // typed names that got pinned (or otherwise joined a group) leave "Typed"
  const typedOnly = custom.filter((c) => !(groups ?? []).some((g) => g.symbols.includes(c)));
  const railGroups: WatchGroup[] = (
    groups && groups.some((g) => g.symbols.length > 0)
      ? groups.filter((g) => g.symbols.length > 0)
      : [{ label: "", symbols }]
  )
    .concat(typedOnly.length ? [{ label: "Typed", symbols: typedOnly }] : [])
    .map((g) => ({ ...g, symbols: g.symbols.slice(0, 12) }));

  // One batched quotes call feeds every watchlist row (Last / Chg%). No memo
  // needed: the SWR key below is a string, stable by value across renders.
  const railSyms = [...new Set(railGroups.flatMap((g) => g.symbols))].slice(0, 24);
  const quotesQ = useApi<{ quotes: Record<string, Quote> }>(
    railSyms.length ? `/api/market/quotes?symbols=${railSyms.join(",")}` : null,
    60_000,
  );
  const quotes = quotesQ.data?.quotes ?? {};

  const inSync = shownSymbol === active;
  const ma20 = useMemo(() => sma(bars, 20), [bars]);
  const ma50 = useMemo(() => sma(bars, 50), [bars]);
  const byTime = useMemo(() => new Map(bars.map((b, i) => [b.t, i] as const)), [bars]);
  const ma20ByT = useMemo(() => new Map(ma20.map((p) => [p.t, p.v])), [ma20]);
  const ma50ByT = useMemo(() => new Map(ma50.map((p) => [p.t, p.v])), [ma50]);

  // legend bar: the hovered candle, else the latest one (TradingView behavior)
  const legendIdx = inSync
    ? (hovT != null ? byTime.get(hovT) : undefined) ?? (bars.length ? bars.length - 1 : undefined)
    : undefined;
  const legendBar = legendIdx != null ? bars[legendIdx] : undefined;
  const legendPrev = legendIdx != null && legendIdx > 0 ? bars[legendIdx - 1] : undefined;
  const legendChg = legendBar && legendPrev ? legendBar.c / legendPrev.c - 1 : null;

  const lastBar = inSync ? bars[bars.length - 1] : undefined;
  const prevBar = inSync && bars.length > 1 ? bars[bars.length - 2] : undefined;
  const change = lastBar && prevBar ? lastBar.c / prevBar.c - 1 : null;

  const rangeDays = RANGES.find((r) => r.key === rangeKey)?.days ?? 130;
  const onHover = useCallback((t: string | null) => setHovT(t), []);

  // Manual pool: pinning is the panel's only write - it adds the name to the
  // equity strategies' tradable universe, it never places an order.
  const watchQ = useApi<{ symbols: string[] }>("/api/market/watch", 60_000);
  const pinned = watchQ.data?.symbols ?? [];
  const isPinned = pinned.includes(active);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const togglePin = async () => {
    if (!active || pinBusy) return;
    setPinBusy(true);
    setPinMsg("");
    try {
      const out = isPinned
        ? await apiDelete<{ ok: boolean; error?: string }>(`/api/market/watch/${active}`)
        : await apiPost<{ ok: boolean; error?: string }>("/api/market/watch", { symbol: active });
      if (!out.ok) setPinMsg(out.error ?? "Couldn't update the pool.");
      await watchQ.mutate();
    } catch {
      setPinMsg("Couldn't update the pool - try again.");
    } finally {
      setPinBusy(false);
    }
  };

  const pickTyped = () => {
    const typed = q.trim().toUpperCase();
    if (!/^[A-Z][A-Z.\-]{0,7}$/.test(typed)) {
      // silent rejection reads as a dead input - say why nothing happened
      setBadQ(true);
      return;
    }
    if (!symbols.includes(typed) && !custom.includes(typed)) setCustom((c) => [...c, typed]);
    setSel(typed);
    setQ("");
  };

  if (symbols.length === 0) return null;

  const rail = variant === "rail";

  return (
    <div className={`flex min-h-0 flex-col ${rail ? "" : "min-h-[28rem]"}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="kicker">Market</span>
        <span className="text-sm font-medium text-ink">{active}</span>
        {lastBar && (
          <span className={`num text-xs ${change != null && change < 0 ? "text-coral" : "text-teal"}`}>
            {fmtNum(lastBar.c)} {change != null ? fmtPct(change, 1) : ""}
          </span>
        )}
        <button
          type="button"
          onClick={togglePin}
          disabled={pinBusy || !active}
          aria-pressed={isPinned}
          title={
            isPinned
              ? `Unpin ${active} - if held, strategies still manage the exit`
              : `Pin ${active} to the pool - equity strategies will include it in their universe`
          }
          className={`ml-auto flex h-11 shrink-0 items-center gap-1 rounded-md px-2.5 font-mono text-micro transition-colors duration-150 disabled:opacity-50 md:h-8 ${
            isPinned ? "bg-panel text-ink shadow-border" : "text-mist shadow-border hover:text-ink"
          }`}
        >
          <Pin className={`size-3 ${isPinned ? "fill-current" : ""}`} aria-hidden />
          {isPinned ? "Pinned" : "Pin"}
        </button>
        <div className="relative w-40">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setBadQ(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pickTyped();
              }
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Any ticker"
            aria-label="Load any ticker"
            aria-invalid={badQ || undefined}
            autoComplete="off"
            spellCheck={false}
            className={`h-11 w-full rounded-md bg-void pl-8 pr-2 text-xs text-ink placeholder:text-mist/75 md:h-8 ${
              badQ ? "shadow-tone-coral" : "shadow-border"
            }`}
          />
        </div>
      </div>
      {badQ && (
        <p className="mt-1 text-right font-mono text-micro text-coral">
          Tickers are letters only, up to 8 characters.
        </p>
      )}
      {pinMsg && <p className="mt-1 text-right font-mono text-micro text-coral">{pinMsg}</p>}

      <div
        className={`mt-2 grid min-h-0 gap-3 ${
          rail ? "grid-cols-1" : "flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_11rem]"
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <div
            className={`relative ${rail ? "h-64" : "h-[22rem]"} ${!inSync ? "opacity-60" : ""}`}
          >
            {legendBar && !err && (
              <div
                aria-hidden
                className="pointer-events-none absolute left-1.5 top-1 z-10 select-none font-mono text-micro leading-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-ink">
                    {active} <span className="text-mist">· D</span>
                  </span>
                  {(
                    [
                      ["O", legendBar.o],
                      ["H", legendBar.h],
                      ["L", legendBar.l],
                      ["C", legendBar.c],
                    ] as const
                  ).map(([k, v]) => (
                    <span key={k} className="text-mist">
                      {k}{" "}
                      <span className={legendBar.c >= legendBar.o ? "text-teal" : "text-coral"}>
                        {fmtNum(v)}
                      </span>
                    </span>
                  ))}
                  {legendChg != null && (
                    <span className={legendChg < 0 ? "text-coral" : "text-teal"}>
                      {fmtPct(legendChg, 2)}
                    </span>
                  )}
                  {legendBar.v > 0 && (
                    <span className="text-mist">
                      Vol <span className="text-ink">{fmtVol(legendBar.v)}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {ma20ByT.has(legendBar.t) && (
                    <span style={{ color: MA_FAST }}>MA20 {fmtNum(ma20ByT.get(legendBar.t)!)}</span>
                  )}
                  {ma50ByT.has(legendBar.t) && (
                    <span style={{ color: MA_SLOW }}>MA50 {fmtNum(ma50ByT.get(legendBar.t)!)}</span>
                  )}
                </div>
              </div>
            )}
            {inSync && err ? (
              <p className="py-10 text-center text-sm text-mist">{err}</p>
            ) : !inSync || bars.length === 0 ? (
              <p className="py-10 text-center font-mono text-micro text-mist">Loading {active} candles…</p>
            ) : (
              <Chart
                bars={bars}
                markers={markers}
                forecast={fc}
                ma20={ma20}
                ma50={ma50}
                rangeDays={rangeDays}
                onHover={onHover}
              />
            )}
          </div>
          <div className="mt-1 flex items-center gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                aria-pressed={r.key === rangeKey}
                className={`h-6 rounded-sm px-2 font-mono text-micro transition-colors duration-150 ${
                  r.key === rangeKey ? "bg-panel text-ink" : "text-mist hover:text-ink"
                }`}
              >
                {r.key}
              </button>
            ))}
            <span className="ml-auto hidden font-mono text-micro text-mist/75 sm:block">
              scroll to zoom · drag to pan · double-click resets
            </span>
          </div>
        </div>

        <div
          className={`space-y-0.5 overflow-y-auto ${
            rail ? "max-h-52" : "max-h-56 md:max-h-[22rem]"
          }`}
        >
          {railGroups.map((g) => (
            <div key={g.label || "all"}>
              {g.label && (
                <div className="px-2 pt-1.5 font-mono text-micro uppercase tracking-[0.12em] text-mist">
                  {g.label}
                </div>
              )}
              <ul>
                {g.symbols.map((s) => {
                  const qt = quotes[s];
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => setSel(s)}
                        aria-pressed={s === active}
                        className={`grid min-h-11 w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-sm px-2 text-left text-xs transition-[background-color,color] duration-150 md:min-h-8 ${
                          s === active ? "bg-panel text-ink" : "text-mist hover:bg-panel/60 hover:text-ink"
                        }`}
                      >
                        <span className="num">{s}</span>
                        <span className="num text-right text-ink">
                          {qt ? fmtNum(qt.last) : "—"}
                        </span>
                        <span
                          className={`num w-14 text-right ${
                            qt?.chg == null ? "text-mist/75" : qt.chg < 0 ? "text-coral" : "text-teal"
                          }`}
                        >
                          {qt?.chg != null ? fmtPct(qt.chg, 2) : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1.5 font-mono text-micro text-mist">
        real candles · arrows are our own fills · dashed lines are the TimesFM band (model
        estimates, not promises) · read-only
      </p>
    </div>
  );
}
