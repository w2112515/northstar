import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVoyage } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { StrategyStatus } from "@/lib/types";

export const Route = createFileRoute("/strategies")({ component: StrategiesPage });

function StrategiesPage() {
  const strategies = useVoyage((s) => s.strategies);
  const instances = useVoyage((s) => s.instances);
  const toggle = useVoyage((s) => s.toggleStrategy);
  const names = Object.fromEntries(strategies.map((s) => [s.id, s.name]));

  return (
    <AppShell>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {strategies.map((s) => (
          <article
            key={s.id}
            className={cn(
              "panel flex flex-col p-4",
              s.status === "coming" && "opacity-55",
              s.status === "sailing" && "shadow-tone-teal",
              s.status === "champion" && "shadow-tone-gold",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-medium text-ink">{s.name}</h2>
              <StatusPill status={s.status} />
            </div>
            <p className="mt-2 flex-1 text-sm text-mist">{s.sentence}</p>
            <div className="mt-3 flex items-center justify-between">
              <Badge tone={s.risk === "low" ? "teal" : s.risk === "high" ? "coral" : "mist"}>
                {s.risk} risk
              </Badge>
              {s.status !== "coming" && s.status !== "champion" && (
                <Button
                  size="sm"
                  variant={s.status === "sailing" ? "ghost" : "teal"}
                  onClick={() => toggle(s.id)}
                >
                  {s.status === "sailing" ? "Dock" : "Set sail"}
                </Button>
              )}
              {s.status === "champion" && (
                <span className="text-2xs text-gold">Locked as champion</span>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 mb-2 kicker">Running instances</div>
      <section className="panel overflow-x-auto p-4">
        {instances.length === 0 ? (
          <p className="text-sm text-mist">None running. First-day books start with an empty fleet until you set sail.</p>
        ) : (
          <table className="w-full min-w-xl text-left text-sm">
            <thead className="text-xs text-mist">
              <tr className="border-b border-line">
                <th className="pb-2 font-medium">Family</th>
                <th className="pb-2 font-medium">Version</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Params</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => (
                <tr key={i.id} className="border-b border-line/60">
                  <td className="py-2.5 pr-3">
                    <div className="text-ink">{names[i.strategyId] ?? i.family}</div>
                    <div className="text-2xs text-mist">{i.family}</div>
                  </td>
                  <td className="num py-2.5 pr-3 text-mist">{i.version}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={i.status === "running" ? "teal" : "mist"}>{i.status}</Badge>
                  </td>
                  <td className="py-2.5 text-xs text-mist">{i.params}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

function StatusPill({ status }: { status: StrategyStatus }) {
  if (status === "sailing") return <Badge tone="teal">sailing</Badge>;
  if (status === "champion") return <Badge tone="gold">champion</Badge>;
  if (status === "coming") return <Badge>coming soon</Badge>;
  return <Badge>docked</Badge>;
}
