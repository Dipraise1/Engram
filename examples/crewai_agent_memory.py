"""
Example: give a CrewAI agent durable memory backed by Engram.

This shows the SDK gap the LangChain and LlamaIndex adapters already fill for
their ecosystems: a CrewAI agent that can *store* findings during one task and
*recall* them by meaning in a later task, using an Engram miner as the backend.

Prerequisites:
  - A miner running locally:  python -m neurons.miner   (default http://127.0.0.1:8091)
  - pip install crewai engram-subnet

Run:
  python examples/crewai_agent_memory.py

If you just want to see the tools work without the full Crew/LLM loop, the
bottom of this file has a `--tools-only` path that calls the tools directly.
"""

from __future__ import annotations

import sys

from engram.sdk.crewai import engram_memory_tools

MINER_URL = "http://127.0.0.1:8091"


def tools_only_demo() -> None:
    """Exercise the tools directly — no LLM or API key required."""
    store_tool, search_tool = engram_memory_tools(miner_url=MINER_URL)

    print("Storing two memories...")
    print(" ", store_tool._run("Engram stores embeddings on a Bittensor subnet."))
    print(" ", store_tool._run("Retrieval uses the miner's HNSW index."))

    print("\nRecalling 'how does Engram find similar items?'")
    print(search_tool._run("how does Engram find similar items?"))


def full_crew_demo() -> None:
    """Wire the tools into a real CrewAI Agent + Crew."""
    from crewai import Agent, Crew, Task

    store_tool, search_tool = engram_memory_tools(miner_url=MINER_URL, top_k=5)

    archivist = Agent(
        role="Archivist",
        goal="Persist important facts to Engram memory.",
        backstory="You never forget — you write everything worth keeping to Engram.",
        tools=[store_tool],
        verbose=True,
    )
    analyst = Agent(
        role="Analyst",
        goal="Answer questions using only what is in Engram memory.",
        backstory="You recall stored facts by meaning before answering.",
        tools=[search_tool],
        verbose=True,
    )

    remember = Task(
        description=(
            "Store these facts in Engram memory: "
            "(1) Engram is a decentralized vector database on Bittensor. "
            "(2) Private namespaces use X25519 + sr25519 signed requests."
        ),
        expected_output="Confirmation that both facts were stored, with their CIDs.",
        agent=archivist,
    )
    recall = Task(
        description="Using Engram memory, answer: how are private namespaces secured?",
        expected_output="A short answer grounded in the retrieved memory.",
        agent=analyst,
    )

    crew = Crew(agents=[archivist, analyst], tasks=[remember, recall], verbose=True)
    result = crew.kickoff()
    print(result)


if __name__ == "__main__":
    if "--tools-only" in sys.argv:
        tools_only_demo()
    else:
        try:
            full_crew_demo()
        except Exception as exc:  # pragma: no cover - depends on local LLM/keys
            print(f"Full crew run needs CrewAI + an LLM configured: {exc}")
            print("Falling back to the tools-only demo (needs a running miner):\n")
            tools_only_demo()
