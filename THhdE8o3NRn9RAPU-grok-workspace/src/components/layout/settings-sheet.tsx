import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useVoyage } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const marketOverride = useVoyage((s) => s.marketOverride);
  const circuitBreaker = useVoyage((s) => s.circuitBreaker);
  const killSwitch = useVoyage((s) => s.killSwitch);
  const autopilot = useVoyage((s) => s.autopilot);
  const setMarketOverride = useVoyage((s) => s.setMarketOverride);
  const setCircuitBreaker = useVoyage((s) => s.setCircuitBreaker);
  const setKillSwitch = useVoyage((s) => s.setKillSwitch);
  const setAutopilot = useVoyage((s) => s.setAutopilot);
  const loadSample = useVoyage((s) => s.loadSample);
  const loadFirstDay = useVoyage((s) => s.loadFirstDay);
  const setLoadingDemo = useVoyage((s) => s.setLoadingDemo);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Settings">
        <p className="text-sm text-mist">
          Paper book. Tape, breakers, and voyage scenarios for this cockpit.
        </p>

        <div className="mt-6 space-y-5">
          <Row label="Autopilot" hint="Passes run on their own. Paused tickets still wait on you.">
            <Switch checked={autopilot} onCheckedChange={setAutopilot} disabled={killSwitch} />
          </Row>
          <Row label="Kill switch" hint="Docks the fleet. Human must restart.">
            <Switch tone="coral" checked={killSwitch} onCheckedChange={setKillSwitch} />
          </Row>
        </div>

        <Separator className="my-6" />
        <Label>Tape</Label>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(["auto", "open", "closed"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={marketOverride === k ? "signal" : "ghost"}
              onClick={() => setMarketOverride(k)}
            >
              {k === "auto" ? "NY clock" : k}
            </Button>
          ))}
        </div>

        <Separator className="my-6" />
        <Label>Circuit breaker</Label>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(["none", "soft", "hard"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={
                circuitBreaker === k ? (k === "none" ? "quiet" : k === "soft" ? "amber" : "coral") : "ghost"
              }
              onClick={() => setCircuitBreaker(k)}
            >
              {k}
            </Button>
          ))}
        </div>

        <Separator className="my-6" />
        <Label>Voyage scenarios</Label>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setLoadingDemo(true);
              loadSample();
              setTimeout(() => setLoadingDemo(false), 700);
              onOpenChange(false);
              void navigate({ to: "/" });
            }}
          >
            Load sample voyage
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              loadFirstDay();
              onOpenChange(false);
              void navigate({ to: "/" });
            }}
          >
            First-day empty book
          </Button>
          <Button
            variant="gold"
            onClick={() => {
              onOpenChange(false);
              void navigate({ to: "/onboarding" });
            }}
          >
            Replay onboarding
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-ink">{label}</div>
        <div className="mt-0.5 text-xs text-mist">{hint}</div>
      </div>
      {children}
    </div>
  );
}
