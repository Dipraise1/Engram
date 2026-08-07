#!/usr/bin/env python3
"""Generate the miner OpenAPI spec from the aiohttp route table.

The miner runtime imports Bittensor, FAISS, and other node dependencies, so this
script intentionally does not import ``neurons.miner``. It statically reads the
``app.router.add_*`` calls and overlays endpoint metadata that is stable enough
for SDKs and rendered docs.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MINER_PATH = ROOT / "neurons" / "miner.py"
DEFAULT_OUTPUT = ROOT / "docs" / "miner-openapi.json"

ROUTE_RE = re.compile(r'app\.router\.add_(?P<method>\w+)\("(?P<path>[^"]+)"')


SIGNED_BODY_FIELDS: dict[str, Any] = {
    "hotkey": {"type": "string", "description": "Optional Bittensor SS58 hotkey."},
    "nonce": {"type": "integer", "description": "Unix timestamp in milliseconds."},
    "signature": {
        "type": "string",
        "description": "sr25519 signature over nonce:endpoint:sha256(canonical body).",
    },
}

NAMESPACE_AUTH_FIELDS: dict[str, Any] = {
    "namespace_hotkey": {"type": "string"},
    "namespace_sig": {
        "type": "string",
        "description": "sr25519 signature over engram-ns:{namespace}:{namespace_timestamp_ms}.",
    },
    "namespace_timestamp_ms": {"type": "integer"},
}


def _json_body(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": properties,
                    "required": required or [],
                    "additionalProperties": True,
                }
            }
        },
    }


def _json_response(properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "description": "JSON response",
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": properties,
                    "additionalProperties": True,
                }
            }
        },
    }


def extract_routes(source: Path = MINER_PATH) -> list[tuple[str, str]]:
    """Return ``[(METHOD, /path), ...]`` from ``neurons/miner.py``."""
    routes: list[tuple[str, str]] = []
    for match in ROUTE_RE.finditer(source.read_text(encoding="utf-8")):
        method = match.group("method").upper()
        path = match.group("path")
        routes.append((method, path))
    return routes


def route_metadata() -> dict[tuple[str, str], dict[str, Any]]:
    signed = {
        **SIGNED_BODY_FIELDS,
        "endpoint": {
            "type": "string",
            "description": "Logical endpoint name used when signing; implied by the route.",
        },
    }
    cid = {"type": "string", "description": "Content identifier."}
    error = {"type": "string", "nullable": True}

    return {
        ("POST", "/IngestSynapse"): {
            "summary": "Store text or a raw embedding on this miner.",
            "tags": ["synapses"],
            "requestBody": _json_body(
                {
                    "text": {"type": "string", "nullable": True},
                    "raw_embedding": {"type": "array", "items": {"type": "number"}, "nullable": True},
                    "metadata": {"type": "object", "additionalProperties": True},
                    "model_version": {"type": "string", "default": "v1"},
                    "namespace": {"type": "string", "nullable": True},
                    "namespace_key": {"type": "string", "nullable": True, "deprecated": True},
                    **NAMESPACE_AUTH_FIELDS,
                    **signed,
                }
            ),
            "responses": {"200": _json_response({"cid": cid, "error": error})},
        },
        ("POST", "/QuerySynapse"): {
            "summary": "Query this miner for nearest stored memories.",
            "tags": ["synapses"],
            "requestBody": _json_body(
                {
                    "query_text": {"type": "string", "nullable": True},
                    "query_vector": {"type": "array", "items": {"type": "number"}, "nullable": True},
                    "top_k": {"type": "integer", "minimum": 1, "maximum": 100, "default": 10},
                    "namespace": {"type": "string", "nullable": True},
                    "filter": {"type": "object", "additionalProperties": True},
                    "namespace_key": {"type": "string", "nullable": True, "deprecated": True},
                    **NAMESPACE_AUTH_FIELDS,
                    **signed,
                }
            ),
            "responses": {
                "200": _json_response(
                    {
                        "results": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
                        "latency_ms": {"type": "number", "nullable": True},
                        "error": error,
                    }
                )
            },
        },
        ("POST", "/ChallengeSynapse"): {
            "summary": "Return a storage proof for a validator challenge.",
            "tags": ["synapses"],
            "requestBody": _json_body(
                {
                    "cid": cid,
                    "nonce_hex": {"type": "string"},
                    "expires_at": {"type": "integer"},
                    "validator_hotkey_hex": {"type": "string"},
                    **signed,
                },
                ["cid", "nonce_hex", "expires_at"],
            ),
            "responses": {
                "200": _json_response(
                    {"embedding_hash": {"type": "string"}, "proof": {"type": "string"}, "error": error}
                )
            },
        },
        ("POST", "/namespace"): {
            "summary": "Create or register a namespace owner.",
            "tags": ["namespaces"],
            "requestBody": _json_body({"namespace": {"type": "string"}, **NAMESPACE_AUTH_FIELDS}),
            "responses": {"200": _json_response({"namespace": {"type": "string"}, "registered": {"type": "boolean"}})},
        },
        ("POST", "/AttestNamespace"): {
            "summary": "Attest a namespace to a Bittensor hotkey.",
            "tags": ["namespaces"],
            "requestBody": _json_body(
                {
                    "namespace": {"type": "string"},
                    "owner_hotkey": {"type": "string"},
                    "signature": {"type": "string"},
                    "timestamp_ms": {"type": "integer"},
                },
                ["namespace", "owner_hotkey", "signature", "timestamp_ms"],
            ),
            "responses": {"200": _json_response({"attested": {"type": "boolean"}, "error": error})},
        },
        ("GET", "/attestation/{namespace}"): {
            "summary": "Return namespace attestation details.",
            "tags": ["namespaces"],
            "responses": {"200": _json_response({"namespace": {"type": "string"}, "owner_hotkey": {"type": "string"}})},
        },
        ("GET", "/chat-history/{user_id}"): {
            "summary": "List chat history for a user.",
            "tags": ["chat"],
            "responses": {"200": _json_response({"messages": {"type": "array", "items": {"type": "object"}}})},
        },
        ("POST", "/chat-history"): {
            "summary": "Append a chat history item.",
            "tags": ["chat"],
            "requestBody": _json_body({"user_id": {"type": "string"}, "message": {"type": "object"}}),
            "responses": {"200": _json_response({"stored": {"type": "boolean"}})},
        },
        ("GET", "/conversations/{user_id}"): {
            "summary": "List conversations for a user.",
            "tags": ["chat"],
            "responses": {"200": _json_response({"conversations": {"type": "array", "items": {"type": "object"}}})},
        },
        ("POST", "/conversations"): {
            "summary": "Create a conversation.",
            "tags": ["chat"],
            "requestBody": _json_body({"user_id": {"type": "string"}, "title": {"type": "string"}}),
            "responses": {"200": _json_response({"conversation": {"type": "object"}})},
        },
        ("PATCH", "/conversations/{conv_id}"): {
            "summary": "Update conversation metadata.",
            "tags": ["chat"],
            "requestBody": _json_body({"title": {"type": "string"}, "metadata": {"type": "object"}}),
            "responses": {"200": _json_response({"conversation": {"type": "object"}})},
        },
        ("DELETE", "/conversations/{conv_id}"): {
            "summary": "Delete a conversation.",
            "tags": ["chat"],
            "responses": {"200": _json_response({"deleted": {"type": "boolean"}})},
        },
        ("GET", "/retrieve/{cid}"): {
            "summary": "Return public metadata for a stored CID.",
            "tags": ["memory"],
            "responses": {"200": _json_response({"cid": cid, "metadata": {"type": "object"}})},
        },
        ("DELETE", "/retrieve/{cid}"): {
            "summary": "Delete a stored CID.",
            "tags": ["memory"],
            "requestBody": _json_body({**NAMESPACE_AUTH_FIELDS, **signed}),
            "responses": {"200": _json_response({"deleted": {"type": "boolean"}, "cid": cid})},
        },
        ("POST", "/RepairSynapse"): {
            "summary": "Return a public embedding for validator repair replication.",
            "tags": ["synapses"],
            "requestBody": _json_body({"cid": cid, **signed}, ["cid"]),
            "responses": {
                "200": _json_response(
                    {"cid": cid, "embedding": {"type": "array", "items": {"type": "number"}}, "metadata": {"type": "object"}}
                )
            },
        },
        ("POST", "/KeyShareSynapse"): {
            "summary": "Store one Shamir key share for a namespace.",
            "tags": ["key shares"],
            "requestBody": _json_body(
                {
                    "namespace": {"type": "string"},
                    "share_index": {"type": "integer"},
                    "share_hex": {"type": "string"},
                    "threshold": {"type": "integer"},
                    "total": {"type": "integer"},
                    **NAMESPACE_AUTH_FIELDS,
                },
                ["namespace", "share_index", "share_hex", "threshold", "total"],
            ),
            "responses": {"200": _json_response({"stored": {"type": "boolean"}, "error": error})},
        },
        ("POST", "/KeyShareRetrieve"): {
            "summary": "Retrieve this miner's key share for a namespace.",
            "tags": ["key shares"],
            "requestBody": _json_body({"namespace": {"type": "string"}, **NAMESPACE_AUTH_FIELDS}, ["namespace"]),
            "responses": {
                "200": _json_response(
                    {
                        "share_index": {"type": "integer"},
                        "share_hex": {"type": "string"},
                        "threshold": {"type": "integer"},
                        "total": {"type": "integer"},
                        "error": error,
                    }
                )
            },
        },
        ("POST", "/list"): {
            "summary": "List stored memories with pagination and optional namespace filter.",
            "tags": ["memory"],
            "requestBody": _json_body(
                {
                    "filter": {"type": "object", "additionalProperties": True},
                    "limit": {"type": "integer", "default": 50, "maximum": 200},
                    "offset": {"type": "integer", "default": 0},
                    "namespace": {"type": "string", "default": "__public__"},
                    **NAMESPACE_AUTH_FIELDS,
                }
            ),
            "responses": {"200": _json_response({"items": {"type": "array", "items": {"type": "object"}}})},
        },
        ("GET", "/health"): {"summary": "Miner health check.", "tags": ["status"], "responses": {"200": _json_response({"ok": {"type": "boolean"}})}},
        ("GET", "/stats"): {"summary": "Miner runtime statistics.", "tags": ["status"], "responses": {"200": _json_response({"vectors": {"type": "integer"}})}},
        ("GET", "/metagraph"): {"summary": "Return cached subnet metagraph data.", "tags": ["status"], "responses": {"200": _json_response({"neurons": {"type": "array", "items": {"type": "object"}}})}},
        ("GET", "/metrics"): {"summary": "Prometheus metrics text endpoint.", "tags": ["status"], "responses": {"200": {"description": "Prometheus text exposition."}}},
        ("GET", "/wallet-stats"): {"summary": "List per-hotkey wallet activity.", "tags": ["wallets"], "responses": {"200": _json_response({"wallets": {"type": "array", "items": {"type": "object"}}})}},
        ("GET", "/wallet-stats/{hotkey}"): {"summary": "Return activity for one hotkey.", "tags": ["wallets"], "responses": {"200": _json_response({"hotkey": {"type": "string"}})}},
        ("GET", "/commitment"): {"summary": "Return miner Merkle commitment.", "tags": ["proofs"], "responses": {"200": _json_response({"root": {"type": "string"}})}},
        ("POST", "/prove-memory"): {"summary": "Return a proof for a stored memory.", "tags": ["proofs"], "requestBody": _json_body({"cid": cid}, ["cid"]), "responses": {"200": _json_response({"proof": {"type": "object"}, "error": error})}},
    }


def _openapi_path(path: str) -> str:
    return path


def build_spec() -> dict[str, Any]:
    routes = extract_routes()
    meta = route_metadata()
    paths: dict[str, Any] = {}

    for method, path in routes:
        operation = meta.get((method, path), {}).copy()
        if not operation:
            operation = {
                "summary": f"{method} {path}",
                "tags": ["miner"],
                "responses": {"200": _json_response({"error": {"type": "string", "nullable": True}})},
            }
        operation.setdefault("operationId", f"{method.lower()}_{path.strip('/').replace('/', '_').replace('{', '').replace('}', '') or 'root'}")
        operation.setdefault("responses", {"200": {"description": "Success"}})
        paths.setdefault(_openapi_path(path), {})[method.lower()] = operation

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Engram Miner HTTP API",
            "version": "0.1.0",
            "description": (
                "Machine-readable API contract for neurons/miner.py. Signed miner requests "
                "use hotkey, nonce, and signature fields in the JSON body. Namespace-scoped "
                "requests use namespace_hotkey, namespace_sig, and namespace_timestamp_ms."
            ),
        },
        "servers": [{"url": "http://localhost:8091", "description": "Local miner"}],
        "tags": [
            {"name": "synapses"},
            {"name": "memory"},
            {"name": "namespaces"},
            {"name": "key shares"},
            {"name": "proofs"},
            {"name": "chat"},
            {"name": "wallets"},
            {"name": "status"},
        ],
        "components": {
            "securitySchemes": {
                "SignedBody": {
                    "type": "apiKey",
                    "in": "query",
                    "name": "hotkey/nonce/signature",
                    "description": "Logical scheme: sr25519 signature fields are sent in JSON request bodies.",
                },
                "NamespaceSignature": {
                    "type": "apiKey",
                    "in": "query",
                    "name": "namespace_hotkey/namespace_sig/namespace_timestamp_ms",
                    "description": "Logical scheme: namespace ownership proof fields are sent in JSON request bodies.",
                },
            }
        },
        "paths": paths,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Fail if the output file is stale.")
    args = parser.parse_args()

    rendered = json.dumps(build_spec(), indent=2, sort_keys=True) + "\n"
    if args.check:
        current = args.output.read_text(encoding="utf-8")
        if current != rendered:
            raise SystemExit(f"{args.output} is stale; run scripts/generate_miner_openapi.py")
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
