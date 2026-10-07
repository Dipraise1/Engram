#!/usr/bin/env python3
"""Generate and verify the Engram miner OpenAPI document."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engram.miner.openapi import build_openapi_spec


OPENAPI_PATH = ROOT / "docs" / "openapi.json"
REDOC_PATH = ROOT / "docs" / "miner-openapi.html"


def _render_json() -> str:
    return json.dumps(build_openapi_spec(), indent=2, sort_keys=True) + "\n"


def _render_redoc() -> str:
    return """<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>Engram Miner HTTP API</title>
</head>
<body>
  <redoc spec-url=\"./openapi.json\"></redoc>
  <script src=\"https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js\"></script>
</body>
</html>
"""


def write_files() -> None:
    OPENAPI_PATH.parent.mkdir(parents=True, exist_ok=True)
    OPENAPI_PATH.write_text(_render_json(), encoding="utf-8")
    REDOC_PATH.write_text(_render_redoc(), encoding="utf-8")


def check_files() -> list[str]:
    expected = {
        OPENAPI_PATH: _render_json(),
        REDOC_PATH: _render_redoc(),
    }
    stale = []
    for path, content in expected.items():
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            stale.append(str(path.relative_to(ROOT)))
    return stale


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if generated files are stale")
    args = parser.parse_args()

    if args.check:
        stale = check_files()
        if stale:
            print("OpenAPI files are stale:")
            for path in stale:
                print(f"- {path}")
            print("Run: python scripts/generate_openapi.py")
            return 1
        print("OpenAPI files are up to date")
        return 0

    write_files()
    print(f"Wrote {OPENAPI_PATH.relative_to(ROOT)}")
    print(f"Wrote {REDOC_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
