"""Firestore implementation of the Store interface.

Activated with JOURNAL_STORE=firestore. Requires:
- `uv add google-cloud-firestore`
- GOOGLE_CLOUD_PROJECT env var (or default credentials on Cloud Run)

Kept minimal on purpose; same interface as LocalJsonStore so the swap is a
config change, not a refactor.
"""

from __future__ import annotations

from typing import Any, Iterable

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

    def append_event(self, event: JournalEvent) -> None:
        self._db.collection("journal").document(event.id).set(event.model_dump())

    def events(self, kinds: Iterable[str] | None = None, limit: int = 200) -> list[JournalEvent]:
        q = self._db.collection("journal").order_by("ts", direction="DESCENDING").limit(limit)
        docs = [d.to_dict() for d in q.stream()]
        out = [JournalEvent.model_validate(d) for d in docs]
        if kinds:
            kindset = set(kinds)
            out = [e for e in out if e.kind in kindset]
        return out

    def save(self, collection: str, doc_id: str, doc: dict[str, Any]) -> None:
        self._db.collection(collection).document(doc_id).set(doc)

    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        snap = self._db.collection(collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def list(self, collection: str) -> list[dict[str, Any]]:
        return [d.to_dict() for d in self._db.collection(collection).stream()]

    def delete(self, collection: str, doc_id: str) -> None:
        self._db.collection(collection).document(doc_id).delete()
