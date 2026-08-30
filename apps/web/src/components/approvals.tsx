"use client";

/** Needs-you approvals: paused order proposals with the reason and the worst
 *  case, one tap to approve or skip. Silence is an automatic no after the
 *  backend timeout. Rendered as the amber-ringed panel (waiting = amber). */

import { useState } from "react";
import { apiPost, fmtUsd } from "@/lib/api";
import { Badge, Button, Panel } from "@/components/ui";
import type { Approval } from "@/lib/types";

export function Approvals({ approvals, killSwitch }: { approvals: Approval[]; killSwitch: boolean }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  if (approvals.length === 0) return null;

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setErr("");
    try {
      await apiPost(`/api/approvals/${id}`, { approve });
      window.dispatchEvent(new Event("northstar:refresh"));
    } catch {
      setErr("That decision did not go through - can't reach the trading service.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel tone="amber" className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="kicker">Needs you</span>
        <Badge tone="amber">{approvals.length} paused</Badge>
      </div>
      {err && <p className="mb-1.5 text-2xs text-coral">{err}</p>}
      <ul className="flex flex-col gap-1.5">
        {approvals.map((a) => (
          <li
            key={a.id}
            className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-panel px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">{a.order_plan.human}</div>
              <div className="truncate text-2xs text-amber">
                {a.verdict.reason_codes.map((c) => c.replace(/_/g, " ")).join(", ")}
              </div>
            </div>
            <span className="num text-xs text-coral">-{fmtUsd(a.order_plan.est_max_loss)}</span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 md:min-h-9"
                disabled={busy !== ""}
                onClick={() => decide(a.id, false)}
              >
                Skip
              </Button>
              <Button
                size="sm"
                variant="teal"
                className="min-h-11 min-w-20 md:min-h-9"
                disabled={killSwitch || busy !== ""}
                onClick={() => decide(a.id, true)}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
