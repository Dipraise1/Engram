"""
CrewAI adapter test — engram/sdk/crewai.py

Offline-safe: requires neither a live miner nor an LLM. Mirrors the harness
style of scripts/test_sdk.py.

Behavior covered:
  - Module imports cleanly whether or not CrewAI is installed.
  - Without CrewAI: constructing a tool raises a helpful ImportError.
  - With CrewAI: tools construct, expose correct name/description/args_schema,
    and degrade gracefully (return an error string, not raise) when the miner
    is offline.

Run:
  python scripts/test_crewai_sdk.py
"""

import sys

sys.path.insert(0, ".")

from engram.sdk import crewai as engram_crewai  # noqa: E402

DEAD_URL = "http://127.0.0.1:19999"  # nothing running here

results: list[tuple[str, bool]] = []
PASS = "✓"
FAIL = "✗"


def check(label: str, condition: bool) -> None:
    print(f"  {PASS if condition else FAIL}  {label}")
    results.append((label, bool(condition)))


def section(title: str) -> None:
    print(f"\n[{title}]")


def main() -> int:
    section("Import + public surface")
    check("module imports", engram_crewai is not None)
    check(
        "exports the expected names",
        set(engram_crewai.__all__)
        == {"EngramStoreTool", "EngramSearchTool", "engram_memory_tools"},
    )

    if not engram_crewai._CREWAI_AVAILABLE:
        section("CrewAI not installed — graceful error path")
        try:
            engram_crewai.EngramStoreTool(miner_url=DEAD_URL)
            check("EngramStoreTool() raises ImportError without CrewAI", False)
        except ImportError:
            check("EngramStoreTool() raises ImportError without CrewAI", True)
        except Exception:
            check("EngramStoreTool() raises ImportError without CrewAI", False)
    else:
        section("CrewAI installed — tool construction")
        store = engram_crewai.EngramStoreTool(miner_url=DEAD_URL)
        search = engram_crewai.EngramSearchTool(miner_url=DEAD_URL, top_k=3)
        check("store tool name is 'engram_store'", store.name == "engram_store")
        check("search tool name is 'engram_search'", search.name == "engram_search")
        check("store has a non-empty description", bool(store.description))
        check("search args_schema is set", search.args_schema is not None)

        factory = engram_crewai.engram_memory_tools(miner_url=DEAD_URL)
        check("engram_memory_tools() returns a pair", len(factory) == 2)

        section("Offline miner — graceful degradation (no exceptions)")
        out_store = store._run("a fact to remember")
        check("store._run returns a string", isinstance(out_store, str))
        check("store._run reports failure gracefully", "Could not store" in out_store)

        out_search = search._run("recall something")
        check("search._run returns a string", isinstance(out_search, str))
        check("search._run reports failure gracefully", "Search failed" in out_search)

    failed = [label for label, ok in results if not ok]
    print(f"\n{'='*52}")
    print(f"  {len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("  FAILED:")
        for label in failed:
            print(f"    - {label}")
        return 1
    print("  ALL GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
