"""Best-effort push notifications (Telegram).

Approvals expire on a timer (timeout = automatic no), so a missed push never
changes what the system does - it only costs convenience. Delivery is
therefore strictly fire-and-forget: unconfigured = disabled, failures are one
stderr line, and nothing in the money path ever waits on Telegram.

Setup (~2 min): create a bot with @BotFather -> TELEGRAM_BOT_TOKEN; send the
bot one message, read the chat id from getUpdates -> TELEGRAM_CHAT_ID. Both go
in .env. Optional COCKPIT_URL adds a "decide here" link to approval pushes.
"""

from __future__ import annotations

import os
import threading
import urllib.parse
import urllib.request

__all__ = ["enabled", "notify", "notify_approval"]


def _config() -> tuple[str, str] | None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return None
    return token, chat_id


def enabled() -> bool:
    return _config() is not None


def _post(token: str, chat_id: str, text: str) -> None:
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            res.read()
    except Exception as e:  # pragma: no cover - network dependent
        print(f"[notify] telegram send failed: {type(e).__name__}: {e}")


def notify(text: str) -> bool:
    """Queue a Telegram message on a daemon thread; True = send attempted."""
    cfg = _config()
    if cfg is None:
        return False
    token, chat_id = cfg
    threading.Thread(target=_post, args=(token, chat_id, text), daemon=True).start()
    return True


def notify_approval(order_human: str, reason_codes: list[str], expires_hours: float) -> bool:
    """Push a pending-approval card summary to the operator's phone."""
    lines = [
        "NorthStar - needs your call:",
        order_human,
        f"Reasons: {', '.join(reason_codes)}.",
        f"No decision within {expires_hours:g}h = automatic no.",
    ]
    cockpit = os.getenv("COCKPIT_URL", "").strip()
    if cockpit:
        lines.append(f"Decide: {cockpit}")
    return notify("\n".join(lines))
