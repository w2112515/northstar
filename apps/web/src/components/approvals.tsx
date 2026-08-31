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

  // The panel is the standing seat of human sovereignty in the layout - it
  // stays visible when empty so the mechanism exists before the first pause.
  if (approvals.length === 0) {
    return (
      <Panel className="p-4">
        <span className="kicker">Needs you</span>
        <p className="mt-2 text-sm text-mist">
          Nothing needs you right now. Proposals the gate pauses will wait here for your call.
        </p>
      </Panel>
    );
  }

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
    // amber = a human decision is due; coral when the kill switch has frozen the desk
    <Panel tone={killSwitch ? "coral" : "amber"} className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="kicker">Needs you</span>
        <Badge tone={killSwitch ? "coral" : "amber"}>{approvals.length} paused</Badge>
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
              {a.proposal.thesis_human && (
                <div className="mt-0.5 line-clamp-2 text-2xs text-mist">{a.proposal.thesis_human}</div>
              )}
              <div className="truncate text-2xs text-amber">
                {a.verdict.reason_codes.map((c) => c.replace(/_/g, " ")).join(", ")}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-micro uppercase tracking-wide text-mist">Worst case</div>
              <div className="num text-xs text-coral">-{fmtUsd(a.order_plan.est_max_loss)}</div>
            </div>
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
                title={killSwitch ? "Kill switch is on - release it before approving new risk" : undefined}
                onClick={() => decide(a.id, true)}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {killSwitch && (
        <p className="mt-2 text-2xs text-coral">
          Kill switch is on - approving is disabled until you release it. Skip still works.
        </p>
      )}
    </Panel>
  );
}
