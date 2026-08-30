import { useState } from "react";
import { useVoyage, positionPnl, positionValue } from "@/lib/store";
import { money, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

export function OnBoard() {
  const positions = useVoyage((s) => s.positions);
  const orders = useVoyage((s) => s.orders);
  const closePosition = useVoyage((s) => s.closePosition);
  const cancelOrder = useVoyage((s) => s.cancelOrder);
  const [closing, setClosing] = useState<string | null>(null);

  return (
    <section className="panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="kicker">On board</span>
        <span className="num text-2xs text-mist">{positions.length} names</span>
      </div>
      {positions.length === 0 ? (
        <p className="mt-4 text-sm text-mist">Cash only. Nothing has sailed yet.</p>
      ) : (
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-72 text-left text-xs">
            <thead className="text-mist">
              <tr className="border-b border-line">
                <th className="pb-1.5 font-medium">Name</th>
                <th className="pb-1.5 font-medium">Qty</th>
                <th className="pb-1.5 font-medium">Value</th>
                <th className="pb-1.5 font-medium">P&L</th>
                <th className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const pnl = positionPnl(p);
                const val = positionValue(p);
                const pnlPct = ((p.last - p.avgCost) / p.avgCost) * 100;
                return (
                  <tr key={p.id} className="border-b border-line/50">
                    <td className="py-1.5 pr-2">
                      <div className="text-ink">{p.humanName}</div>
                      <div className="text-micro text-mist">{p.family}</div>
                    </td>
                    <td className="num py-1.5 pr-2 text-mist">{p.qty}</td>
                    <td className="num py-1.5 pr-2 text-ink">{money(val)}</td>
                    <td className={cn("num py-1.5 pr-2", pnl >= 0 ? "text-teal" : "text-coral")}>
                      {money(pnl, { sign: true })}
                      <span className="ml-1 text-micro opacity-80">{pct(pnlPct)}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      <AlertDialog open={closing === p.id} onOpenChange={(o) => setClosing(o ? p.id : null)}>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-2xs">
                            Close
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent
                          title={`Close ${p.humanName}?`}
                          description="Market sell, queued until the open. The mark you see is not a fill."
                          confirm="Queue close"
                          confirmTone="coral"
                          onConfirm={() => {
                            closePosition(p.id);
                            toast("Close queued until the open.");
                            setClosing(null);
                          }}
                        />
                      </AlertDialog>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 kicker">Queued</div>
      {orders.length === 0 ? (
        <p className="mt-1 text-2xs text-mist">None waiting.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded-sm bg-panel px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-xs text-ink">
                  {o.side.toUpperCase()} {o.qty} {o.humanName}
                  {o.limit ? ` @ ${o.limit.toFixed(2)}` : " mkt"}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-8 px-2 text-2xs" onClick={() => cancelOrder(o.id)}>
                Pull
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
