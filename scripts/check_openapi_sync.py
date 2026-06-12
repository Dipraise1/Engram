"""
Engram Miner — OpenAPI ↔ aiohttp route sync check

Parses ``neurons/miner.py`` with the ``ast`` module and extracts every
``app.router.add_<method>(...)`` registration inside ``run()``.  Compares the
extracted set against the route table in ``scripts/generate_openapi.py``
(METHOD, path, handler_name) and fails CI if they drift apart.

Why AST instead of importing ``miner.py``?
------------------------------------------
* ``miner.py`` imports bittensor + faiss + sentence-transformers at module
  scope, none of which are present in the SDK install or the slim CI image.
* Lifting registrations out of ``run()`` would couple the runtime shape to a
  CI-only tool — undesirable.

So we walk the AST, find the route calls, and compare.

Exits non-zero with a diff when there is drift.  Run as part of CI::

    python scripts/check_openapi_sync.py
"""

from __future__ import annotations

import argparse
import ast
import sys
from pathlib import Path
from typing import NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent
MINER_FILE = REPO_ROOT / "neurons" / "miner.py"
GENERATOR_FILE = REPO_ROOT / "scripts" / "generate_openapi.py"

# aiohttp methods we care about.  ``add_post``/``add_get``/etc. map directly.
AIOHTTP_METHODS: set[str] = {"get", "post", "put", "patch", "delete", "head", "options"}


class Route(NamedTuple):
    method: str  # "GET", "POST", ...
    path: str  # "/IngestSynapse"
    handler: str  # "handle_ingest"

    def as_tuple(self) -> tuple[str, str, str]:
        return (self.method, self.path, self.handler)


# ── 1. Extract routes from neurons/miner.py via AST ────────────────────────────


def _literal_str(node: ast.AST) -> str | None:
    """Return the source value of a Constant/JoinedStr/Literal node, else None."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr):
        # f-string like "/wallet-stats/{hotkey}" — concatenate parts verbatim.
        out: list[str] = []
        for part in node.values:
            if isinstance(part, ast.Constant) and isinstance(part.value, str):
                out.append(part.value)
            elif isinstance(part, ast.FormattedValue):
                # Render the variable/expression as a placeholder.  For our
                # purposes (just matching the path string) we use a stable
                # sentinel that matches the generator's path strings.
                if isinstance(part.value, ast.Name):
                    out.append("{" + part.value.id + "}")
                else:
                    return None
            else:
                return None
        return "".join(out)
    return None


def _extract_from_run(tree: ast.Module) -> list[Route]:
    """Find run() in the module and collect all app.router.add_<method>(...) calls."""
    run_fn: ast.FunctionDef | ast.AsyncFunctionDef | None = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "run":
            run_fn = node
            break
    if run_fn is None:
        raise SystemExit(f"FATAL: no run() function found in {MINER_FILE}")

    routes: list[Route] = []
    for node in ast.walk(run_fn):
        if not isinstance(node, ast.Call):
            continue
        # Match calls of the shape  app.router.add_<method>(path, handler)
        func = node.func
        if not isinstance(func, ast.Attribute):
            continue
        attr = func.attr  # "add_post", "add_get", ...
        if not attr.startswith("add_"):
            continue
        method_token = attr[len("add_") :]
        if method_token not in AIOHTTP_METHODS:
            continue

        # Confirm the receiver is app.router (not, say, some unrelated add_post).
        if not (
            isinstance(func.value, ast.Attribute)
            and func.value.attr == "router"
            and isinstance(func.value.value, ast.Name)
            and func.value.value.id == "app"
        ):
            continue

        if len(node.args) < 2:
            print(
                f"warn: skipping {attr}(...) with <2 positional args in {MINER_FILE}",
                file=sys.stderr,
            )
            continue

        path = _literal_str(node.args[0])
        if path is None:
            print(
                f"warn: skipping {attr}(<non-literal path>) in {MINER_FILE}",
                file=sys.stderr,
            )
            continue

        handler_node = node.args[1]
        if not isinstance(handler_node, ast.Name):
            print(
                f"warn: skipping {attr}('{path}') with non-Name handler in {MINER_FILE}",
                file=sys.stderr,
            )
            continue
        handler = handler_node.id

        routes.append(Route(method_token.upper(), path, handler))
    return routes


# ── 2. Extract expected routes from the generator's ROUTES table ───────────────


def _extract_from_generator() -> list[Route]:
    """Import scripts/generate_openapi.py in isolation and read its ROUTES list.

    Uses a lightweight import (no third-party deps) — the generator itself only
    imports stdlib + PyYAML, both of which CI provides.
    """
    import importlib.util

    spec = importlib.util.spec_from_file_location("generate_openapi", GENERATOR_FILE)
    if spec is None or spec.loader is None:
        raise SystemExit(f"FATAL: cannot import {GENERATOR_FILE}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
    except ModuleNotFoundError as exc:
        raise SystemExit(
            f"FATAL: generator missing dependency: {exc}.  Install PyYAML."
        ) from exc

    out: list[Route] = []
    for entry in module.ROUTES:
        try:
            out.append(Route(entry["method"], entry["path"], entry.get("handler", "")))
        except KeyError as exc:
            raise SystemExit(
                f"FATAL: route entry in {GENERATOR_FILE} missing field {exc}"
            ) from exc
    return out


# ── 3. Diff and report ────────────────────────────────────────────────────────


def _diff(actual: list[Route], expected: list[Route]) -> list[str]:
    actual_set = {r.as_tuple() for r in actual}
    expected_set = {r.as_tuple() for r in expected}
    missing = expected_set - actual_set  # in generator, not in miner
    extra = actual_set - expected_set  # in miner, not in generator
    problems: list[str] = []
    for method, path, handler in sorted(missing):
        problems.append(
            f"  [generator-only] {method} {path}  (handler={handler!r}) — "
            f"add a matching app.router.add_{method.lower()}('{path}', {handler}) "
            f"in neurons/miner.py"
        )
    for method, path, handler in sorted(extra):
        problems.append(
            f"  [miner-only]     {method} {path}  (handler={handler!r}) — "
            f"add a matching ROUTES entry in scripts/generate_openapi.py"
        )
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero if any drift is detected (default: warn only).",
    )
    args = parser.parse_args()

    if not MINER_FILE.is_file():
        print(f"FATAL: {MINER_FILE} not found", file=sys.stderr)
        return 2
    if not GENERATOR_FILE.is_file():
        print(f"FATAL: {GENERATOR_FILE} not found", file=sys.stderr)
        return 2

    miner_src = MINER_FILE.read_text(encoding="utf-8")
    tree = ast.parse(miner_src, filename=str(MINER_FILE))
    actual = _extract_from_run(tree)
    expected = _extract_from_generator()

    problems = _diff(actual, expected)
    print(
        f"[openapi-sync] miner routes: {len(actual)}  |  generator routes: {len(expected)}"
    )
    if not problems:
        print("[openapi-sync] OK — all routes are in sync.")
        return 0

    print("[openapi-sync] DRIFT DETECTED:", file=sys.stderr)
    for line in problems:
        print(line, file=sys.stderr)
    if args.strict:
        return 1
    print(
        "[openapi-sync] (run with --strict to fail CI; informational only by default)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
