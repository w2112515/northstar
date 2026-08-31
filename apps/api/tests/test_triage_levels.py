"""#18 three-level triage: reduce = manage exits only, open nothing new.
The engine-side tightening lives in the signals node - strategies never run."""

from northstar.adkflows import trading_loop as tl
from tests.test_pnl import FakeStore


def _run_node(node, ctx):
    raw = getattr(node, "_func", None) or getattr(node, "func")
    return raw(ctx)


class Ctx:
    """Minimal stand-in for the ADK Context (nodes only touch .state)."""

    def __init__(self, state):
        self.state = state


def _wired(monkeypatch, run_id: str) -> tuple[tl.PassBoard, list[str]]:
    board = tl.PassBoard()
    tl._BOARDS[run_id] = board
    strategy_calls: list[str] = []
    monkeypatch.setattr(tl, "get_store", lambda: FakeStore())
    monkeypatch.setattr(tl, "collect_exits", lambda *a: [("exit_prop", "exit_order")])
    monkeypatch.setattr(tl, "load_instances_and_bars",
                        lambda *a: strategy_calls.append("load") or [])
    monkeypatch.setattr(tl, "collect_proposals",
                        lambda *a: strategy_calls.append("propose") or [])
    return board, strategy_calls


def test_reduce_tends_exits_opens_nothing(monkeypatch):
    board, strategy_calls = _wired(monkeypatch, "t-reduce")
    ctx = Ctx({"run_id": "t-reduce", "triage_mode": "reduce",
               "dry_run": True, "market_open": True})
    out = _run_node(tl.signals, ctx)
    assert out["n_proposals"] == 0
    assert out["n_exit_candidates"] == 1
    assert board.exits == [("exit_prop", "exit_order")]   # book still tended
    assert board.proposals == []
    assert strategy_calls == []                            # strategies never ran
    assert board.summary["proposals"] == []


def test_observe_skips_everything(monkeypatch):
    board, strategy_calls = _wired(monkeypatch, "t-observe")
    ctx = Ctx({"run_id": "t-observe", "triage_mode": "observe",
               "dry_run": True, "market_open": True})
    out = _run_node(tl.signals, ctx)
    assert out == {"n_proposals": 0}
    assert board.exits == [] and strategy_calls == []


def test_act_runs_the_full_pipeline(monkeypatch):
    board, strategy_calls = _wired(monkeypatch, "t-act")
    ctx = Ctx({"run_id": "t-act", "triage_mode": "act",
               "dry_run": True, "market_open": True})
    out = _run_node(tl.signals, ctx)
    assert out["n_proposals"] == 0            # mocked collect_proposals returns []
    assert board.exits == [("exit_prop", "exit_order")]
    assert strategy_calls == ["load", "propose"]


def test_reduce_digest_template(monkeypatch):
    """Fallback digest (no LLM) names the defensive posture honestly."""
    board = tl.PassBoard()
    board.summary = {"proposals": []}
    tl._BOARDS["t-digest"] = board
    monkeypatch.setattr(tl, "llm_available", lambda: False)
    ctx = Ctx({"run_id": "t-digest", "triage_mode": "reduce",
               "triage_reason": "Storm conditions.", "n_exits": 2})
    out = _run_node(tl.explain, ctx)
    assert out["digest_llm"] is False
    assert "went defensive" in out["digest"]
    assert "(2 closed)" in out["digest"]
    assert "opened nothing new" in out["digest"]
