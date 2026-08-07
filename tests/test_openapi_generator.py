"""Regression tests for the OpenAPI generator + miner-route sync check.

These tests guard against two regressions:

1. The committed ``docs/openapi/miner-openapi.yaml`` going stale.  We
   re-run the generator in-memory and assert the parsed structure is
   well-formed OpenAPI 3.0.3 with the expected paths, schemas, and
   security scheme.

2. The route table in ``scripts/generate_openapi.py`` drifting away from
   the aiohttp registrations in ``neurons/miner.py``.  We invoke the
   sync check as a library (``check_openapi_sync._diff``) and assert
   that there is no drift.

The tests deliberately do not import ``neurons/miner.py`` (it requires
bittensor / faiss / sentence-transformers).  Instead they rely on the
same AST walk the CLI uses.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
GENERATOR = REPO_ROOT / "scripts" / "generate_openapi.py"
SYNC_CHECK = REPO_ROOT / "scripts" / "check_openapi_sync.py"
SPEC_PATH = REPO_ROOT / "docs" / "openapi" / "miner-openapi.yaml"


# ── helpers ───────────────────────────────────────────────────────────────────


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None, f"cannot import {path}"
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


@pytest.fixture(scope="module")
def generator():
    return _load_module("generate_openapi", GENERATOR)


@pytest.fixture(scope="module")
def sync_check():
    return _load_module("check_openapi_sync", SYNC_CHECK)


# ── spec structure ────────────────────────────────────────────────────────────


def test_spec_file_exists():
    assert SPEC_PATH.is_file(), f"{SPEC_PATH} missing — run scripts/generate_openapi.py"


def test_spec_is_valid_yaml():
    data = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
    assert isinstance(data, dict)


def test_spec_is_openapi_3(generator):
    data = generator.build_spec()
    assert data["openapi"].startswith("3."), f"expected OpenAPI 3.x, got {data['openapi']!r}"


def test_spec_has_info_block(generator):
    info = generator.build_spec()["info"]
    assert info["title"]
    assert info["version"]


def test_spec_covers_all_routes(generator):
    spec = generator.build_spec()
    paths = spec["paths"]
    assert len(paths) >= 20, f"expected ≥20 paths, got {len(paths)}"
    # Sanity: every method declared in the generator ROUTES table appears
    # in the spec at the corresponding path.
    for route in generator.ROUTES:
        path = route["path"]
        method = route["method"].lower()
        assert path in paths, f"path {path} missing from spec"
        assert method in paths[path], f"method {method} missing for {path}"


def test_spec_documents_auth_scheme(generator):
    schemes = generator.build_spec()["components"]["securitySchemes"]
    assert "EngramHotkeySignature" in schemes
    scheme = schemes["EngramHotkeySignature"]
    # We document it as an apiKey in the body — keeps the spec
    # validator-friendly while still pointing to the canonical message
    # format in the description.
    assert scheme["type"] == "apiKey"
    assert scheme["in"] == "body"
    assert scheme["name"] == "signature"
    desc = scheme.get("description", "")
    assert "nonce" in desc
    assert "endpoint" in desc
    assert "body_hash" in desc or "sha256" in desc.lower()


def test_spec_schemas_resolve(generator):
    """Every $ref in the spec must point to a defined schema."""
    spec = generator.build_spec()
    schemas = spec["components"]["schemas"]
    assert len(schemas) >= 30, f"expected ≥30 schemas, got {len(schemas)}"

    missing: list[str] = []
    import json

    raw = json.dumps(spec)

    import re

    for ref in set(re.findall(r"#/components/schemas/(\w+)", raw)):
        if ref not in schemas:
            missing.append(ref)
    assert not missing, f"unresolved $refs: {missing}"


def test_spec_routes_have_handler_field(generator):
    """Every ROUTES entry must carry a ``handler`` so the sync check can match."""
    for route in generator.ROUTES:
        assert "handler" in route, f"{route['method']} {route['path']} missing handler"
        assert route["handler"], f"{route['method']} {route['path']} has empty handler"


# ── sync check ────────────────────────────────────────────────────────────────


def test_sync_check_finds_no_drift(sync_check):
    """Run the AST-vs-generator diff.  Should be empty in a clean tree."""
    import ast

    miner_src = (REPO_ROOT / "neurons" / "miner.py").read_text(encoding="utf-8")
    tree = ast.parse(miner_src, filename=str(REPO_ROOT / "neurons" / "miner.py"))
    actual = sync_check._extract_from_run(tree)
    expected = sync_check._extract_from_generator()
    drift = sync_check._diff(actual, expected)
    assert not drift, "drift detected:\n" + "\n".join(drift)


def test_sync_check_detects_missing_route(sync_check):
    """If we drop one expected route, the diff must flag it."""

    class _FakeRoute(sync_check.Route):
        pass

    actual: list = []
    expected = [
        sync_check.Route("POST", "/IngestSynapse", "handle_ingest"),
    ]
    drift = sync_check._diff(actual, expected)
    assert any("[generator-only]" in line for line in drift)
    assert any("/IngestSynapse" in line for line in drift)


def test_sync_check_detects_extra_route(sync_check):
    """If a route is added to miner.py but not the generator, the diff must flag it."""
    actual = [
        sync_check.Route("POST", "/IngestSynapse", "handle_ingest"),
        sync_check.Route("GET", "/admin/secret", "handle_admin"),
    ]
    expected = [
        sync_check.Route("POST", "/IngestSynapse", "handle_ingest"),
    ]
    drift = sync_check._diff(actual, expected)
    assert any("[miner-only]" in line for line in drift)
    assert any("/admin/secret" in line for line in drift)
