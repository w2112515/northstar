"use client";

/** Strategies: the catalog of what can run (card grid) and the concrete
 *  instances currently on the book. Every order still clears the risk gate. */

import { useState } from "react";
import Link from "next/link";
import { apiPost, summarizeParams } from "@/lib/api";
import { refreshAll, useApi } from "@/lib/data";
import { Badge, Button, EmptyState, PageTitle, Panel, Skeleton } from "@/components/ui";
import type { CatalogEntry, Instance } from "@/lib/types";

// medium risk is a fact, not a request for your attention - amber stays
// reserved for "waiting on a human"
const RISK_TONE = (risk: string): "teal" | "mist" | "coral" =>
  risk.includes("low") ? "teal" : risk === "medium" ? "mist" : "coral";

export default function Strategies() {
  const [busy, setBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState("");

  const q = useApi<{ catalog: CatalogEntry[]; instances: Instance[] }>("/api/strategies", 60000);
  const catalog = q.data?.catalog ?? [];
  const instances = q.data?.instances ?? [];
  const loaded = q.data !== undefined || q.error !== undefined;
  const err = q.error ? "Can't reach the trading service - shown catalog may be stale." : actErr;

  // a family is "running" if any non-archived instance of it is enabled
  const activeByFamily = new Map<string, boolean>();
  const championByFamily = new Map<string, boolean>();
  for (const i of instances) {
    if (i.status !== "archived") {
      activeByFamily.set(i.family, (activeByFamily.get(i.family) ?? false) || i.enabled);
    }
    if (i.status === "champion") championByFamily.set(i.family, true);
  }

  async function toggle(family: string) {
    const next = !(activeByFamily.get(family) ?? false);
    setBusy(family);
    try {
      // the gate can refuse with HTTP 200 + { ok: false } - surface it
      const r = await apiPost<{ ok?: boolean; error?: string }>(
        `/api/strategies/${family}/toggle`,
        { enabled: next },
      );
      if (r.ok === false) {
        setActErr(r.error ?? "The system refused that toggle.");
        return;
      }
      setActErr("");
      await refreshAll();
    } catch {
      setActErr("Toggle failed - can't reach the trading service.");
    } finally {
      setBusy(null);
    }
  }

  const activeCount = catalog.filter((c) => activeByFamily.get(c.family)).length;
  const pausedCount = catalog.filter((c) => c.runnable && !activeByFamily.get(c.family)).length;
  // Archived instances are history, not the live book - they read as
  // contradictions here ("archived · enabled yes"). The journal keeps them.
  const liveInstances = instances.filter((i) => i.status !== "archived");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PageTitle
        title="Strategies"
        sub="Classics that professionals actually run. Enable one and it proposes trades from the next pass - every order still clears the risk gate."
      />

      <div className="flex items-center gap-2">
        <Badge tone="teal">{activeCount} active</Badge>
        <Badge>{pausedCount} paused</Badge>
        <Link
          href="/research?tab=evolution"
          className="ml-auto inline-flex h-9 items-center rounded-md bg-gold px-3 text-xs font-medium text-void shadow-tone-gold transition-colors hover:bg-gold/90"
        >
          New strategy
        </Link>
      </div>

      {err && (
        <div className="rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral">
          {err}
        </div>
      )}

      {!loaded ? (
        <Panel className="p-5">
          <Skeleton rows={6} />
        </Panel>
      ) : catalog.length === 0 ? (
        <Panel className="p-5">
          <EmptyState title="No catalog" body="The strategy registry did not answer." />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((c) => {
            const running = activeByFamily.get(c.family) ?? false;
            const champion = championByFamily.get(c.family) ?? false;
            return (
              <article
                key={c.family}
                // ring priority: champion (gold star moment) beats running
                // (teal); "soon" cards keep readable text - only 20% dim
                className={`panel flex flex-col p-4 ${
                  !c.runnable
                    ? "opacity-80"
                    : champion
                      ? "shadow-tone-gold"
                      : running
                        ? "shadow-tone-teal"
                        : ""
                }`}
              >
                {/* no kicker: it used to repeat the name ("wheel" over
                    "Wheel (income cycle)") and wasted a row on every card */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{c.name}</span>
                  {!c.runnable ? (
                    <Badge>soon</Badge>
                  ) : champion ? (
                    <Badge tone="gold">champion</Badge>
                  ) : running ? (
                    <Badge tone="teal">running</Badge>
                  ) : (
                    <Badge>paused</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-mist">{c.plain}</p>
                <div className="mt-auto flex items-center justify-between gap-1.5 pt-3">
                  <div className="flex gap-1.5">
                    <Badge>{c.asset}</Badge>
                    <Badge tone={RISK_TONE(c.risk)}>{c.risk} risk</Badge>
                  </div>
                  {c.runnable && (
                    <Button
                      size="sm"
                      variant={running ? "danger" : "teal"}
                      disabled={busy === c.family}
                      onClick={() => toggle(c.family)}
                    >
                      {busy === c.family ? "…" : running ? "Pause" : "Enable"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Panel className="overflow-x-auto p-4">
        <div className="kicker">Live instances</div>
        {!loaded ? (
          <Skeleton rows={4} className="mt-3" />
        ) : liveInstances.length === 0 ? (
          <EmptyState title="No live instances yet" body="Evolution candidates appear here once promoted." />
        ) : (
          <table className="mt-3 w-full min-w-lg text-left text-sm">
            <thead className="text-xs text-mist">
              <tr className="border-b border-line">
                <th scope="col" className="pb-2 font-medium">Family</th>
                <th scope="col" className="pb-2 font-medium">Version</th>
                <th scope="col" className="pb-2 font-medium">Status</th>
                <th scope="col" className="pb-2 font-medium">Enabled</th>
                <th scope="col" className="pb-2 font-medium">Setup</th>
              </tr>
            </thead>
            <tbody>
              {liveInstances.map((i) => (
                <tr key={i.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3 font-medium capitalize">{i.family.replace(/_/g, " ")}</td>
                  <td className="num py-2 pr-3 text-xs text-mist">{i.version}</td>
                  <td className="py-2 pr-3">
                    <Badge
                      tone={
                        i.status === "champion" ? "gold" : i.status === "trial" ? "amber" : "mist"
                      }
                    >
                      {i.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={i.enabled ? "teal" : "mist"}>{i.enabled ? "yes" : "no"}</Badge>
                  </td>
                  <td className="num py-2 text-2xs text-mist" title={JSON.stringify(i.params)}>
                    {summarizeParams(i.params)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
