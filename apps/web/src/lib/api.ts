export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const fmtUsd = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined
    ? "-"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: digits,
      });

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? "-" : `${(n * 100).toFixed(digits)}%`;

/** One timestamp dialect for the whole terminal: New York market time. */
const TS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const fmtTs = (ts: string | number | Date) => `${TS_FMT.format(new Date(ts))} NY`;

/** Day-grouping dialect for the Proof ledger: "Sat, Aug 30" in market time. */
const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const fmtDay = (ts: string | number | Date) => DAY_FMT.format(new Date(ts));

/** Options symbols arrive in OCC format (SPY261016C00790000); people don't read OCC. */
export const humanSymbol = (occ: string) => {
  const m = occ.match(/^([A-Z.]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!m) return occ;
  const [, under, yy, mm, dd, cp, strike8] = m;
  const strike = (parseInt(strike8, 10) / 1000).toFixed(2).replace(/\.?0+$/, "");
  return `${under} ${parseInt(mm, 10)}/${parseInt(dd, 10)}/${yy} $${strike}${cp === "C" ? "C" : "P"}`;
};

/** Strategy params as a short human line instead of a JSON.stringify dump. */
export const summarizeParams = (params: Record<string, unknown>): string => {
  const parts: string[] = [];
  const p = params as Record<string, unknown> & {
    underlyings?: string[];
    universe?: string[];
    spec?: { name?: string };
  };
  const syms = p.underlyings ?? p.universe;
  if (Array.isArray(syms) && syms.length > 0) {
    parts.push(syms.slice(0, 4).join(", ") + (syms.length > 4 ? ` +${syms.length - 4}` : ""));
  }
  if (typeof p.spec === "object" && p.spec) parts.push(`spec: ${p.spec.name ?? "DSL blend"}`);
  if (typeof p.target_delta === "number") parts.push(`Δ${p.target_delta}`);
  if (typeof p.dte_min === "number" && typeof p.dte_max === "number")
    parts.push(`${p.dte_min}-${p.dte_max} DTE`);
  if (typeof p.top_n === "number") parts.push(`top ${p.top_n}`);
  if (typeof p.lookback_days === "number") parts.push(`${p.lookback_days}d lookback`);
  if (typeof p.rebalance_days === "number") parts.push(`rebal ${p.rebalance_days}d`);
  if (p.use_scout === true) parts.push("+radar");
  const known = new Set([
    "underlyings", "universe", "spec", "target_delta", "dte_min", "dte_max",
    "top_n", "lookback_days", "rebalance_days", "use_scout",
  ]);
  for (const [k, v] of Object.entries(params)) {
    if (parts.length >= 6) break;
    if (known.has(k) || v === null || typeof v === "object") continue;
    parts.push(`${k.replace(/_/g, " ")} ${v}`);
  }
  return parts.join(" · ") || "defaults";
};
