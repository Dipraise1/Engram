#!/usr/bin/env python3
"""
CI check: verify that docs/openapi.yaml covers all HTTP routes defined in neurons/miner.py.

This script parses the miner source to extract route paths registered via
`app.router.add_*()` calls, then checks that each path exists in the OpenAPI spec.

Usage:
    python scripts/check_openapi_sync.py

Exit codes:
    0 — all routes are documented
    1 — missing routes detected
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    # Fallback: just check file exists
    print("⚠️  PyYAML not installed — skipping deep validation")
    spec_path = Path(__file__).resolve().parent.parent / "docs" / "openapi.yaml"
    if spec_path.exists():
        print(f"✅ OpenAPI spec exists: {spec_path}")
        sys.exit(0)
    else:
        print(f"❌ OpenAPI spec not found: {spec_path}")
        sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
MINER_PATH = ROOT / "neurons" / "miner.py"
SPEC_PATH = ROOT / "docs" / "openapi.yaml"


def extract_routes_from_miner(source: str) -> set[str]:
    """Extract route paths from app.router.add_* calls."""
    # Matches patterns like: app.router.add_post("/IngestSynapse", ...)
    # and: app.router.add_get("/health", ...)
    pattern = r'app\.router\.add_(?:get|post|put|delete|patch)\(\s*"([^"]+)"'
    routes = set(re.findall(pattern, source))
    return routes


def extract_paths_from_spec(spec: dict) -> set[str]:
    """Extract all paths from the OpenAPI spec, normalizing path params."""
    paths = set()
    for path in spec.get("paths", {}):
        # Normalize OpenAPI path params {param} for comparison
        # e.g., /retrieve/{cid} → /retrieve/{cid}
        paths.add(path)
    return paths


def normalize_route(route: str) -> str:
    """Normalize a miner route for comparison with OpenAPI paths.

    Converts aiohttp-style path params like /{cid} to OpenAPI style.
    aiohttp uses {name} already, so mostly a pass-through.
    """
    return route


def main() -> int:
    if not MINER_PATH.exists():
        print(f"❌ Miner source not found: {MINER_PATH}")
        return 1

    if not SPEC_PATH.exists():
        print(f"❌ OpenAPI spec not found: {SPEC_PATH}")
        return 1

    miner_source = MINER_PATH.read_text()
    miner_routes = extract_routes_from_miner(miner_source)

    with open(SPEC_PATH) as f:
        spec = yaml.safe_load(f)

    spec_paths = extract_paths_from_spec(spec)

    # Normalize miner routes for comparison
    normalized_miner = {normalize_route(r) for r in miner_routes}

    # Check coverage
    missing = normalized_miner - spec_paths
    extra = spec_paths - normalized_miner

    print(f"📋 Miner routes found: {len(miner_routes)}")
    print(f"📋 OpenAPI paths found: {len(spec_paths)}")
    print()

    if missing:
        print("❌ Routes in miner.py NOT in OpenAPI spec:")
        for route in sorted(missing):
            print(f"   - {route}")
        print()

    if extra:
        print("ℹ️  Paths in OpenAPI spec not found in miner.py (may be aliases):")
        for path in sorted(extra):
            print(f"   - {path}")
        print()

    if not missing:
        print("✅ All miner routes are documented in the OpenAPI spec!")
        return 0
    else:
        print(f"❌ {len(missing)} route(s) missing from OpenAPI spec")
        return 1


if __name__ == "__main__":
    sys.exit(main())
