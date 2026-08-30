import { Search } from "lucide-react";
import { CandleChart } from "@/components/viz/candles";
import {
  buildForecast,
  loadTape,
  searchTape,
  searchUniverse,
  syntheticQuote,
  type TapeHit,
  type TapeQuote,
} from "@/lib/tape";
import { UNIVERSE_UNIQ } from "@/lib/universe";
import { sampleWatchlist } from "@/lib/seed";
import { useVoyage } from "@/lib/store";
import { cn } from "@/lib/cn";
import { pct } from "@/lib/format";
import { useEffect, useMemo, useRef, useState } from "react";

const GROUPS = [
  { id: "holdings", label: "Holdings" },
  { id: "scout", label: "Scout" },
  { id: "core", label: "Core" },
] as const;

function price(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function asHits(rows: { symbol: string; name: string }[]): TapeHit[] {
  return rows.map((row) => ({ symbol: row.symbol, name: row.name, type: "", exchange: "" }));
}

export function MarketPanel() {
  const positions = useVoyage((s) => s.positions);
  const watch = useMemo(() => sampleWatchlist(), []);
  const holdings = useMemo(() => {
    const seen = new Set<string>();
    const rows: { symbol: string; last: number; change: number }[] = [];
    for (const p of positions) {
      if (seen.has(p.symbol)) continue;
      seen.add(p.symbol);
      rows.push({
        symbol: p.symbol,
        last: p.last,
        change: p.avgCost ? (p.last - p.avgCost) / p.avgCost : 0,
      });
    }
    return rows;
  }, [positions]);

  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("holdings");
  const [symbol, setSymbol] = useState("SPY");
  const [quote, setQuote] = useState<TapeQuote>(() => syntheticQuote("SPY", 644.2));
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<TapeHit[]>(() => asHits(UNIVERSE_UNIQ.slice(0, 10)));
  const box = useRef<HTMLDivElement>(null);
  const req = useRef(0);

  const list =
    group === "holdings"
      ? holdings
      : watch.filter((w) => w.group === group).map((w) => ({ symbol: w.symbol, last: w.last, change: w.change }));

  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    void loadTape({ data: { symbol } })
      .then((row) => {
        if (req.current !== id) return;
        setQuote(row);
      })
      .catch(() => {
        if (req.current !== id) return;
        setQuote(syntheticQuote(symbol));
      })
      .finally(() => {
        if (req.current === id) setLoading(false);
      });
  }, [symbol]);

  useEffect(() => {
    if (!open) return;
    const needle = q.trim();
    if (needle.length < 1) {
      setHits(asHits(UNIVERSE_UNIQ.slice(0, 10)));
      return;
    }
    const local = searchUniverse(needle, 8);
    setHits(local);
    if (needle.length < 2) return;
    const t = window.setTimeout(() => {
      void searchTape({ data: { q: needle } }).then((rows) => {
        if (q.trim() !== needle) return;
        setHits(rows.length ? rows : local);
      });
    }, 180);
    return () => window.clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const forecast = useMemo(() => buildForecast(quote.last), [quote.last]);
  const pick = (sym: string) => {
    setSymbol(sym.toUpperCase());
    setQ("");
    setOpen(false);
  };

  return (
    <section className="panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="kicker">Market</span>
        <span className="text-sm text-ink">{quote.symbol}</span>
        <span className={cn("num text-xs", quote.change >= 0 ? "text-teal" : "text-coral")}>
          {price(quote.last)} {pct(quote.change * 100)}
        </span>
        {!quote.live && !loading && <span className="text-micro text-mist">paper path</span>}
      </div>
      <p className="mt-0.5 truncate text-2xs text-mist">{quote.name}</p>

      <div ref={box} className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              const first = hits[0];
              const typed = q.trim().toUpperCase();
              if (first) pick(first.symbol);
              else if (/^[A-Z][A-Z.\-]{0,7}$/.test(typed)) pick(typed);
            }
          }}
          placeholder="Any name or ticker"
          aria-label="Search the tape"
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-md bg-void px-8 text-sm text-ink shadow-border placeholder:text-mist/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]"
        />
        {open && (
          <ul
            role="listbox"
            className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md bg-night py-1 hairline shadow-panel"
          >
            {hits.length === 0 ? (
              <li className="px-3 py-2 text-2xs text-mist">No match. Enter a ticker to load it anyway.</li>
            ) : (
              hits.map((hit) => (
                <li key={hit.symbol}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => pick(hit.symbol)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-panel"
                  >
                    <span className="num text-sm text-ink">{hit.symbol}</span>
                    <span className="min-w-0 truncate text-2xs text-mist">
                      {hit.name}
                      {hit.exchange ? ` · ${hit.exchange}` : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className={cn("mt-2 h-44 min-h-0 flex-1", loading && "opacity-60")}>
        <CandleChart candles={quote.candles} forecast={forecast} />
      </div>
      <div className="mt-3 flex gap-0.5 rounded-md bg-void p-0.5">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGroup(g.id);
              const first =
                g.id === "holdings" ? holdings[0] : watch.find((w) => w.group === g.id);
              if (first) setSymbol(first.symbol);
            }}
            className={cn(
              "h-9 flex-1 rounded-sm px-2 text-xs transition-[color,background-color] duration-150",
              group === g.id ? "bg-panel text-ink" : "text-mist hover:text-ink",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <ul className="mt-1.5 grid grid-cols-2 gap-0.5">
        {list.length === 0 ? (
          <li className="col-span-2 px-2 py-2 text-2xs text-mist">Nothing in this book yet.</li>
        ) : (
          list.map((w) => (
            <li key={w.symbol}>
              <button
                type="button"
                onClick={() => pick(w.symbol)}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-sm px-2 text-left text-xs",
                  "transition-[background-color,color] duration-150",
                  symbol === w.symbol ? "bg-panel text-ink" : "text-mist hover:bg-panel/60 hover:text-ink",
                )}
              >
                <span>{w.symbol}</span>
                <span className={cn("num", w.change >= 0 ? "text-teal" : "text-coral")}>
                  {pct(w.change * 100, 1)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
