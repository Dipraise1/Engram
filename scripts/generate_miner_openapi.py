from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINER_PATH = ROOT / "neurons" / "miner.py"
PUBLIC_JSON_PATH = ROOT / "engram-web" / "public" / "openapi" / "miner.openapi.json"
SPEC_TS_PATH = ROOT / "engram-web" / "app" / "docs" / "openapi" / "spec.ts"


ROUTE_RE = re.compile(r'app\.router\.add_(?P<method>get|post|patch|delete)\("(?P<path>[^"]+)",\s*(?P<handler>\w+)\)')

ROUTE_META: dict[str, dict[str, str | None]] = {
    "handle_ingest": {
        "summary": "Ingest content",
        "description": "Embed and store a memory in the miner.",
        "auth": "signed-request",
        "request_schema": "SignedMinerRequest",
    },
    "handle_query": {
        "summary": "Query stored memories",
        "description": "Run semantic search over the miner's vector store.",
        "auth": "signed-request",
        "request_schema": "SignedMinerRequest",
    },
    "handle_challenge": {
        "summary": "Return a storage proof response",
        "description": "Return an HMAC-backed proof for a CID challenge.",
        "auth": "signed-request",
        "request_schema": "SignedMinerRequest",
    },
    "handle_namespace": {
        "summary": "Manage namespaces locally",
        "description": "Create, delete, rotate, or list namespaces from localhost only.",
        "auth": "localhost-only",
        "request_schema": "NamespaceActionRequest",
    },
    "handle_attest": {
        "summary": "Attest namespace ownership",
        "description": "Link a namespace to a Bittensor hotkey with a signed attestation.",
        "auth": "namespace-proof",
        "request_schema": "NamespaceAttestationRequest",
    },
    "handle_attestation_get": {
        "summary": "Fetch namespace attestation",
        "description": "Return trust metadata for a namespace.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_chat_history_get": {
        "summary": "Load chat history",
        "description": "Fetch a user's saved chat history.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_chat_history_post": {
        "summary": "Save chat history",
        "description": "Persist a user's chat history payload.",
        "auth": "public",
        "request_schema": "ChatHistoryRequest",
    },
    "handle_conversations_get": {
        "summary": "List conversations",
        "description": "Return all conversations for a given user.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_conversations_post": {
        "summary": "Create a conversation",
        "description": "Create a new conversation for a user.",
        "auth": "public",
        "request_schema": "ConversationCreateRequest",
    },
    "handle_conversations_patch": {
        "summary": "Rename a conversation",
        "description": "Rename an existing conversation.",
        "auth": "public",
        "request_schema": "ConversationRenameRequest",
    },
    "handle_conversations_delete": {
        "summary": "Delete a conversation",
        "description": "Delete a conversation by id.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_retrieve": {
        "summary": "Retrieve a stored memory",
        "description": "Fetch a stored memory by CID.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_delete": {
        "summary": "Delete a stored memory",
        "description": "Remove a stored memory; public memories require miner auth and private namespaces also require namespace ownership proof.",
        "auth": "signed-request",
        "request_schema": "SignedMinerRequest",
    },
    "handle_repair_retrieve": {
        "summary": "Return a repair payload",
        "description": "Return the full embedding for a CID so validators can repair replicas.",
        "auth": "signed-request",
        "request_schema": "SignedMinerRequest",
    },
    "handle_key_share_store": {
        "summary": "Store a namespace key share",
        "description": "Store one Shamir share for a namespace after ownership proof.",
        "auth": "namespace-proof",
        "request_schema": "NamespaceKeyShareStoreRequest",
    },
    "handle_key_share_retrieve": {
        "summary": "Fetch a namespace key share",
        "description": "Return the miner's stored share for a namespace after ownership proof.",
        "auth": "namespace-proof",
        "request_schema": "NamespaceOwnershipRequest",
    },
    "handle_list": {
        "summary": "List stored memories",
        "description": "Paginate and filter memories, with optional namespace ownership proof for private namespaces.",
        "auth": "public",
        "request_schema": "ListMemoriesRequest",
    },
    "handle_health": {
        "summary": "Health check",
        "description": "Minimal liveness endpoint.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_stats": {
        "summary": "Miner stats",
        "description": "Public dashboard stats for the miner.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_metagraph": {
        "summary": "Metagraph snapshot",
        "description": "Return a public neuron snapshot for the leaderboard.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_metrics": {
        "summary": "Prometheus metrics",
        "description": "Localhost-only Prometheus metrics endpoint.",
        "auth": "localhost-only",
        "request_schema": None,
    },
    "handle_wallet_stats": {
        "summary": "Wallet stats",
        "description": "Localhost-only wallet activity stats.",
        "auth": "localhost-only",
        "request_schema": None,
    },
    "handle_commitment": {
        "summary": "Memory commitment",
        "description": "Return the Merkle root for the miner's full memory corpus.",
        "auth": "public",
        "request_schema": None,
    },
    "handle_prove_memory": {
        "summary": "Merkle inclusion proof",
        "description": "Return a Merkle inclusion proof for one stored CID.",
        "auth": "public",
        "request_schema": "ProveMemoryRequest",
    },
}


def read_routes() -> list[dict[str, str]]:
    text = MINER_PATH.read_text(encoding="utf-8")
    routes: list[dict[str, str]] = []
    for match in ROUTE_RE.finditer(text):
        routes.append(match.groupdict())
    return routes


def python_literal(value: object) -> str:
    return repr(value).replace("True", "true").replace("False", "false").replace("None", "null")


def build_spec() -> dict[str, object]:
    paths: dict[str, dict[str, object]] = {}
    routes = read_routes()

    for route in routes:
        method = route["method"]
        path = route["path"]
        handler = route["handler"]
        meta = ROUTE_META.get(
            handler,
            {
                "summary": handler.replace("handle_", "").replace("_", " ").title(),
                "description": "Auto-generated from the miner route table.",
                "auth": "public",
                "request_schema": None,
            },
        )

        operation: dict[str, object] = {
            "operationId": handler,
            "summary": meta["summary"],
            "description": meta["description"],
            "tags": ["Miner"],
            "x-engram-auth": meta["auth"],
        }
        if meta["request_schema"]:
            operation["requestBody"] = {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": f"#/components/schemas/{meta['request_schema']}"}
                    }
                },
            }

        if path not in paths:
            paths[path] = {}
        paths[path][method] = operation

    components = {
        "schemas": {
            "SignedMinerRequest": {
                "type": "object",
                "description": "sr25519 signed request body used by miner auth. Canonical message: \"{nonce}:{endpoint}:{sha256(payload)}\".",
                "properties": {
                    "hotkey": {"type": "string", "description": "SS58 address of the signing hotkey"},
                    "nonce": {"type": "integer", "format": "int64", "description": "Unix ms nonce for replay protection"},
                    "signature": {"type": "string", "description": "Hex sr25519 signature over the canonical message"},
                },
                "required": ["hotkey", "nonce", "signature"],
                "additionalProperties": True,
            },
            "NamespaceOwnershipRequest": {
                "type": "object",
                "description": "Ownership proof for namespace-scoped read/write operations.",
                "properties": {
                    "namespace": {"type": "string"},
                    "namespace_hotkey": {"type": "string"},
                    "namespace_sig": {"type": "string"},
                    "namespace_timestamp_ms": {"type": "integer", "format": "int64"},
                },
                "required": ["namespace", "namespace_hotkey", "namespace_sig", "namespace_timestamp_ms"],
                "additionalProperties": True,
            },
            "NamespaceAttestationRequest": {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string"},
                    "owner_hotkey": {"type": "string"},
                    "signature": {"type": "string"},
                    "timestamp_ms": {"type": "integer", "format": "int64"},
                },
                "required": ["namespace", "owner_hotkey", "signature", "timestamp_ms"],
                "additionalProperties": True,
            },
            "NamespaceActionRequest": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["create", "delete", "rotate", "list"]},
                    "namespace": {"type": "string"},
                    "key": {"type": "string"},
                    "new_key": {"type": "string"},
                },
                "required": ["action", "namespace"],
                "additionalProperties": True,
            },
            "NamespaceKeyShareStoreRequest": {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string"},
                    "namespace_hotkey": {"type": "string"},
                    "namespace_sig": {"type": "string"},
                    "namespace_timestamp_ms": {"type": "integer", "format": "int64"},
                    "share_index": {"type": "integer"},
                    "share_hex": {"type": "string"},
                    "threshold": {"type": "integer"},
                    "total": {"type": "integer"},
                },
                "required": ["namespace", "namespace_hotkey", "namespace_sig", "namespace_timestamp_ms", "share_index", "share_hex", "threshold", "total"],
                "additionalProperties": True,
            },
            "ChatHistoryRequest": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "conv_id": {"type": "string"},
                    "messages": {"type": "array", "items": {"type": "object"}},
                },
                "required": ["user_id"],
                "additionalProperties": True,
            },
            "ConversationCreateRequest": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "conv_id": {"type": "string"},
                    "title": {"type": "string"},
                },
                "required": ["user_id", "conv_id"],
                "additionalProperties": True,
            },
            "ConversationRenameRequest": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "title": {"type": "string"},
                },
                "required": ["user_id", "title"],
                "additionalProperties": True,
            },
            "ListMemoriesRequest": {
                "type": "object",
                "properties": {
                    "filter": {"type": "object", "additionalProperties": {"type": "string"}},
                    "limit": {"type": "integer"},
                    "offset": {"type": "integer"},
                    "namespace": {"type": "string"},
                    "namespace_hotkey": {"type": "string"},
                    "namespace_sig": {"type": "string"},
                    "namespace_timestamp_ms": {"type": "integer", "format": "int64"},
                },
                "additionalProperties": True,
            },
            "ProveMemoryRequest": {
                "type": "object",
                "properties": {
                    "cid": {"type": "string"},
                    "embedding_hash": {"type": "string"},
                },
                "required": ["cid", "embedding_hash"],
                "additionalProperties": False,
            },
        }
    }

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Engram Miner HTTP API",
            "version": "0.1.0",
            "description": "Auto-generated from `neurons/miner.py`. Includes route coverage, auth notes, and namespace proof bodies.",
        },
        "servers": [{"url": "http://127.0.0.1:8091", "description": "Local miner"}],
        "tags": [{"name": "Miner", "description": "Engram miner endpoints"}],
        "paths": paths,
        "components": components,
    }


