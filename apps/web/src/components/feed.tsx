"use client";

/** Live feed: the newest journal events as badge rows, two columns on
 *  desktop. Entrance animation is staggered feed-in; entries arriving while
 *  you watch flash once. The full record lives on the Journal page. */

import { useEffect, useState } from "react";
import { fmtTs } from "@/lib/api";
import { Badge, eventTone } from "@/components/ui";
import type { JEvent } from "@/lib/types";

export function LiveFeed({ events, oneCol = false }: { events: JEvent[]; oneCol?: boolean }) {
  // "Arrived while you watched" gets the entrance animation; history renders
  // still. Set in an effect: no wall-clock reads during render.
  const [mountedAt, setMountedAt] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setMountedAt(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="panel min-w-0 p-4">
      <div className="kicker">Live feed</div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-mist">
          Quiet. The first pass will write here.
        </p>
      ) : (
        <ul className={oneCol ? "mt-3 flex flex-col gap-1" : "mt-3 grid gap-1 sm:grid-cols-2"}>
          {events.map((ev, i) => {
            const isNew = mountedAt != null && Date.parse(ev.ts) > mountedAt;
            return (
              <li
                key={ev.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                  isNew ? "animate-feed-in" : ""
                }`}
                style={isNew ? { animationDelay: `${Math.min(i, 6) * 40}ms` } : undefined}
              >
                <Badge tone={eventTone(ev)}>{ev.kind}</Badge>
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{ev.human || "(event)"}</span>
                <span className="num shrink-0 text-micro text-mist">{fmtTs(ev.ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
