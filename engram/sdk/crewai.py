"""
Engram — CrewAI tool adapter

Exposes an Engram miner as CrewAI tools so any CrewAI agent can use the
decentralized subnet as long-term semantic memory: store facts during a run
and retrieve them later by meaning.

Mirrors the lazy-import pattern of the LangChain and LlamaIndex adapters
(`engram/sdk/langchain.py`, `engram/sdk/llama_index.py`) so importing this
module never hard-requires CrewAI.

Install:
    pip install crewai engram-subnet

Usage:
    from crewai import Agent, Task, Crew
    from engram.sdk.crewai import engram_memory_tools

    store_tool, search_tool = engram_memory_tools(miner_url="http://127.0.0.1:8091")

    researcher = Agent(
        role="Researcher",
        goal="Remember findings and recall them across tasks",
        backstory="Uses Engram as durable cross-task memory.",
        tools=[store_tool, search_tool],
    )

You can also construct the tools directly:

    from engram.sdk.crewai import EngramStoreTool, EngramSearchTool

    store_tool = EngramStoreTool(miner_url="http://127.0.0.1:8091")
    search_tool = EngramSearchTool(miner_url="http://127.0.0.1:8091", top_k=5)
"""

from __future__ import annotations

from typing import Any

from engram.sdk.client import EngramClient
from engram.sdk.exceptions import EngramError

try:
    from crewai.tools import BaseTool
    from pydantic import BaseModel, Field, PrivateAttr

    _CREWAI_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only without CrewAI installed
    _CREWAI_AVAILABLE = False

    # Minimal shims so the module imports cleanly and gives a helpful error
    # at instantiation time, exactly like the LangChain/LlamaIndex adapters.
    class BaseTool:  # type: ignore[no-redef]
        pass

    class BaseModel:  # type: ignore[no-redef]
        pass

    def Field(*args: Any, **kwargs: Any) -> Any:  # type: ignore[no-redef]
        return None

    def PrivateAttr(*args: Any, **kwargs: Any) -> Any:  # type: ignore[no-redef]
        return None


DEFAULT_MINER_URL = "http://127.0.0.1:8091"


def _require_crewai() -> None:
    if not _CREWAI_AVAILABLE:
        raise ImportError(
            "crewai is required for the Engram CrewAI tools. "
            "Install it with: pip install crewai"
        )


# ── Argument schemas ──────────────────────────────────────────────────────────


class _StoreArgs(BaseModel):
    text: str = Field(..., description="The text/fact to store in Engram memory.")
    source: str = Field(
        default="crewai",
        description="Optional tag recorded in the memory's metadata.",
    )


class _SearchArgs(BaseModel):
    query: str = Field(..., description="What to recall, described in natural language.")


# ── Tools ───────────────────────────────────────────────────────────────────


class EngramStoreTool(BaseTool):
    """CrewAI tool that stores a piece of text in an Engram miner.

    The miner returns a content ID (CID); the same text+metadata is
    content-addressed, so storing it twice yields the same CID.
    """

    name: str = "engram_store"
    description: str = (
        "Store a fact or piece of text in long-term Engram memory so it can be "
        "recalled later by meaning. Input the text to remember. "
        "Returns the content ID (CID) of the stored memory."
    )
    args_schema: type = _StoreArgs

    miner_url: str = DEFAULT_MINER_URL
    timeout: float = 30.0

    _client: EngramClient = PrivateAttr()

    def __init__(self, **data: Any) -> None:
        _require_crewai()
        super().__init__(**data)
        self._client = EngramClient(miner_url=self.miner_url, timeout=self.timeout)

    def _run(self, text: str, source: str = "crewai") -> str:
        try:
            cid = self._client.ingest(text, metadata={"text": text, "source": source})
            return f"Stored memory. CID: {cid}"
        except EngramError as exc:
            return f"Could not store memory: {exc}"


class EngramSearchTool(BaseTool):
    """CrewAI tool that retrieves the most relevant memories from an Engram miner."""

    name: str = "engram_search"
    description: str = (
        "Search long-term Engram memory for facts relevant to a natural-language "
        "query. Returns the top matching memories with similarity scores."
    )
    args_schema: type = _SearchArgs

    miner_url: str = DEFAULT_MINER_URL
    timeout: float = 30.0
    top_k: int = 4

    _client: EngramClient = PrivateAttr()

    def __init__(self, **data: Any) -> None:
        _require_crewai()
        super().__init__(**data)
        self._client = EngramClient(miner_url=self.miner_url, timeout=self.timeout)

    def _run(self, query: str) -> str:
        try:
            results = self._client.query(query, top_k=self.top_k)
        except EngramError as exc:
            return f"Search failed: {exc}"

        if not results:
            return "No relevant memories found."

        lines = []
        for r in results:
            meta = dict(r.get("metadata") or {})
            content = meta.get("text", r.get("cid", ""))
            score = float(r.get("score", 0.0))
            lines.append(f"[{score:.4f}] {content}")
        return "\n".join(lines)


def engram_memory_tools(
    miner_url: str = DEFAULT_MINER_URL,
    timeout: float = 30.0,
    top_k: int = 4,
) -> tuple[EngramStoreTool, EngramSearchTool]:
    """Return a (store_tool, search_tool) pair wired to the same miner.

    Convenience for the common case of giving a CrewAI agent both
    write and read access to Engram memory.
    """
    _require_crewai()
    store = EngramStoreTool(miner_url=miner_url, timeout=timeout)
    search = EngramSearchTool(miner_url=miner_url, timeout=timeout, top_k=top_k)
    return store, search


__all__ = [
    "EngramStoreTool",
    "EngramSearchTool",
    "engram_memory_tools",
]
