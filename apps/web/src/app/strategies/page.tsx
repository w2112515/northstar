"use client";

/** Strategies: grouped switchboard (in the plan / available / soon) plus
 *  live instances. In-plan and earned-champion cards carry sleeve, weather,
 *  and evidence class - never an invented options Sharpe. */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { apiPost, fmtPct, summarizeParams } from "@/lib/api";
import { refreshAll, useApi } from "@/lib/data";
import { Badge, Button, EmptyState, PageTitle, Panel, Skeleton } from "@/components/ui";
import type {
  CatalogEntry,
  CompassDoc,
  EngineState,
  EvidenceKind,
  FamilyBucketStats,
  Instance,
} from "@/lib/types";

// medium risk is a fact, not a request for your attention - amber stays
// reserved for "waiting on a human"
const RISK_TONE = (risk: string): "teal" | "mist" | "coral" =>
  risk.includes("low") ? "teal" : risk === "medium" ? "mist" : "coral";

const EVIDENCE_COPY: Record<EvidenceKind, string | null> = {
  walk_forward: "walk-forward OOS",
  vol_approx: "labeled vol approximation",
  rules_only: "live rules, no options-path backtest",
  llm: "no backtest · Gemini proposes, gate sizes",
  none: null,
};

/** Catalog is the authority; this map covers APIs that have not shipped the key yet. */
const EVIDENCE_BY_FAMILY: Record<string, EvidenceKind> = {
  wheel: "vol_approx",
  cash_secured_put: "rules_only",
  covered_call: "rules_only",
  bull_put_spread: "rules_only",
  bear_call_spread: "rules_only",
  bull_call_spread: "rules_only",
  iron_condor: "rules_only",
  momentum_rotation: "walk_forward",
  ma_cross_trend: "walk_forward",
  rsi_mean_reversion: "walk_forward",
  dsl_rotation: "walk_forward",
  ai_analyst: "llm",
};

function evidenceKind(entry: CatalogEntry): EvidenceKind {
  return entry.evidence ?? EVIDENCE_BY_FAMILY[entry.family] ?? "none";
}

/** Backend "champion" = incumbent. Gold is only for a version that beat one. */
function earnedChampion(i: Instance): boolean {
  if (i.status !== "champion") return false;
  const parent = i.lineage?.parent_version?.trim();
  const exp = i.lineage?.experiment_id?.trim();
  return Boolean(parent || exp);
}

function bucketDays(stats: FamilyBucketStats): number | undefined {
  return stats.n_days ?? stats.days;
}

function weatherLine(stats: FamilyBucketStats | undefined): string | null {
  if (!stats) return null;
  if (stats.refused) return "not enough history in this weather";
  if (stats.sharpe == null) return null;
  const days = bucketDays(stats);
  return days != null
    ? `This weather: Sharpe ${stats.sharpe.toFixed(2)} · ${days}d`
    : `This weather: Sharpe ${stats.sharpe.toFixed(2)}`;
}

