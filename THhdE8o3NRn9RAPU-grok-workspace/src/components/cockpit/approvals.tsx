import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVoyage } from "@/lib/store";
import { money } from "@/lib/format";
import { toast } from "sonner";

export function Approvals() {
  const proposals = useVoyage((s) => s.proposals);
  const approve = useVoyage((s) => s.approveProposal);
  const skip = useVoyage((s) => s.skipProposal);
  const killSwitch = useVoyage((s) => s.killSwitch);

  if (proposals.length === 0) return null;

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="kicker">Waiting on you</span>
        <Badge tone="amber">{proposals.length} paused</Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {proposals.map((p) => (
          <li
            key={p.id}
            className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-night px-3 py-2 shadow-tone-amber"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">
                {p.side === "buy" ? "Buy" : "Sell"} {p.qty} {p.humanName}
              </div>
              <div className="truncate text-2xs text-amber">{p.pausedWhy}</div>
            </div>
            <span className="num text-xs text-coral">−{money(p.worstCase)}</span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 md:min-h-9"
                onClick={() => {
                  skip(p.id);
                  toast("Skipped. Radar keeps the name.");
                }}
              >
                Skip
              </Button>
              <Button
                size="sm"
                variant="teal"
                className="min-h-11 min-w-20 md:min-h-9"
                disabled={killSwitch}
                onClick={() => {
                  approve(p.id);
                  toast("Approved. Queued until the open.");
                }}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
