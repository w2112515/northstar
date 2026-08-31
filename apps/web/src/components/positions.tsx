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
  risk,
}: {
  positions: Position[];
  openOrders: OpenOrder[];
  marketOpen: boolean;
  risk?: { deployed: number; cap: number; cap_pct: number } | null;
}) {
  const [closing, setClosing] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  // The answer to a money action must be seen: semantic tone, no self-erase
  // timer (cleared by the next action), aria-live via role="status".
  const [msg, setMsg] = useState<{ text: string; tone: "teal" | "amber" | "coral" } | null>(null);

  async function closePosition(symbol: string) {
    setBusy(symbol);
    setMsg(null);
    try {
      const r = await apiPost<{ ok: boolean; outcome?: string; human?: string; error?: string }>(
        "/api/positions/close",
        { symbol },
      );
      setMsg(
        r.error
          ? { text: r.error, tone: "coral" }
          : r.outcome === "rejected"
            ? { text: `Gate refused the close: ${r.human ?? symbol}`, tone: "coral" }
            : r.outcome === "needs_human"
              ? { text: `Close queued for your approval: ${r.human ?? symbol}`, tone: "amber" }
              : { text: `Close order placed: ${r.human ?? symbol}`, tone: "teal" },
      );
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setMsg({ text: `Close failed for ${symbol} - can't reach the trading service.`, tone: "coral" });
    } finally {
      setClosing(null);
      setBusy("");
    }
  }

  const MSG_TONE = {
    teal: "bg-teal-dim text-teal",
    amber: "bg-amber-dim text-amber",
    coral: "bg-coral-dim text-coral",
  } as const;

  return (
    <section className="panel flex min-w-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="kicker">Positions</span>
        <span className="num text-2xs text-mist">{positions.length} names</span>
      </div>
      <p role="status" className={msg ? `mt-2 rounded-md px-2 py-1.5 text-xs ${MSG_TONE[msg.tone]}` : "sr-only"}>
        {msg?.text ?? ""}
      </p>
      {risk && risk.cap > 0 && (
        // whole-book deployment vs the gate's portfolio cap - the same number
        // the risk gate checks before every new trade
        <div className="mt-2">
          <div className="flex items-baseline justify-between text-2xs">
            <span className="text-mist">Deployed risk budget</span>
            <span className="num text-mist">
              {fmtUsd(risk.deployed)} / {fmtUsd(risk.cap)}
            </span>
          </div>
          <div
            role="meter"
            aria-label="Deployed capital against the portfolio cap"
            aria-valuemin={0}
            aria-valuemax={risk.cap}
            aria-valuenow={Math.min(risk.deployed, risk.cap)}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel"
          >
            <div
              className={cn(
                "h-full rounded-full",
                risk.deployed / risk.cap >= 0.85 ? "bg-amber" : "bg-teal",
              )}
              style={{ width: `${Math.min(100, (risk.deployed / risk.cap) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {positions.length === 0 ? (
        <p className="mt-4 text-sm text-mist">Cash only. Nothing held yet.</p>
      ) : (
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-72 text-left text-xs">
            <thead className="text-mist">
              <tr className="border-b border-line">
                <th scope="col" className="pb-1.5 font-medium">Name</th>
                <th scope="col" className="pb-1.5 font-medium">Qty</th>
                <th scope="col" className="pb-1.5 font-medium">Value</th>
                <th scope="col" className="pb-1.5 font-medium">P&amp;L</th>
                <th scope="col" className="pb-1.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-b border-line/50">
                  <td className="py-1.5 pr-2">
                    <div className="text-ink" title={p.symbol}>{humanSymbol(p.symbol)}</div>
                    <div className="text-micro text-mist">{p.asset_class.replace(/^us_/, "")}</div>
                  </td>
                  <td className="num py-1.5 pr-2 text-mist">
                    {p.qty}
                    {p.qty < 0 && <span className="ml-1 font-sans text-micro">short</span>}
                  </td>
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
                          className="h-auto min-h-11 px-2 text-2xs md:h-8 md:min-h-8"
                          disabled={busy === p.symbol}
                          onClick={() => closePosition(p.symbol)}
                        >
                          {busy === p.symbol ? "Closing…" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto min-h-11 px-2 text-2xs md:h-8 md:min-h-8"
                          onClick={() => setClosing(null)}
                        >
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto min-h-11 px-2 text-2xs md:h-8 md:min-h-8"
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
              {/* mist, not amber: these wait for the market clock, not for you */}
              <Badge tone="mist">{marketOpen ? "working" : "waits for open"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
