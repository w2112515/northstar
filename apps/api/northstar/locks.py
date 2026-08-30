"""Process-wide locks for the money path.

Passes and approval decisions run in worker threads (the API offloads them
with asyncio.to_thread), so plain threading locks are the right primitive.
Single-process by design - the deploy pins the API to max-instances 1.
"""

from __future__ import annotations

import threading

# One trading pass at a time, across all three entries (manual tick, scheduler,
# run-once fallback). Acquire non-blocking: a second caller gets "skipped",
# never a queue of stacked passes.
PASS_LOCK = threading.Lock()

# Approval decisions flip status under this lock so a double click (or two
# concurrent requests) can never execute the same order twice.
APPROVAL_LOCK = threading.Lock()