function StrategyCard({
  entry,
  running,
  champion,
  inPlan,
  sleeve,
  weather,
  hypothesis,
  busy,
  onToggle,
}: {
  entry: CatalogEntry;
  running: boolean;
  champion: boolean;
  inPlan: boolean;
  sleeve?: { weight: number; why: string };
  weather?: FamilyBucketStats;
  hypothesis?: string;
  busy: boolean;
  onToggle: () => void;
}) {
  const showEvidence = inPlan || champion;
  const evidence = EVIDENCE_COPY[evidenceKind(entry)];
  const why = sleeve?.why || (!inPlan ? hypothesis : "") || "";
  const wx = showEvidence ? weatherLine(weather) : null;
  const sharpeTone =
    weather && !weather.refused && weather.sharpe != null
      ? weather.sharpe >= 0
        ? "text-teal"
        : "text-coral"
      : "text-mist";

  return (
    <article
      className={`panel flex flex-col p-4 ${
        !entry.runnable
          ? "opacity-80"
          : champion
            ? "shadow-tone-gold"
            : running
              ? "shadow-tone-teal"
              : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{entry.name}</span>
        {!entry.runnable ? (
          <Badge>soon</Badge>
        ) : champion ? (
          <Badge tone="gold">champion</Badge>
        ) : running ? (
          <Badge tone="teal">running</Badge>
        ) : (
          <Badge>paused</Badge>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-mist">{entry.plain}</p>
      {showEvidence && (
        <div className="mt-2 space-y-0.5 font-mono text-2xs text-mist">
          {sleeve && (
            <div>
              <span className="num text-ink">{fmtPct(sleeve.weight, 0)}</span>
              {why ? ` · ${why}` : " sleeve"}
            </div>
          )}
          {!sleeve && why ? <div>{why}</div> : null}
          {wx && (
            <div className={wx.startsWith("This weather") ? sharpeTone : undefined}>{wx}</div>
          )}
          {evidence && <div>{evidence}</div>}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-1.5 pt-3">
        <div className="flex gap-1.5">
          <Badge>{entry.asset}</Badge>
          <Badge tone={RISK_TONE(entry.risk)}>{entry.risk} risk</Badge>
        </div>
        {entry.runnable && (
          <Button
            size="sm"
            variant={running ? "danger" : "teal"}
            disabled={busy}
            onClick={onToggle}
          >
            {busy ? "…" : running ? "Pause" : "Enable"}
          </Button>
        )}
      </div>
    </article>
  );
}

function CatalogSection({
  title,
  cols,
  children,
}: {
  title: string;
  cols: "plan" | "grid";
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="kicker">{title}</div>
      <div
        className={
          cols === "plan" ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {children}
      </div>
    </section>
  );
}

export default function Strategies() {
  const [busy, setBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState("");

  const q = useApi<{ catalog: CatalogEntry[]; instances: Instance[] }>("/api/strategies", 60000);
  const stateQ = useApi<EngineState>("/api/engine/state", 20000);
  const compassQ = useApi<{ compass: CompassDoc | null }>("/api/compass", 5 * 60000);

  const catalog = q.data?.catalog ?? [];
  const instances = q.data?.instances ?? [];
  const allocations = stateQ.data?.plan?.allocations ?? [];
  const compass = compassQ.data?.compass ?? null;
  const loaded = q.data !== undefined || q.error !== undefined;
  const err = q.error ? "Can't reach the trading service - shown catalog may be stale." : actErr;

  const activeByFamily = new Map<string, boolean>();
  const championByFamily = new Map<string, boolean>();
  const hypothesisByFamily = new Map<string, string>();
  for (const i of instances) {
    if (i.status !== "archived") {
      activeByFamily.set(i.family, (activeByFamily.get(i.family) ?? false) || i.enabled);
    }
    if (earnedChampion(i)) {
      championByFamily.set(i.family, true);
      const hyp = i.lineage?.hypothesis?.trim();
      if (hyp) hypothesisByFamily.set(i.family, hyp);
    }
  }

  const sleeveByFamily = new Map<string, { weight: number; why: string }>();
  for (const a of allocations) {
    if (a.strategy_id === "cash") continue;
    sleeveByFamily.set(a.strategy_id, { weight: a.weight, why: a.why ?? "" });
  }

  const regimeLabel = compass?.regime?.label;
  const weatherByFamily = new Map<string, FamilyBucketStats>();
  if (compass && regimeLabel) {
    for (const [fam, buckets] of Object.entries(compass.families ?? {})) {
      const stats = buckets[regimeLabel];
      if (stats) weatherByFamily.set(fam, stats);
    }
  }

  async function toggle(family: string) {
    const next = !(activeByFamily.get(family) ?? false);
    setBusy(family);
    try {
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
  const liveInstances = instances.filter((i) => i.status !== "archived");

  const inPlan = catalog.filter((c) => sleeveByFamily.has(c.family));
  const available = catalog.filter((c) => c.runnable && !sleeveByFamily.has(c.family));
  const soon = catalog.filter((c) => !c.runnable);

  function card(c: CatalogEntry) {
    return (
      <StrategyCard
        key={c.family}
        entry={c}
        running={activeByFamily.get(c.family) ?? false}
        champion={championByFamily.get(c.family) ?? false}
        inPlan={sleeveByFamily.has(c.family)}
        sleeve={sleeveByFamily.get(c.family)}
        weather={weatherByFamily.get(c.family)}
        hypothesis={hypothesisByFamily.get(c.family)}
        busy={busy === c.family}
        onToggle={() => toggle(c.family)}
      />
    );
  }

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
        <div className="flex flex-col gap-5">
          {inPlan.length > 0 && (
            <CatalogSection title="In the plan" cols="plan">
              {inPlan.map(card)}
            </CatalogSection>
          )}
          {available.length > 0 && (
            <CatalogSection title="Available" cols="grid">
              {available.map(card)}
            </CatalogSection>
          )}
          {soon.length > 0 && (
            <CatalogSection title="Soon" cols="grid">
              {soon.map(card)}
            </CatalogSection>
          )}
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
                        earnedChampion(i) ? "gold" : i.status === "trial" ? "amber" : "mist"
                      }
                    >
                      {earnedChampion(i) ? "champion" : i.status === "champion" ? "live" : i.status}
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