def render_ts(spec: dict[str, object]) -> str:
    return (
        "// Generated by scripts/generate_miner_openapi.py. Do not edit by hand.\n"
        "export const minerOpenApi = "
        + json.dumps(spec, indent=2)
        + " as const;\n"
    )


def write_outputs(spec: dict[str, object]) -> None:
    PUBLIC_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    SPEC_TS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_JSON_PATH.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    SPEC_TS_PATH.write_text(render_ts(spec), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Validate that generated files are up to date")
    args = parser.parse_args()

    spec = build_spec()
    ts_text = render_ts(spec)
    json_text = json.dumps(spec, indent=2) + "\n"

    if args.check:
        json_ok = PUBLIC_JSON_PATH.exists() and PUBLIC_JSON_PATH.read_text(encoding="utf-8") == json_text
        ts_ok = SPEC_TS_PATH.exists() and SPEC_TS_PATH.read_text(encoding="utf-8") == ts_text
        if not (json_ok and ts_ok):
            raise SystemExit("OpenAPI outputs are out of date. Run scripts/generate_miner_openapi.py.")
        print("OpenAPI outputs are up to date.")
        return 0

    write_outputs(spec)
    print(f"Wrote {PUBLIC_JSON_PATH.relative_to(ROOT)}")
    print(f"Wrote {SPEC_TS_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
