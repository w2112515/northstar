import { useVoyage } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function StateBanners() {
  const killSwitch = useVoyage((s) => s.killSwitch);
  const circuitBreaker = useVoyage((s) => s.circuitBreaker);
  const setCircuitBreaker = useVoyage((s) => s.setCircuitBreaker);

  if (!killSwitch && circuitBreaker === "none") return null;

  return (
    <div className="mb-3 flex flex-col gap-2">
      {killSwitch && (
        <div className="rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
          Kill switch on. Fleet docked. No new risk. Restart from the helm.
        </div>
      )}
      {!killSwitch && circuitBreaker === "hard" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
          <span>Hard stop. Drawdown pause tripped. Human must restart.</span>
          <Button size="sm" variant="ghost" onClick={() => setCircuitBreaker("none")}>
            Clear breaker
          </Button>
        </div>
      )}
      {!killSwitch && circuitBreaker === "soft" && (
        <div className="rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber">
          Soft pause. New risk is gated. Existing positions stay. Reopens below the drawdown floor.
        </div>
      )}
    </div>
  );
}
