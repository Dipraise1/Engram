from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "generate_miner_openapi.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("generate_miner_openapi", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_openapi_routes_cover_miner_surface():
    mod = load_generator()
    spec = mod.build_spec()
    paths = spec["paths"]

    assert len(paths) >= 20
    assert "/IngestSynapse" in paths
    assert "/QuerySynapse" in paths
    assert "/ChallengeSynapse" in paths
    assert "/AttestNamespace" in paths
    assert "/metrics" in paths
    assert "/openapi" not in paths

    assert paths["/IngestSynapse"]["post"]["x-engram-auth"] == "signed-request"
    assert paths["/metrics"]["get"]["x-engram-auth"] == "localhost-only"
    assert paths["/AttestNamespace"]["post"]["x-engram-auth"] == "namespace-proof"


def test_generated_ts_and_json_are_in_sync():
    mod = load_generator()
    spec = mod.build_spec()
    ts_text = mod.render_ts(spec)
    json_text = Path(mod.PUBLIC_JSON_PATH).read_text(encoding="utf-8")
    ts_file_text = Path(mod.SPEC_TS_PATH).read_text(encoding="utf-8")

    assert json_text.strip().startswith("{")
    assert "minerOpenApi" in ts_text
    assert "Miner HTTP API" in ts_file_text
