import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ResearchWorkbench } from "@/components/research/workbench";

export const Route = createFileRoute("/research")({ component: ResearchPage });

function ResearchPage() {
  return (
    <AppShell>
      <ResearchWorkbench />
    </AppShell>
  );
}
