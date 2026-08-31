"""Firestore implementation of the Store interface.

Activated with JOURNAL_STORE=firestore. Requires:
- `uv add google-cloud-firestore`
- GOOGLE_CLOUD_PROJECT env var (or default credentials on Cloud Run)

Role isolation: every collection name is prefixed with the account role
(dev_journal, competition_goals, ...) so two roles sharing one Firestore
project can never read each other's books - same guarantee the local store
gets from per-role data directories. scripts/migrate_firestore_roles.py moves
pre-prefix data in.

Kept minimal on purpose; same interface as LocalJsonStore so the swap is a
config change, not a refactor.
"""

from __future__ import annotations

import time
from typing import Any, Iterable

from northstar.config import get_settings
from northstar.domain import JournalEvent


class FirestoreStore:
    def __init__(self) -> None:
        try:
            from google.cloud import firestore  # type: ignore
        except ImportError as e:  # honest failure, no silent fallback
            raise RuntimeError(
                "JOURNAL_STORE=firestore but google-cloud-firestore is not installed. "
                "Run: uv add google-cloud-firestore"
            ) from e
        self._db = firestore.Client()
        self._prefix = f"{get_settings().account_role}_"

    def _coll(self, name: str):
        return self._db.collection(self._prefix + name)

    def append_event(self, event: JournalEvent) -> None:
        self._coll("journal").document(event.id).set(event.model_dump())

    def events(self, kinds: Iterable[str] | None = None, limit: int = 200) -> list[JournalEvent]:
        # Semantics must match LocalJsonStore: `limit` counts events of the
        # requested kinds, not raw documents. Filtering server-side would need
        # a composite index (kind, ts), so we over-fetch and trim instead -
        # bounded, and no "config change only" promise gets broken by indexes.
        kindset = set(kinds) if kinds else None
        fetch = limit if kindset is None else min(max(limit * 5, 500), 2000)
        q = self._coll("journal").order_by("ts", direction="DESCENDING").limit(fetch)
        docs = [d.to_dict() for d in q.stream()]
        out = [JournalEvent.model_validate(d) for d in docs]
        if kindset is not None:
            out = [e for e in out if e.kind in kindset][:limit]
        return out

    def save(self, collection: str, doc_id: str, doc: dict[str, Any]) -> None:
        self._coll(collection).document(doc_id).set(doc)

    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        snap = self._coll(collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def list(self, collection: str) -> list[dict[str, Any]]:
        return [d.to_dict() for d in self._coll(collection).stream()]

    def delete(self, collection: str, doc_id: str) -> None:
        self._coll(collection).document(doc_id).delete()

    # ---- driver lease (transactional compare-and-set on one document)
    def acquire_lease(self, name: str, holder: str, ttl_seconds: int) -> bool:
        from google.cloud import firestore  # type: ignore

        ref = self._coll("leases").document(name)
        transaction = self._db.transaction()

        @firestore.transactional
        def attempt(tx) -> bool:
            snap = ref.get(transaction=tx)
            now = time.time()
            if snap.exists:
                doc = snap.to_dict() or {}
                held_by_other = doc.get("holder") != holder
                fresh = now - float(doc.get("ts", 0)) <= ttl_seconds
                if held_by_other and fresh:
                    return False
            tx.set(ref, {"holder": holder, "ts": now})
            return True

        try:
            return bool(attempt(transaction))
        except Exception as e:
            # contention/aborted transaction = we did not get it this round
            print(f"[lease] firestore acquire failed: {type(e).__name__}: {e}")
            return False

    def release_lease(self, name: str, holder: str) -> None:
        ref = self._coll("leases").document(name)
        try:
            snap = ref.get()
            if snap.exists and (snap.to_dict() or {}).get("holder") == holder:
                ref.delete()
        except Exception as e:
            print(f"[lease] firestore release failed: {type(e).__name__}: {e}")

    def lease_holder(self, name: str) -> str | None:
        try:
            snap = self._coll("leases").document(name).get()
            if snap.exists:
                holder = (snap.to_dict() or {}).get("holder")
                return str(holder) if holder else None
        except Exception:
            pass
        return None
