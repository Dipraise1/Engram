import json

from scripts.generate_miner_openapi import build_spec, extract_routes


def test_miner_openapi_paths_match_aiohttp_routes() -> None:
    spec = build_spec()
    spec_routes = {
        (method.upper(), path)
        for path, methods in spec["paths"].items()
        for method in methods
    }

    assert spec_routes == set(extract_routes())


def test_checked_in_miner_openapi_is_current() -> None:
    with open("docs/miner-openapi.json", encoding="utf-8") as fh:
        checked_in = json.load(fh)

    assert checked_in == build_spec()
    assert "SignedBody" in checked_in["components"]["securitySchemes"]
    assert "NamespaceSignature" in checked_in["components"]["securitySchemes"]
