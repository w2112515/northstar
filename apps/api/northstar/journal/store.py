"""Journal & document store.

Append-only journal (lineage) + small document collections (goals, plans,
strategy instances, experiments, pending approvals, positions state) + a
driver lease (single-writer election for the trading scheduler).

Two implementations behind one interface:
- LocalJsonStore: data/<role>/journal.jsonl + db.json + driver.lock (default)
- FirestoreStore: enabled via JOURNAL_STORE=firestore (see firestore_store.py)
"""

from __future__ import annotations

import json
import os
import threading
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Protocol

from northstar.config import get_settings
from northstar.domain import JournalEvent


class Store(Protocol):
    def append_event(self, event: JournalEvent) -> None: ...
    def events(self, kinds: Iterable[str] | None = None, limit: int = 200) -> list[JournalEvent]: ...
    def save(self, collection: str, doc_id: str, doc: dict[str, Any]) -> None: ...
    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None: ...
    def list(self, collection: str) -> list[dict[str, Any]]: ...
    def delete(self, collection: str, doc_id: str) -> None: ...
    # single-writer election: acquire also renews when `holder` already owns it
    def acquire_lease(self, name: str, holder: str, ttl_seconds: int) -> bool: ...
    def release_lease(self, name: str, holder: str) -> None: ...
    def lease_holder(self, name: str) -> str | None: ...


class LocalJsonStore:
    def __init__(self, data_dir: Path):
        self._dir = data_dir
        self._journal_path = data_dir / "journal.jsonl"
        self._db_path = data_dir / "db.json"
        self._lock = threading.RLock()
        if not self._db_path.exists():
            self._db_path.write_text("{}", encoding="utf-8")

    # ---- journal (append only)
    def append_event(self, event: JournalEvent) -> None:
        line = event.model_dump_json()
        with self._lock, self._journal_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    def events(self, kinds: Iterable[str] | None = None, limit: int = 200) -> list[JournalEvent]:
        if not self._journal_path.exists():
            return []
        kindset = set(kinds) if kinds else None
        out: list[JournalEvent] = []
        with self._lock, self._journal_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = JournalEvent.model_validate_json(line)
                except Exception:
                    continue
                if kindset is None or ev.kind in kindset:
                    out.append(ev)
        return out[-limit:][::-1]  # newest first

    # ---- documents
    def _read_db(self) -> dict[str, dict[str, Any]]:
        try:
            return json.loads(self._db_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _write_db(self, db: dict[str, Any]) -> None:
        tmp = self._db_path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self._db_path)

    def save(self, collection: str, doc_id: str, doc: dict[str, Any]) -> None:
        with self._lock:
            db = self._read_db()
            db.setdefault(collection, {})[doc_id] = doc
            self._write_db(db)

    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._read_db().get(collection, {}).get(doc_id)

    def list(self, collection: str) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._read_db().get(collection, {}).values())

    def delete(self, collection: str, doc_id: str) -> None:
        with self._lock:
            db = self._read_db()
            db.get(collection, {}).pop(doc_id, None)
            self._write_db(db)

    # ---- driver lease (cross-process: O_EXCL lock files, stale by mtime+ttl)
    def _lease_path(self, name: str) -> Path:
        return self._dir / f"{name}.lock"

    def acquire_lease(self, name: str, holder: str, ttl_seconds: int) -> bool:
        path = self._lease_path(name)
        with self._lock:
            try:
                fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump({"holder": holder, "ts": time.time()}, f)
                return True
            except FileExistsError:
                pass
            try:
                doc = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                doc = {}
            expired = time.time() - float(doc.get("ts", 0)) > ttl_seconds
            if doc.get("holder") == holder or expired:
                # renew, or take over a dead holder's lock. Not perfectly atomic
                # across processes, but colliding here requires two drivers on
                # one data_dir racing within the same tick - an ops error the
                # lease exists to surface, and the window is milliseconds.
                path.write_text(json.dumps({"holder": holder, "ts": time.time()}), encoding="utf-8")
                return True
            return False

    def release_lease(self, name: str, holder: str) -> None:
        path = self._lease_path(name)
        with self._lock:
            try:
                doc = json.loads(path.read_text(encoding="utf-8"))
                if doc.get("holder") == holder:
                    path.unlink(missing_ok=True)
            except FileNotFoundError:
                pass
            except Exception:
                pass

    def lease_holder(self, name: str) -> str | None:
        try:
            doc = json.loads(self._lease_path(name).read_text(encoding="utf-8"))
            return str(doc.get("holder")) if doc.get("holder") else None
        except Exception:
            return None


@lru_cache(maxsize=1)
def get_store() -> Store:
    s = get_settings()
    if s.journal_store == "firestore":
        from northstar.journal.firestore_store import FirestoreStore

        return FirestoreStore()
    return LocalJsonStore(s.data_dir)
