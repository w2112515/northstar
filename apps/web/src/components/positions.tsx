"use client";

/** Positions panel: what the account holds (with a two-tap close) and what
 *  is queued for the next open. Queued orders are read-only here - the API
 *  exposes close, not cancel, so no fake Pull button. */

import { useState } from "react";
import { apiPost, fmtUsd, humanSymbol } from "@/lib/api";
import { Badge, Button } from "@/components/ui";
import type { OpenOrder, Position } from "@/lib/types";

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function PositionsPanel({
  positions,
  openOrders,
  marketOpen,
}: {
  positions: Position[];
  openOrders: OpenOrder[];
  marketOpen: boolean;
}) {
  const [closing, setClosing] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function closePosition(symbol: string) {
    setBusy(symbol);
    setMsg("");
    try {
      const r = await apiPost<{ ok: boolean; outcome?: string; human?: string; error?: string }>(
        "/api/positions/close",
        { symbol },
      );
      setMsg(
        r.error
          ? r.error
          : r.outcome === "rejected"
            ? `Gate refused the close: ${r.human ?? symbol}`
            : `${r.outcome === "needs_human" ? "Close queued for your approval" : "Close order placed"}: ${r.human ?? symbol}`,
      );
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setMsg(`Close failed for ${symbol} - can't reach the trading service.`);
    } finally {
      setClosing(null);
      setBusy("");
      setTimeout(() => setMsg(""), 10000);
    }
  }

  return (
    <section className="panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="kicker">Positions</span>
        <span className="num text-2xs text-mist">{positions.length} names</span>
      </div>
      {positions.length === 0 ? (
        <p className="mt-4 text-sm text-mist">Cash only. Nothing held yet.</p>
      ) : (
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-72 text-left text-xs">
            <thead className="text-mist">
              <tr className="border-b border-line">
                <th className="pb-1.5 font-medium">Name</th>
                <th className="pb-1.5 font-medium">Qty</th>
                <th className="pb-1.5 font-medium">Value</th>
                <th className="pb-1.5 font-medium">P&amp;L</th>
                <th className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-b border-line/50">
                  <td className="py-1.5 pr-2">
                    <div className="text-ink" title={p.symbol}>{humanSymbol(p.symbol)}</div>
                    <div className="text-micro text-mist">{p.asset_class}</div>
                  </td>
                  <td className="num py-1.5 pr-2 text-mist">{p.qty}</td>
                  <td className="num py-1.5 pr-2 text-ink">{fmtUsd(p.market_value)}</td>
                  <td className={cn("num py-1.5 pr-2", p.unrealized_pl >= 0 ? "text-teal" : "text-coral")}>
                    {p.unrealized_pl >= 0 ? "+" : ""}
                    {fmtUsd(p.unrealized_pl)}
                  </td>
                  <td className="py-1.5 text-right">
                    {closing === p.symbol ? (
                      <span className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-8 px-2 text-2xs"
                          disabled={busy === p.symbol}
                          onClick={() => closePosition(p.symbol)}
                        >
                          {busy === p.symbol ? "Closing…" : "Confirm"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-2xs" onClick={() => setClosing(null)}>
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-2xs"
                        disabled={busy !== ""}
                        onClick={() => setClosing(p.symbol)}
                      >
                        Close
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 kicker">Queued</div>
      {openOrders.length === 0 ? (
        <p className="mt-1 text-2xs text-mist">None waiting.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {openOrders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded-sm bg-panel px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-xs text-ink">
                  <span className={o.side === "buy" ? "text-teal" : "text-coral"}>
                    {o.side.toUpperCase()}
                  </span>{" "}
                  {o.qty != null ? `${Math.round(o.qty)} ` : ""}
                  {humanSymbol(o.symbol)}
                  {o.limit_price != null ? ` @ ${o.limit_price.toFixed(2)}` : " mkt"}
                </div>
              </div>
              <Badge tone="amber">{marketOpen ? "working" : "waits for open"}</Badge>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-2 font-mono text-micro text-mist">{msg}</p>}
    </section>
  );
}
