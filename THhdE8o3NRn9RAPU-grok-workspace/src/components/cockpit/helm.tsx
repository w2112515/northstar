import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useVoyage } from "@/lib/store";
import { resolveMarketOpen } from "@/lib/market-hours";
import { toast } from "sonner";
import { OctagonX, Play } from "lucide-react";

export function Helm() {
  const autopilot = useVoyage((s) => s.autopilot);
  const killSwitch = useVoyage((s) => s.killSwitch);
  const circuitBreaker = useVoyage((s) => s.circuitBreaker);
  const passRunning = useVoyage((s) => s.passRunning);
  const orders = useVoyage((s) => s.orders);
  const setAutopilot = useVoyage((s) => s.setAutopilot);
  const setKillSwitch = useVoyage((s) => s.setKillSwitch);
  const runPass = useVoyage((s) => s.runPass);
  const marketOverride = useVoyage((s) => s.marketOverride);
  const open = resolveMarketOpen(marketOverride);
  const blocked = killSwitch || circuitBreaker === "hard";

  return (
    <section className="flex items-center gap-2 overflow-x-auto border-t border-line px-3 py-1.5 md:gap-3 md:px-4">
      <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-ink md:min-h-9">
        <Switch
          checked={autopilot}
          disabled={blocked}
          onCheckedChange={(v) => {
            setAutopilot(v);
            toast(v ? "Autopilot on. Paused tickets still wait on you." : "Autopilot off.");
          }}
        />
        <span>
          Auto<span className="hidden sm:inline">pilot</span>
        </span>
      </label>
      <Button
        size="sm"
        variant="signal"
        className="min-h-11 shrink-0 md:min-h-9"
        disabled={blocked || passRunning}
        onClick={() => {
          runPass();
          toast(open ? "Pass running." : "Pass running against a closed tape. New risk queues.");
        }}
      >
        <Play className="size-3.5" />
        {passRunning ? "Passing…" : "Run one pass"}
      </Button>
      {!open && orders.length > 0 && (
        <span className="hidden shrink-0 text-2xs text-signal sm:inline">{orders.length} queued</span>
      )}
      <div className="ml-auto shrink-0">
        <Button
          size="sm"
          variant={killSwitch ? "quiet" : "danger"}
          className="min-h-11 md:min-h-9"
          onClick={() => {
            setKillSwitch(!killSwitch);
            toast(killSwitch ? "Kill switch cleared." : "Kill switch on. Fleet docked.");
          }}
        >
          <OctagonX className="size-3.5" />
          {killSwitch ? "Restart fleet" : "Kill switch"}
        </Button>
      </div>
    </section>
  );
}
