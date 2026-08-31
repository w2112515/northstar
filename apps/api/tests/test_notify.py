"""Telegram push notifications: disabled-by-default, fire-and-forget."""

import time

from northstar import notify as notify_mod


def _drain(sent: list, tries: int = 100) -> None:
    """The send runs on a daemon thread; poll briefly until it lands."""
    for _ in range(tries):
        if sent:
            return
        time.sleep(0.01)


def test_disabled_without_config(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    assert notify_mod.enabled() is False
    assert notify_mod.notify("hello") is False
    assert notify_mod.notify_approval("Sell 1 put.", ["weather_storm"], 12.0) is False


def test_partial_config_still_disabled(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "t0k3n")
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    assert notify_mod.notify("hello") is False


def test_approval_push_when_configured(monkeypatch):
    sent: list[tuple[str, str, str]] = []
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "t0k3n")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    monkeypatch.setenv("COCKPIT_URL", "http://example.test:3000")
    monkeypatch.setattr(notify_mod, "_post", lambda tok, chat, text: sent.append((tok, chat, text)))

    assert notify_mod.notify_approval("Sell 1 INTC put.", ["weather_storm", "soft_breaker"], 12.0) is True
    _drain(sent)
    assert sent, "daemon thread never delivered"
    tok, chat, text = sent[0]
    assert (tok, chat) == ("t0k3n", "42")
    assert "needs your call" in text.lower()
    assert "Sell 1 INTC put." in text
    assert "weather_storm" in text
    assert "12h = automatic no" in text
    assert "http://example.test:3000" in text


def test_push_without_cockpit_link(monkeypatch):
    sent: list[tuple[str, str, str]] = []
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "t0k3n")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    monkeypatch.delenv("COCKPIT_URL", raising=False)
    monkeypatch.setattr(notify_mod, "_post", lambda tok, chat, text: sent.append((tok, chat, text)))

    assert notify_mod.notify_approval("Sell 1 put.", ["cooldown"], 6.0) is True
    _drain(sent)
    assert sent and "Decide:" not in sent[0][2]
