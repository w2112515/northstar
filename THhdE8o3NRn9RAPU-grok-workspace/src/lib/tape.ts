import { createServerFn } from "@tanstack/react-start";
import type { Candle } from "./types";
import { UNIVERSE_UNIQ, type UniverseRow } from "./universe";
import { buildCandles, buildForecast } from "./seed";

export type TapeHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};

export type TapeQuote = {
  symbol: string;
  name: string;
  last: number;
  prev: number;
  change: number;
  candles: Candle[];
  live: boolean;
};

const YAHOO_UA =
  "Mozilla/5.0 (compatible; NorthStar/1.0; paper-trading copilot)";

function yahooSymbol(raw: string) {
  return raw.trim().toUpperCase().replace(/\./g, "-");
}

function displaySymbol(yahoo: string) {
  return yahoo.replace(/-/g, ".");
}

export function searchUniverse(q: string, limit = 12): TapeHit[] {
  const needle = q.trim().toUpperCase();
  if (!needle) return [];
  const starts: UniverseRow[] = [];
  const named: UniverseRow[] = [];
  for (const row of UNIVERSE_UNIQ) {
    if (row.symbol.startsWith(needle)) starts.push(row);
    else if (row.name.toUpperCase().includes(needle)) named.push(row);
    if (starts.length + named.length >= limit * 2) break;
  }
  return [...starts, ...named].slice(0, limit).map((row) => ({
    symbol: row.symbol,
    name: row.name,
    type: "Equity",
    exchange: "",
  }));
}

function syntheticLast(symbol: string) {
  const seed = symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return Math.round((18 + (seed % 520) + (seed % 97) / 10) * 100) / 100;
}

export function syntheticQuote(symbol: string, last = syntheticLast(symbol)): TapeQuote {
  const sym = symbol.trim().toUpperCase();
  const named = UNIVERSE_UNIQ.find((r) => r.symbol === sym);
  const candles = buildCandles(sym, last);
  const prev = candles.length > 1 ? candles[candles.length - 2]!.c : last * 0.997;
  return {
    symbol: sym,
    name: named?.name ?? sym,
    last,
    prev,
    change: prev ? (last - prev) / prev : 0,
    candles,
    live: false,
  };
}

export { buildForecast };

async function yahooJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tape ${res.status}`);
  return res.json() as Promise<unknown>;
}

function mergeHits(local: TapeHit[], remote: TapeHit[], limit: number) {
  const seen = new Set<string>();
  const out: TapeHit[] = [];
  for (const hit of [...local, ...remote]) {
    const key = hit.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export const searchTape = createServerFn({ method: "GET" })
  .validator((d: unknown) => {
    const q =
      typeof d === "object" && d && "q" in d ? String((d as { q: unknown }).q) : "";
    return { q: q.trim().slice(0, 40) };
  })
  .handler(async ({ data }): Promise<TapeHit[]> => {
    const q = data.q;
    const local = searchUniverse(q, 8);
    if (q.length < 1) return local;
    try {
      const json = (await yahooJson(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0`,
      )) as {
        quotes?: Array<{
          symbol?: string;
          shortname?: string;
          longname?: string;
          quoteType?: string;
          typeDisp?: string;
          exchDisp?: string;
          exchange?: string;
        }>;
      };
      const remote: TapeHit[] = (json.quotes ?? [])
        .filter((row) => {
          const kind = (row.quoteType ?? row.typeDisp ?? "").toUpperCase();
          if (kind !== "EQUITY" && kind !== "ETF" && kind !== "INDEX") return false;
          const disp = displaySymbol(row.symbol ?? "");
          if (!disp) return false;
          if (disp.includes(".") && !/^[A-Z]{1,5}\.[A-Z]$/.test(disp)) return false;
          const ex = `${row.exchDisp ?? ""} ${row.exchange ?? ""}`;
          if (ex.trim() && !/NASDAQ|NYSE|NYQ|NMS|NGM|PCX|ASE|Cboe|ARCA|NYSEArca|BTS/i.test(ex)) {
            return false;
          }
          return true;
        })
        .map((row) => ({
          symbol: displaySymbol(row.symbol ?? ""),
          name: row.shortname || row.longname || row.symbol || "",
          type: row.typeDisp || row.quoteType || "",
          exchange: row.exchDisp || row.exchange || "",
        }))
        .filter((row) => row.symbol);
      return mergeHits(local, remote, 12);
    } catch {
      return local;
    }
  });

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
};

export const loadTape = createServerFn({ method: "GET" })
  .validator((d: unknown) => {
    const symbol =
      typeof d === "object" && d && "symbol" in d
        ? String((d as { symbol: unknown }).symbol)
        : "";
    return { symbol: yahooSymbol(symbol).slice(0, 16) };
  })
  .handler(async ({ data }): Promise<TapeQuote> => {
    const symbol = data.symbol;
    if (!symbol) return syntheticQuote("SPY");
    try {
      const json = (await yahooJson(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`,
      )) as YahooChart;
      const result = json.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const ts = result?.timestamp ?? [];
      if (!result || !quote || ts.length < 8) throw new Error("empty tape");
      const candles: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = quote.open?.[i];
        const h = quote.high?.[i];
        const l = quote.low?.[i];
        const c = quote.close?.[i];
        if (o == null || h == null || l == null || c == null) continue;
        candles.push({
          t: new Date(ts[i]! * 1000).toISOString(),
          o,
          h,
          l,
          c,
        });
      }
      if (candles.length < 8) throw new Error("thin tape");
      const last =
        result.meta?.regularMarketPrice ?? candles[candles.length - 1]!.c;
      const prev =
        result.meta?.chartPreviousClose ??
        result.meta?.previousClose ??
        candles[Math.max(0, candles.length - 2)]!.c;
      candles[candles.length - 1]!.c = last;
      candles[candles.length - 1]!.h = Math.max(candles[candles.length - 1]!.h, last);
      candles[candles.length - 1]!.l = Math.min(candles[candles.length - 1]!.l, last);
      return {
        symbol: displaySymbol(result.meta?.symbol ?? symbol),
        name: result.meta?.shortName || result.meta?.longName || displaySymbol(symbol),
        last,
        prev,
        change: prev ? (last - prev) / prev : 0,
        candles,
        live: true,
      };
    } catch {
      return syntheticQuote(displaySymbol(symbol));
    }
  });
