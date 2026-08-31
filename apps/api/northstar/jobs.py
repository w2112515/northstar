"""Persistent job table: the scheduler enqueues work, one worker consumes it.

Why a table instead of fire-and-forget calls: a crash mid-nightly or mid-pass
used to vanish silently - the tick that triggered it had already been marked
done. Now the intent survives the process: jobs live in the store
(pending/running/done/failed), startup re-queues whatever was running when we
died, and idempotency keys make re-enqueueing the same intent a no-op.

Deliberately NOT a distributed queue: this system is single-driver by design
(see the driver lease in api/app.py) - only the lease holder consumes, so a
Store-backed table gives crash-safety without a new piece of infrastructure.
Actual money-path serialization stays where it always was: locks.py PASS_LOCK
inside run_trading_pass, order idempotency at the broker layer.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from northstar.domain import JournalEvent

MAX_ATTEMPTS = 2  # a job that crashed the process twice needs a human, not a loop


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------- handlers

def _run_trading_pass(store, payload: dict[str, Any]) -> Any:
    import asyncio

    from northstar.adkflows.trading_loop import run_trading_pass

    return asyncio.run(run_trading_pass(reason=str(payload.get("reason", "scheduled"))))


def _run_nightly(store, payload: dict[str, Any]) -> Any:
    from northstar.nightly import run_nightly

    return run_nightly(store)


HANDLERS: dict[str, Callable[[Any, dict[str, Any]], Any]] = {
    "trading_pass": _run_trading_pass,
    "nightly": _run_nightly,
}


# ------------------------------------------------------------------ table ops

def enqueue(store, kind: str, idempotency_key: str, payload: dict[str, Any] | None = None) -> dict | None:
    """Queue work exactly once per intent: any existing job with the same
    idempotency key (even a failed one - its journal event already called for
    a human) makes this a no-op (returns None)."""
    for doc in store.list("jobs"):
        if doc.get("idempotency_key") == idempotency_key:
            return None
    job = {
        "id": f"job_{uuid.uuid4().hex[:10]}",
        "kind": kind,
        "idempotency_key": idempotency_key,
        "status": "pending",
        "attempts": 0,
        "max_attempts": MAX_ATTEMPTS,
        "payload": payload or {},
        "created_at": _now(),
        "updated_at": _now(),
        "worker": None,
        "error": None,
    }
    store.save("jobs", job["id"], job)
    return job


def claim_next(store, worker: str) -> dict | None:
    """Oldest pending job -> running. Single consumer by design (driver lease),
    so a read-modify-write is race-free in practice."""
    pending = [d for d in store.list("jobs") if d.get("status") == "pending"]
    if not pending:
        return None
    job = min(pending, key=lambda d: d.get("created_at", ""))
    job = {**job, "status": "running", "attempts": int(job.get("attempts", 0)) + 1,
           "worker": worker, "updated_at": _now()}
    store.save("jobs", job["id"], job)
    return job


def finish(store, job: dict, ok: bool, error: str | None = None) -> dict:
    if ok:
        job = {**job, "status": "done", "error": None, "updated_at": _now()}
    elif int(job.get("attempts", 0)) < int(job.get("max_attempts", MAX_ATTEMPTS)):
        job = {**job, "status": "pending", "error": error, "updated_at": _now()}
    else:
        job = {**job, "status": "failed", "error": error, "updated_at": _now()}
        store.append_event(JournalEvent(
            kind="system",
            human=f"Job {job['kind']} ({job['idempotency_key']}) failed after "
                  f"{job['attempts']} attempt(s): {error}",
            payload={"job_id": job["id"], "kind": job["kind"], "error": str(error)},
        ))
    store.save("jobs", job["id"], job)
    return job


def resume_incomplete(store) -> int:
    """Startup sweep: jobs stuck in `running` died with the process. Re-queue
    the ones with attempts left, fail the rest. Returns how many were re-queued."""
    requeued = 0
    for doc in store.list("jobs"):
        if doc.get("status") != "running":
            continue
        if int(doc.get("attempts", 0)) < int(doc.get("max_attempts", MAX_ATTEMPTS)):
            store.save("jobs", doc["id"], {**doc, "status": "pending", "updated_at": _now()})
            requeued += 1
        else:
            finish(store, doc, ok=False, error="process died and attempts are exhausted")
    if requeued:
        store.append_event(JournalEvent(
            kind="system",
            human=f"Recovered {requeued} unfinished job(s) from the last run - resuming.",
            payload={"requeued": requeued},
        ))
    return requeued


def run_one(store, worker: str) -> dict | None:
    """Claim and execute a single job; returns the finished job doc or None."""
    job = claim_next(store, worker)
    if job is None:
        return None
    handler = HANDLERS.get(job["kind"])
    if handler is None:
        return finish(store, job, ok=False, error=f"no handler for kind {job['kind']!r}")
    try:
        handler(store, job.get("payload") or {})
        return finish(store, job, ok=True)
    except Exception as e:
        return finish(store, job, ok=False, error=f"{type(e).__name__}: {e}")


def prune_finished(store, keep: int = 200) -> None:
    """Cap table growth: keep the newest `keep` done/failed jobs, delete older."""
    settled = [d for d in store.list("jobs") if d.get("status") in ("done", "failed")]
    settled.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    for doc in settled[keep:]:
        store.delete("jobs", doc["id"])
