"""Tests for generated miner OpenAPI metadata."""

import json
import subprocess
import sys
from pathlib import Path

from engram.miner.openapi import MINER_HTTP_ROUTES, build_openapi_spec


ROOT = Path(__file__).resolve().parents[1]


def test_route_registry_has_unique_method_path_pairs():
    pairs = [(route.method, route.path) for route in MINER_HTTP_ROUTES]
    assert len(pairs) == len(set(pairs))


def test_openapi_paths_match_route_registry():
    spec = build_openapi_spec()
    spec_pairs = {
        (method, path)
        for path, methods in spec["paths"].items()
        for method in methods
    }
    route_pairs = {(route.method, route.path) for route in MINER_HTTP_ROUTES}
    assert spec_pairs == route_pairs
    assert spec["x-engram-route-count"] == len(MINER_HTTP_ROUTES)


def test_openapi_documents_signed_body_auth():
    spec = build_openapi_spec()
    auth = spec["components"]["securitySchemes"]["Sr25519SignedBody"]
    assert "sr25519" in auth["description"]
    ingest_fields = spec["components"]["schemas"]["IngestRequest"]["properties"]
    assert {"hotkey", "nonce", "signature"}.issubset(ingest_fields)


def test_generated_openapi_file_is_current():
    expected = json.dumps(build_openapi_spec(), indent=2, sort_keys=True) + "\n"
    assert (ROOT / "docs" / "openapi.json").read_text(encoding="utf-8") == expected


def test_generate_openapi_check_mode_passes():
    result = subprocess.run(
        [sys.executable, "scripts/generate_openapi.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
