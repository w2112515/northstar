"""One-time Firestore migration: unprefixed collections -> {role}_ prefixed.

Run BEFORE deploying the build whose FirestoreStore reads prefixed names:

    uv run python scripts/migrate_firestore_roles.py --role dev            # dry run
    uv run python scripts/migrate_firestore_roles.py --role dev --apply   # copy
    uv run python scripts/migrate_firestore_roles.py --role dev --verify  # counts

Copy-only by design: the old collections stay as a fallback until the new
build is verified, then can be deleted by hand. Idempotent - re-running
overwrites the same doc ids with the same payloads.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# every collection either store implementation ever writes
COLLECTIONS = [
    "journal", "goals", "plans", "instances", "instance_state", "experiments",
    "approvals", "state", "weather_history", "lab_reports", "watchlist",
    "advice", "forecasts", "leases", "jobs",
]


def _client(project: str | None):
    """Firestore client via ADC, falling back to the gcloud CLI's user token
    (dev boxes often have `gcloud auth login` done but never ADC)."""
    from google.cloud import firestore  # type: ignore

    try:
        return firestore.Client(project=project) if project else firestore.Client()
    except Exception:
        import os
        import subprocess

        from google.oauth2.credentials import Credentials  # type: ignore

        token = subprocess.check_output("gcloud auth print-access-token", shell=True, text=True).strip()
        proj = project or os.getenv("GOOGLE_CLOUD_PROJECT", "")
        if not proj:
            raise SystemExit("no ADC and no --project/GOOGLE_CLOUD_PROJECT set")
        return firestore.Client(project=proj, credentials=Credentials(token=token))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", required=True, choices=["dev", "competition"])
    ap.add_argument("--project", default=None, help="GCP project id (default: ADC project)")
    ap.add_argument("--apply", action="store_true", help="actually copy (default: dry run)")
    ap.add_argument("--verify", action="store_true", help="compare doc counts old vs new")
    args = ap.parse_args()

    db = _client(args.project)
    prefix = f"{args.role}_"

    total = 0
    for name in COLLECTIONS:
        src = db.collection(name)
        dst = db.collection(prefix + name)
        src_docs = list(src.stream())
        if args.verify:
            dst_count = sum(1 for _ in dst.stream())
            mark = "OK " if dst_count >= len(src_docs) else "MISSING"
            print(f"{mark} {name}: old={len(src_docs)} new({prefix}{name})={dst_count}")
            continue
        if not src_docs:
            continue
        print(f"{name}: {len(src_docs)} docs -> {prefix}{name}" + ("" if args.apply else " (dry run)"))
        total += len(src_docs)
        if args.apply:
            batch = db.batch()
            pending = 0
            for snap in src_docs:
                batch.set(dst.document(snap.id), snap.to_dict())
                pending += 1
                if pending >= 400:  # firestore batch limit is 500 writes
                    batch.commit()
                    batch = db.batch()
                    pending = 0
            if pending:
                batch.commit()
    if not args.verify:
        print(f"{'copied' if args.apply else 'would copy'} {total} docs total")


if __name__ == "__main__":
    main()
