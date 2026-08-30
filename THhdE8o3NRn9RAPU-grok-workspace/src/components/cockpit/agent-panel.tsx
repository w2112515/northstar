import { AgentGraph } from "@/components/viz/agent-graph";
import { useVoyage } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export function AgentPanel() {
  const step = useVoyage((s) => s.passStep);
  const running = useVoyage((s) => s.passRunning);
  return (
    <section className="panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="kicker">Agent graph</span>
        {running ? <Badge tone="gold">{step}</Badge> : <Badge>idle</Badge>}
      </div>
      <div className="mt-3 min-h-0 flex-1">
        <AgentGraph active={step} />
      </div>
    </section>
  );
}
