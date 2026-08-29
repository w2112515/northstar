"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Card, Chip, EmptyState, SectionTitle } from "@/components/ui";

type CatalogEntry = {
  family: string;
  name: string;
  plain: string;
  asset: string;
  risk: string;
  runnable: boolean;
};

type Instance = {
  id: string;
  family: string;
  version: string;
  status: string;
  enabled: boolean;
  params: Record<string, unknown>;
  lineage: { parent_version: string | null; hypothesis: string };
};

export default function Strategies() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    apiGet<{ catalog: CatalogEntry[]; instances: Instance[] }>("/api/strategies")
      .then((r) => {
        setCatalog(r.catalog);
        setInstances(r.instances);
      })
      .catch(() => setErr("API unreachable"));
  }, []);

  if (err) return <EmptyState title={err} />;

  const groups: [string, CatalogEntry[]][] = [
    ["Options income & hedges", catalog.filter((c) => c.asset === "options")],
    ["Stock classics", catalog.filter((c) => c.asset === "stocks" && c.family !== "ai_analyst")],
    ["AI research", catalog.filter((c) => c.family === "ai_analyst")],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle sub="Every voyage starts from classics that professionals actually run. Active ones trade today; the rest are labeled honestly - never faked.">
          Strategy catalog
        </SectionTitle>
        <div className="space-y-5">
          {groups.map(([title, entries]) => (
            <div key={title}>
              <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((c) => (
                  <div
                    key={c.family}
                    className={`rounded-xl border p-3.5 ${
                      c.runnable ? "border-teal/40 bg-surface2" : "border-line/60 bg-surface2/50 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{c.name}</span>
                      <Chip tone={c.runnable ? "teal" : "line"}>{c.runnable ? "active" : "coming soon"}</Chip>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.plain}</p>
                    <div className="mt-2 flex gap-1.5">
                      <Chip>{c.asset}</Chip>
                      <Chip tone={c.risk.includes("low") ? "teal" : c.risk === "medium" ? "amber" : "coral"}>
                        {c.risk} risk
                      </Chip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Concrete parameterizations currently sailing. Evolution Lab candidates appear here once promoted.">
          Running instances
        </SectionTitle>
        {instances.length === 0 ? (
          <EmptyState title="No instances yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2">Family</th>
                <th className="pb-2">Version</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Params</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => (
                <tr key={i.id} className="border-t border-line/50 align-top">
                  <td className="py-2.5 font-medium capitalize">{i.family.replace("_", " ")}</td>
                  <td className="py-2.5 font-mono text-xs">{i.version}</td>
                  <td className="py-2.5">
                    <Chip tone={i.status === "champion" ? "gold" : i.status === "trial" ? "amber" : "line"}>
                      {i.status}
                    </Chip>
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-muted">
                    {JSON.stringify(i.params)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
