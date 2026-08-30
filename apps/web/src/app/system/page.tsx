"use client";

/** System - the machinery: what strategies exist, what is running, and what
 *  the system is learning (evolution, factor mining, validation studies). */

import { useState } from "react";
import { apiPost, summarizeParams } from "@/lib/api";
import { refreshAll, useApi } from "@/lib/data";
import { EmptyState, PageHeader, Section, Skeleton, Stamp } from "@/components/ui";
import {
  CrewStatsSection,
  EvolutionSection,
  MiningSection,
  ValidationSection,
} from "@/components/systems";
import type { CatalogEntry, Instance } from "@/lib/types";

const RISK_TONE: Record<string, "green" | "amber" | "red"> = {
  low: "green",
  medium: "amber",
  high: "red",
};

function riskTone(risk: string): "green" | "amber" | "red" {
  if (risk.includes("low")) return "green";
  if (risk === "medium") return "amber";
  return "red";
}

export default function System() {
  const [busy, setBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState("");

  const q = useApi<{ catalog: CatalogEntry[]; instances: Instance[] }>("/api/strategies", 60000);
  const catalog = q.data?.catalog ?? [];
  const instances = q.data?.instances ?? [];
  const loaded = q.data !== undefined || q.error !== undefined;
  const err = q.error ? "API unreachable - shown catalog may be stale." : actErr;

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

  return (
    <div className="space-y-10">
      <PageHeader
        title="System"
        sub="The machinery: what strategies exist, what is running, and what the system is learning."
      />

      {err && (
        <div className="border-l-2 border-amber bg-amber/5 px-4 py-2.5 text-body text-amber">
          {err}
        </div>
      )}

      <Section
        title="Strategy catalog"
        hint={`${catalog.filter((c) => activeByFamily.get(c.family)).length} running`}
        info="Classics that professionals actually run. Enable one and it proposes trades from the next pass - every order still clears the risk gate."
      >
        {!loaded ? (
          <Skeleton rows={6} />
        ) : catalog.length === 0 ? (
          <EmptyState title="No catalog" body="The strategy registry did not answer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  <th className="pb-2 font-medium">Strategy</th>
                  <th className="pb-2 font-medium">What it does</th>
                  <th className="pb-2 font-medium">Risk</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {catalog.map((c) => {
                  const running = activeByFamily.get(c.family) ?? false;
                  const champion = championByFamily.get(c.family) ?? false;
                  return (
                    <tr key={c.family} className="border-b border-hairline/60 align-top">
                      <td className="py-2.5 pr-3">
                        <span className="text-body font-semibold">{c.name}</span>
                        <span className="ml-2 font-mono text-micro text-ink2">{c.asset}</span>
                      </td>
                      <td className="max-w-[380px] py-2.5 pr-3 text-body leading-relaxed text-ink2">
                        {c.plain}
                      </td>
                      <td className="py-2.5">
                        <Stamp tone={RISK_TONE[c.risk] ?? riskTone(c.risk)}>{c.risk}</Stamp>
                      </td>
                      <td className="py-2.5">
                        {!c.runnable ? (
                          <Stamp tone="plain">soon</Stamp>
                        ) : champion ? (
                          <Stamp tone="indigo">champion</Stamp>
                        ) : running ? (
                          <Stamp tone="green">running</Stamp>
                        ) : (
                          <Stamp tone="plain">paused</Stamp>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {c.runnable && (
                          <button
                            onClick={() => toggle(c.family)}
                            disabled={busy === c.family}
                            className={`border px-2.5 py-1 font-mono text-micro font-medium transition-colors disabled:opacity-50 ${
                              running
                                ? "border-red/50 text-red hover:bg-red/5"
                                : "border-hairline text-ink hover:border-ink/40"
                            }`}
                          >
                            {busy === c.family ? "…" : running ? "Pause" : "Enable"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Running instances"
        hint={`${instances.length} on record`}
        info="Concrete parameterizations currently enabled. Evolution candidates appear here once promoted."
      >
        {!loaded ? (
          <Skeleton rows={4} />
        ) : instances.length === 0 ? (
          <EmptyState title="No instances yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-micro uppercase tracking-[0.12em] text-ink2">
                  <th className="pb-2 font-medium">Family</th>
                  <th className="pb-2 font-medium">Version</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Enabled</th>
                  <th className="pb-2 font-medium">Setup</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((i) => (
                  <tr key={i.id} className="border-b border-hairline/60 align-top">
                    <td className="py-2 font-medium capitalize">{i.family.replace(/_/g, " ")}</td>
                    <td className="py-2 font-mono text-micro text-ink2">{i.version}</td>
                    <td className="py-2">
                      <Stamp
                        tone={
                          i.status === "champion" ? "indigo" : i.status === "trial" ? "amber" : "plain"
                        }
                      >
                        {i.status}
                      </Stamp>
                    </td>
                    <td className="py-2">
                      <Stamp tone={i.enabled ? "green" : "plain"}>{i.enabled ? "yes" : "no"}</Stamp>
                    </td>
                    <td className="py-2 font-mono text-micro text-ink2" title={JSON.stringify(i.params)}>
                      {summarizeParams(i.params)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <EvolutionSection />
      <MiningSection />
      <ValidationSection />
      <CrewStatsSection />
    </div>
  );
}
