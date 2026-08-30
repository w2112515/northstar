import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CockpitHero } from "@/components/cockpit/hero";
import { Approvals } from "@/components/cockpit/approvals";
import { MarketPanel } from "@/components/cockpit/market-panel";
import { AgentPanel } from "@/components/cockpit/agent-panel";
import { OnBoard } from "@/components/cockpit/on-board";
import { LiveFeed } from "@/components/cockpit/live-feed";
import { CockpitSkeleton } from "@/components/cockpit/skeleton";
import { useVoyage } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const loadingDemo = useVoyage((s) => s.loadingDemo);
  const autopilot = useVoyage((s) => s.autopilot);
  const killSwitch = useVoyage((s) => s.killSwitch);
  const circuitBreaker = useVoyage((s) => s.circuitBreaker);
  const passRunning = useVoyage((s) => s.passRunning);
  const runPass = useVoyage((s) => s.runPass);

  useEffect(() => {
    if (!autopilot || killSwitch || circuitBreaker === "hard") return;
    if (passRunning) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      useVoyage.getState().runPass();
    }, 28000);
    return () => clearInterval(id);
  }, [autopilot, killSwitch, circuitBreaker, passRunning, runPass]);

  const ready = !loadingDemo;

  return (
    <AppShell>
      {!ready ? (
        <CockpitSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <Approvals />
          <CockpitHero />
          <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
            <MarketPanel />
            <AgentPanel />
            <OnBoard />
          </div>
          <LiveFeed />
        </div>
      )}
    </AppShell>
  );
}
