"""Read-only alpaca-mcp-server toolset for LLM nodes (Alpaca track requirement).

Contract (docs/TECH.md D2): LLMs get DATA tools only - the trading toolset is
never mounted. Execution stays in northstar.executor behind the risk gate.

The official alpaca-mcp-server (V2) is a Python package run via `uvx`;
ALPACA_TOOLSETS restricts which tool groups exist in-process at all.
"""

from __future__ import annotations

from typing import Any

from northstar.config import get_settings

READONLY_TOOLSETS = "stock-data,options-data,account"


def alpaca_mcp_params() -> dict[str, Any]:
    s = get_settings()
    return {
        "command": "uvx",
        "args": ["alpaca-mcp-server"],
        "env": {
            "ALPACA_API_KEY": s.alpaca_api_key,
            "ALPACA_SECRET_KEY": s.alpaca_secret_key,
            "ALPACA_PAPER_TRADE": "True",
            "ALPACA_TOOLSETS": READONLY_TOOLSETS,
        },
    }


def _readonly_only(tool, _ctx=None) -> bool:
    """Belt & suspenders: even inside allowed toolsets, drop anything mutating."""
    return not tool.name.startswith(("update_", "create_", "place_", "cancel_", "close_", "delete_"))


def build_alpaca_mcp_toolset():
    """ADK McpToolset wired to the read-only alpaca-mcp-server (stdio)."""
    from google.adk.tools import McpToolset
    from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
    from mcp import StdioServerParameters

    p = alpaca_mcp_params()
    return McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(command=p["command"], args=p["args"], env=p["env"]),
            timeout=30,
        ),
        tool_filter=_readonly_only,
    )


async def list_mcp_tools() -> list[str]:
    """Connectivity check: spawn the server, list tool names, close."""
    toolset = build_alpaca_mcp_toolset()
    try:
        tools = await toolset.get_tools()
        return sorted(t.name for t in tools)
    finally:
        await toolset.close()
