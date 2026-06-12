"""
Engram Miner — OpenAPI 3.0.3 spec generator

Generates ``docs/openapi/miner-openapi.yaml`` from a Python-defined route table
that mirrors the aiohttp registrations in ``neurons/miner.py``.

Why Python instead of introspection?
------------------------------------
* The aiohttp ``web.Application`` is built inside ``run()``; lifting the
  registrations to module scope just to scrape them would tightly couple the
  generator to miner.py's runtime, and break the SDK/dev installs that lack
  ``bittensor`` / ``faiss``.
* Hand-rolled introspection also breaks when the miner file is wrapped in a
  closure (``run()`` is a function local class).

The compromise used here: keep the route table as a plain list of
``(method, path, handler_name, summary)`` tuples *adjacent to* the aiohttp
registrations and check it in CI.  This generator is the single source of
truth for request/response schemas; ``scripts/check_openapi_sync.py`` is the
single source of truth for verifying that every aiohttp route has a matching
spec entry.

Run::

    python scripts/generate_openapi.py            # writes docs/openapi/miner-openapi.yaml
    python scripts/generate_openapi.py --check    # exits non-zero if file is out of date
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover - dev-only tool
    raise SystemExit(
        "PyYAML is required: pip install pyyaml"
    ) from exc


# ── Route table (mirror of neurons/miner.py) ──────────────────────────────────
# Each entry: (METHOD, path, handler, summary, tags, request_schema, response_schema, path_params)
# Schemas are referenced by name from COMPONENTS below.

ROUTES: list[dict[str, Any]] = [
    # ── Core Synapse API (Bittensor protocol) ─────────────────────────────────
    {
        "method": "POST",
        "path": "/IngestSynapse",
        "handler": "handle_ingest",
        "summary": "Store an embedding and return its CID",
        "description": (
            "Sent by validators/clients to persist either raw text (the miner "
            "embeds it) or a pre-computed embedding vector. Returns a content "
            "identifier that can be used for retrieval and Merkle inclusion proofs."
        ),
        "tags": ["Synapses"],
        "request": "IngestRequest",
        "responses": {"200": "IngestResponse", "401": "Error", "429": "Error"},
        "auth": "network",
    },
    {
        "method": "POST",
        "path": "/QuerySynapse",
        "handler": "handle_query",
        "summary": "Approximate nearest-neighbour search",
        "description": (
            "Returns the top-K most similar stored memories. Supports metadata "
            "filtering post-ANN and namespace-based access control."
        ),
        "tags": ["Synapses"],
        "request": "QueryRequest",
        "responses": {"200": "QueryResponse", "401": "Error", "429": "Error"},
        "auth": "network",
    },
    {
        "method": "POST",
        "path": "/ChallengeSynapse",
        "handler": "handle_challenge",
        "summary": "Storage-proof challenge response",
        "description": (
            "Validator-issued storage proof. The miner returns HMAC-SHA256 of "
            "the stored embedding hash bound to the validator's nonce."
        ),
        "tags": ["Synapses"],
        "request": "ChallengeRequest",
        "responses": {
            "200": "ChallengeResponse",
            "400": "Error",
            "401": "Error",
            "404": "Error",
            "429": "Error",
        },
        "auth": "network",
    },
    {
        "method": "POST",
        "path": "/RepairSynapse",
        "handler": "handle_repair_retrieve",
        "summary": "Return full embedding for under-replicated CIDs",
        "description": (
            "Validators call this to copy the raw embedding bytes to other "
            "miners when replication falls below the configured factor. Requires "
            "network auth (registered validator/miner hotkey)."
        ),
        "tags": ["Synapses"],
        "request": "RepairRequest",
        "responses": {"200": "RepairResponse", "400": "Error", "401": "Error", "404": "Error"},
        "auth": "network",
    },
    # ── Direct retrieval / deletion ───────────────────────────────────────────
    {
        "method": "GET",
        "path": "/retrieve/{cid}",
        "handler": "handle_retrieve",
        "summary": "Read public metadata for a CID",
        "description": (
            "Returns the stored metadata for a CID. **Private namespace records "
            "return 404** even when the CID exists — clients must use an "
            "authenticated Query to access private data."
        ),
        "tags": ["Retrieval"],
        "path_params": {"cid": {"schema": {"type": "string"}, "description": "Content identifier returned by /IngestSynapse"}},
        "responses": {"200": "RetrieveResponse", "400": "Error", "404": "Error"},
        "auth": "none",
    },
    {
        "method": "DELETE",
        "path": "/retrieve/{cid}",
        "handler": "handle_delete",
        "summary": "Permanently remove a stored memory",
        "description": (
            "Public memories require a registered hotkey signature. Private "
            "namespace memories additionally require namespace_hotkey + "
            "namespace_sig + namespace_timestamp_ms in the request body."
        ),
        "tags": ["Retrieval"],
        "path_params": {"cid": {"schema": {"type": "string"}}},
        "request": "DeleteRequest",
        "responses": {
            "200": "DeleteResponse",
            "400": "Error",
            "401": "Error",
            "403": "Error",
            "404": "Error",
        },
        "auth": "network+namespace",
    },
    {
        "method": "POST",
        "path": "/list",
        "handler": "handle_list",
        "summary": "Paginate and filter stored memories",
        "description": (
            "Lists stored records with optional metadata filters. Private "
            "namespaces require ownership proof (namespace_sig)."
        ),
        "tags": ["Retrieval"],
        "request": "ListRequest",
        "responses": {"200": "ListResponse", "400": "Error", "403": "Error", "404": "Error"},
        "auth": "optional+namespace",
    },
    # ── Storage proofs (Merkle) ───────────────────────────────────────────────
    {
        "method": "GET",
        "path": "/commitment",
        "handler": "handle_commitment",
        "summary": "Merkle root of the miner's full memory corpus",
        "description": (
            "Returns the cached Merkle root over all stored CIDs. Updated on "
            "ingest/delete and lazily rebuilt every 50 ingests."
        ),
        "tags": ["Proofs"],
        "responses": {"200": "CommitmentResponse"},
        "auth": "none",
    },
    {
        "method": "POST",
        "path": "/prove-memory",
        "handler": "handle_prove_memory",
        "summary": "Generate a Merkle inclusion proof for a single CID",
        "description": (
            "Returns a proof object verifiable offline with "
            "``engram_core.verify_inclusion()``."
        ),
        "tags": ["Proofs"],
        "request": "ProveMemoryRequest",
        "responses": {
            "200": "ProveMemoryResponse",
            "400": "Error",
            "404": "Error",
            "500": "Error",
        },
        "auth": "none",
    },
    # ── Namespaces ────────────────────────────────────────────────────────────
    {
        "method": "POST",
        "path": "/namespace",
        "handler": "handle_namespace",
        "summary": "Manage namespaces (localhost only)",
        "description": (
            "Create / delete / rotate / list namespaces. Restricted to "
            "loopback callers (127.0.0.1 / ::1) — this is an operator endpoint."
        ),
        "tags": ["Namespaces"],
        "request": "NamespaceManageRequest",
        "responses": {
            "200": "NamespaceManageResponse",
            "400": "Error",
            "403": "Error",
            "500": "Error",
        },
        "auth": "loopback",
    },
    {
        "method": "POST",
        "path": "/AttestNamespace",
        "handler": "handle_attest",
        "summary": "Attest a namespace to a Bittensor hotkey",
        "description": (
            "Anyone can call this; the Bittensor stake of ``owner_hotkey`` "
            "determines the resulting trust tier (SOVEREIGN/VERIFIED/COMMUNITY)."
        ),
        "tags": ["Namespaces"],
        "request": "AttestRequest",
        "responses": {"200": "AttestResponse", "400": "Error"},
        "auth": "none",
    },
    {
        "method": "GET",
        "path": "/attestation/{namespace}",
        "handler": "handle_attestation_get",
        "summary": "Read trust info for a namespace",
        "tags": ["Namespaces"],
        "path_params": {"namespace": {"schema": {"type": "string"}}},
        "responses": {"200": "AttestationGetResponse"},
        "auth": "none",
    },
    # ── Key share distribution (Shamir) ───────────────────────────────────────
    {
        "method": "POST",
        "path": "/KeyShareSynapse",
        "handler": "handle_key_share_store",
        "summary": "Deposit a Shamir key share",
        "description": (
            "Stores one share of a (k, n) Shamir split for a namespace. The "
            "miner cannot reconstruct the full key alone — K of N miners must "
            "cooperate at retrieval time."
        ),
        "tags": ["KeyShares"],
        "request": "KeyShareStoreRequest",
        "responses": {
            "200": "KeyShareStoreResponse",
            "400": "Error",
            "401": "Error",
            "403": "Error",
        },
        "auth": "namespace",
    },
    {
        "method": "POST",
        "path": "/KeyShareRetrieve",
        "handler": "handle_key_share_retrieve",
        "summary": "Retrieve this miner's Shamir key share",
        "description": (
            "Returns the single share stored here. The client must collect K "
            "shares from K different miners to reconstruct the key locally."
        ),
        "tags": ["KeyShares"],
        "request": "KeyShareRetrieveRequest",
        "responses": {
            "200": "KeyShareRetrieveResponse",
            "400": "Error",
            "401": "Error",
            "403": "Error",
            "404": "Error",
        },
        "auth": "namespace",
    },
    # ── Chat history / conversations ─────────────────────────────────────────
    {
        "method": "GET",
        "path": "/chat-history/{user_id}",
        "handler": "handle_chat_history_get",
        "summary": "Load a user's chat history",
        "tags": ["Chat"],
        "path_params": {"user_id": {"schema": {"type": "string", "maxLength": 128}}},
        "responses": {"200": "ChatHistoryGetResponse", "400": "Error"},
        "auth": "none",
    },
    {
        "method": "POST",
        "path": "/chat-history",
        "handler": "handle_chat_history_post",
        "summary": "Save a user's chat history",
        "tags": ["Chat"],
        "request": "ChatHistoryPostRequest",
        "responses": {"200": "ChatHistoryPostResponse", "400": "Error", "500": "Error"},
        "auth": "none",
    },
    {
        "method": "GET",
        "path": "/conversations/{user_id}",
        "handler": "handle_conversations_get",
        "summary": "List a user's conversations",
        "tags": ["Chat"],
        "path_params": {"user_id": {"schema": {"type": "string", "maxLength": 128}}},
        "responses": {"200": "ConversationsGetResponse", "400": "Error"},
        "auth": "none",
    },
    {
        "method": "POST",
        "path": "/conversations",
        "handler": "handle_conversations_post",
        "summary": "Create a new conversation",
        "tags": ["Chat"],
        "request": "ConversationsPostRequest",
        "responses": {"200": "OkResponse", "400": "Error", "500": "Error"},
        "auth": "none",
    },
    {
        "method": "PATCH",
        "path": "/conversations/{conv_id}",
        "handler": "handle_conversations_patch",
        "summary": "Rename a conversation",
        "tags": ["Chat"],
        "path_params": {"conv_id": {"schema": {"type": "string", "maxLength": 128}}},
        "request": "ConversationsPatchRequest",
        "responses": {"200": "OkResponse", "400": "Error", "500": "Error"},
        "auth": "none",
    },
    {
        "method": "DELETE",
        "path": "/conversations/{conv_id}",
        "handler": "handle_conversations_delete",
        "summary": "Delete a conversation",
        "tags": ["Chat"],
        "path_params": {"conv_id": {"schema": {"type": "string", "maxLength": 128}}},
        "responses": {"200": "OkResponse", "400": "Error"},
        "auth": "none",
    },
    # ── Observability ─────────────────────────────────────────────────────────
    {
        "method": "GET",
        "path": "/health",
        "handler": "handle_health",
        "summary": "Liveness probe",
        "description": "Returns ``{\"status\": \"ok\"}`` — minimal, no internal data.",
        "tags": ["Observability"],
        "responses": {"200": "HealthResponse"},
        "auth": "none",
    },
    {
        "method": "GET",
        "path": "/stats",
        "handler": "handle_stats",
        "summary": "Public stats for the dashboard",
        "tags": ["Observability"],
        "responses": {"200": "StatsResponse"},
        "auth": "none",
    },
    {
        "method": "GET",
        "path": "/metagraph",
        "handler": "handle_metagraph",
        "summary": "Public metagraph snapshot",
        "description": "Returns all neurons registered on the subnet (uid, hotkey, incentive).",
        "tags": ["Observability"],
        "responses": {"200": "MetagraphResponse"},
        "auth": "none",
    },
    {
        "method": "GET",
        "path": "/metrics",
        "handler": "handle_metrics",
        "summary": "Prometheus metrics (loopback only)",
        "tags": ["Observability"],
        "responses": {"200": "MetricsResponse", "403": "Error"},
        "auth": "loopback",
    },
    {
        "method": "GET",
        "path": "/wallet-stats",
        "handler": "handle_wallet_stats",
        "summary": "Aggregate wallet activity (loopback only)",
        "tags": ["Observability"],
        "responses": {"200": "WalletStatsResponse", "403": "Error"},
        "auth": "loopback",
    },
    {
        "method": "GET",
        "path": "/wallet-stats/{hotkey}",
        "handler": "handle_wallet_stats",
        "summary": "Per-hotkey wallet activity (loopback only)",
        "tags": ["Observability"],
        "path_params": {"hotkey": {"schema": {"type": "string"}}},
        "responses": {"200": "WalletStatsResponse", "403": "Error"},
        "auth": "loopback",
    },
]


# ── Component schemas ──────────────────────────────────────────────────────────

COMPONENTS: dict[str, Any] = {
    # ── Auth envelope (shared across all signed endpoints) ───────────────────
    "AuthFields": {
        "type": "object",
        "description": (
            "Optional fields. When ``REQUIRE_HOTKEY_SIG=true`` (mainnet default), "
            "all three are required. See the ``EngramHotkeySignature`` security scheme."
        ),
        "properties": {
            "hotkey": {
                "type": "string",
                "description": "SS58 address of the signing keypair (Bittensor hotkey).",
                "example": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            },
            "nonce": {
                "type": "integer",
                "format": "int64",
                "description": "Unix ms timestamp. Must be within ±30 s of server time.",
            },
            "signature": {
                "type": "string",
                "description": (
                    "Hex sr25519 signature (with or without 0x prefix) over the "
                    "canonical message: ``f\"{nonce}:{endpoint}:{body_hash}\"`` "
                    "where ``body_hash = SHA256(JSON(payload_fields_sorted))``."
                ),
                "example": "0xdeadbeef...",
            },
        },
    },
    # ── Synapse request/response schemas (mirrors engram/protocol.py) ────────
    "IngestRequest": {
        "type": "object",
        "description": "Body fields for POST /IngestSynapse.",
        "allOf": [
            {"$ref": "#/components/schemas/AuthFields"},
            {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "nullable": True,
                        "description": "Raw text to embed. Mutually exclusive with raw_embedding.",
                    },
                    "raw_embedding": {
                        "type": "array",
                        "items": {"type": "number", "format": "float"},
                        "nullable": True,
                        "description": "Pre-computed 1536-d embedding vector (skips embedder).",
                    },
                    "metadata": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "Arbitrary key-value metadata stored alongside the vector.",
                    },
                    "model_version": {
                        "type": "string",
                        "default": "v1",
                        "description": "Subnet model epoch version for CID generation.",
                    },
                    "namespace": {
                        "type": "string",
                        "nullable": True,
                        "description": "Private collection name (omit for public memories).",
                    },
                    "namespace_hotkey": {
                        "type": "string",
                        "nullable": True,
                        "description": "Bittensor SS58 hotkey that owns this namespace.",
                    },
                    "namespace_sig": {
                        "type": "string",
                        "nullable": True,
                        "description": (
                            "sr25519 hex signature over "
                            "'engram-ns:{namespace}:{namespace_timestamp_ms}'."
                        ),
                    },
                    "namespace_timestamp_ms": {
                        "type": "integer",
                        "format": "int64",
                        "nullable": True,
                        "description": "Unix ms timestamp for namespace_sig replay prevention (±60 s).",
                    },
                    "namespace_key": {
                        "type": "string",
                        "nullable": True,
                        "deprecated": True,
                        "description": "[Deprecated] Legacy shared secret. Use namespace_sig instead.",
                    },
                },
            },
        ],
    },
    "IngestResponse": {
        "type": "object",
        "properties": {
            "cid": {
                "type": "string",
                "nullable": True,
                "description": "Content identifier. ``null`` on failure.",
                "example": "v1::a3f2b1c9...",
            },
            "error": {"type": "string", "nullable": True, "description": "Error message on failure."},
        },
    },
    "QueryRequest": {
        "type": "object",
        "description": "Body fields for POST /QuerySynapse.",
        "allOf": [
            {"$ref": "#/components/schemas/AuthFields"},
            {
                "type": "object",
                "properties": {
                    "query_text": {"type": "string", "nullable": True},
                    "query_vector": {
                        "type": "array",
                        "items": {"type": "number", "format": "float"},
                        "nullable": True,
                    },
                    "top_k": {"type": "integer", "default": 10, "minimum": 1, "maximum": 100},
                    "namespace": {"type": "string", "nullable": True},
                    "namespace_hotkey": {"type": "string", "nullable": True},
                    "namespace_sig": {"type": "string", "nullable": True},
                    "namespace_timestamp_ms": {"type": "integer", "format": "int64", "nullable": True},
                    "namespace_key": {"type": "string", "nullable": True, "deprecated": True},
                    "filter": {
                        "type": "object",
                        "additionalProperties": {"type": "string"},
                        "description": "Metadata key/value filter (AND match) applied post-ANN.",
                    },
                },
            },
        ],
    },
    "QueryResponse": {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "cid": {"type": "string"},
                        "score": {"type": "number", "format": "float"},
                        "metadata": {"type": "object", "additionalProperties": True},
                    },
                },
            },
            "latency_ms": {"type": "number", "format": "float", "nullable": True},
            "error": {"type": "string", "nullable": True},
        },
    },
    "ChallengeRequest": {
        "type": "object",
        "allOf": [
            {"$ref": "#/components/schemas/AuthFields"},
            {
                "type": "object",
                "required": ["cid", "nonce_hex", "expires_at"],
                "properties": {
                    "cid": {"type": "string", "description": "CID to prove storage of."},
                    "nonce_hex": {"type": "string", "description": "32-byte random nonce as hex."},
                    "expires_at": {"type": "integer", "format": "int64", "description": "Unix seconds."},
                    "validator_hotkey_hex": {
                        "type": "string",
                        "description": "Validator's hotkey (raw 32-byte hex). Binds the HMAC key.",
                    },
                },
            },
        ],
    },
    "ChallengeResponse": {
        "type": "object",
        "properties": {
            "embedding_hash": {"type": "string", "description": "SHA-256 of stored embedding bytes."},
            "proof": {"type": "string", "description": "HMAC-SHA256(nonce || embedding_hash)."},
        },
    },
    "RepairRequest": {
        "type": "object",
        "allOf": [
            {"$ref": "#/components/schemas/AuthFields"},
            {"type": "object", "required": ["cid"], "properties": {"cid": {"type": "string"}}},
        ],
    },
    "RepairResponse": {
        "type": "object",
        "properties": {
            "cid": {"type": "string"},
            "embedding": {"type": "array", "items": {"type": "number", "format": "float"}},
            "metadata": {"type": "object", "additionalProperties": True},
        },
    },
    "RetrieveResponse": {
        "type": "object",
        "properties": {
            "cid": {"type": "string"},
            "metadata": {"type": "object", "additionalProperties": True},
        },
    },
    "DeleteRequest": {
        "type": "object",
        "allOf": [
            {"$ref": "#/components/schemas/AuthFields"},
            {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string", "nullable": True},
                    "namespace_hotkey": {"type": "string", "nullable": True},
                    "namespace_sig": {"type": "string", "nullable": True},
                    "namespace_timestamp_ms": {"type": "integer", "format": "int64", "nullable": True},
                },
            },
        ],
    },
    "DeleteResponse": {
        "type": "object",
        "properties": {"deleted": {"type": "boolean"}, "cid": {"type": "string"}},
    },
    "ListRequest": {
        "type": "object",
        "allOf": [
            {"$ref": "#/components/schemas/AuthFields"},
            {
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "object",
                        "additionalProperties": {"type": "string"},
                        "description": "Metadata key/value pairs (AND match).",
                    },
                    "limit": {"type": "integer", "default": 50, "maximum": 200},
                    "offset": {"type": "integer", "default": 0, "minimum": 0},
                    "namespace": {"type": "string", "default": "__public__"},
                    "namespace_hotkey": {"type": "string", "nullable": True},
                    "namespace_sig": {"type": "string", "nullable": True},
                    "namespace_timestamp_ms": {"type": "integer", "format": "int64", "nullable": True},
                },
            },
        ],
    },
    "ListResponse": {
        "type": "object",
        "properties": {
            "records": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "count": {"type": "integer"},
            "offset": {"type": "integer"},
            "limit": {"type": "integer"},
        },
    },
    "CommitmentResponse": {
        "type": "object",
        "properties": {
            "root_hex": {"type": "string", "description": "Merkle root over the full corpus."},
            "count": {"type": "integer"},
            "built_at": {"type": "number", "format": "double"},
            "hotkey": {"type": "string"},
        },
    },
    "ProveMemoryRequest": {
        "type": "object",
        "required": ["cid", "embedding_hash"],
        "properties": {
            "cid": {"type": "string"},
            "embedding_hash": {"type": "string", "minLength": 64, "maxLength": 64},
        },
    },
    "ProveMemoryResponse": {
        "type": "object",
        "properties": {
            "root_hex": {"type": "string"},
            "cid": {"type": "string"},
            "proof": {"type": "string", "description": "JSON-serialized inclusion proof."},
        },
    },
    "NamespaceManageRequest": {
        "type": "object",
        "required": ["action"],
        "properties": {
            "action": {"type": "string", "enum": ["create", "delete", "rotate", "list"]},
            "namespace": {"type": "string"},
            "key": {"type": "string", "description": "Namespace key (only for create/delete/rotate)."},
            "new_key": {"type": "string", "description": "Replacement key (only for rotate)."},
        },
    },
    "NamespaceManageResponse": {
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "namespace": {"type": "string"},
            "namespaces": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": True},
                "description": "Returned only for action=list.",
            },
        },
    },
    "AttestRequest": {
        "type": "object",
        "required": ["namespace", "owner_hotkey", "signature", "timestamp_ms"],
        "properties": {
            "namespace": {"type": "string"},
            "owner_hotkey": {"type": "string", "description": "SS58 Bittensor hotkey."},
            "signature": {"type": "string", "description": "Hex sr25519 signature."},
            "timestamp_ms": {"type": "integer", "format": "int64"},
        },
    },
    "AttestResponse": {
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "namespace": {"type": "string"},
            "trust_tier": {
                "type": "string",
                "enum": ["SOVEREIGN", "VERIFIED", "COMMUNITY", "anonymous"],
            },
            "stake_tao": {"type": "number", "format": "float"},
        },
    },
    "AttestationGetResponse": {
        "type": "object",
        "properties": {
            "namespace": {"type": "string"},
            "trust_tier": {"type": "string"},
            "owner_hotkey": {"type": "string", "nullable": True},
            "stake_tao": {"type": "number", "format": "float", "nullable": True},
            "attested_at_ms": {"type": "integer", "format": "int64", "nullable": True},
        },
    },
    "KeyShareStoreRequest": {
        "type": "object",
        "required": ["namespace", "share_index", "share_hex", "threshold", "total"],
        "properties": {
            "namespace": {"type": "string"},
            "share_index": {"type": "integer", "minimum": 1},
            "share_hex": {"type": "string"},
            "threshold": {"type": "integer", "minimum": 1, "description": "k — minimum shares to reconstruct."},
            "total": {"type": "integer", "minimum": 1, "description": "n — total shares created."},
            "namespace_hotkey": {"type": "string"},
            "namespace_sig": {"type": "string"},
            "namespace_timestamp_ms": {"type": "integer", "format": "int64"},
        },
    },
    "KeyShareStoreResponse": {
        "type": "object",
        "properties": {"stored": {"type": "boolean"}},
    },
    "KeyShareRetrieveRequest": {
        "type": "object",
        "required": ["namespace", "namespace_hotkey", "namespace_sig", "namespace_timestamp_ms"],
        "properties": {
            "namespace": {"type": "string"},
            "namespace_hotkey": {"type": "string"},
            "namespace_sig": {"type": "string"},
            "namespace_timestamp_ms": {"type": "integer", "format": "int64"},
        },
    },
    "KeyShareRetrieveResponse": {
        "type": "object",
        "properties": {
            "share_index": {"type": "integer", "nullable": True},
            "share_hex": {"type": "string", "nullable": True},
            "threshold": {"type": "integer", "nullable": True},
            "total": {"type": "integer", "nullable": True},
            "error": {"type": "string", "nullable": True},
        },
    },
    "ChatHistoryGetResponse": {
        "type": "object",
        "properties": {
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["user", "assistant", "system"]},
                        "content": {"type": "string"},
                        "ts": {"type": "integer", "format": "int64"},
                        "msg_ts": {"type": "integer", "format": "int64", "nullable": True},
                    },
                },
            },
        },
    },
    "ChatHistoryPostRequest": {
        "type": "object",
        "required": ["user_id", "messages"],
        "properties": {
            "user_id": {"type": "string", "maxLength": 128},
            "conv_id": {"type": "string", "maxLength": 128, "nullable": True},
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string"},
                        "content": {"type": "string"},
                    },
                },
            },
        },
    },
    "ChatHistoryPostResponse": {
        "type": "object",
        "properties": {"ok": {"type": "boolean"}, "saved": {"type": "integer"}},
    },
    "ConversationsGetResponse": {
        "type": "object",
        "properties": {
            "conversations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "conv_id": {"type": "string"},
                        "title": {"type": "string"},
                        "created_at": {"type": "integer", "format": "int64"},
                        "updated_at": {"type": "integer", "format": "int64"},
                    },
                },
            },
        },
    },
    "ConversationsPostRequest": {
        "type": "object",
        "required": ["user_id", "conv_id"],
        "properties": {
            "user_id": {"type": "string", "maxLength": 128},
            "conv_id": {"type": "string", "maxLength": 128},
            "title": {"type": "string", "maxLength": 80, "default": "New Chat"},
        },
    },
    "ConversationsPatchRequest": {
        "type": "object",
        "required": ["user_id", "title"],
        "properties": {
            "user_id": {"type": "string", "maxLength": 128},
            "title": {"type": "string", "maxLength": 80},
        },
    },
    "HealthResponse": {
        "type": "object",
        "properties": {"status": {"type": "string", "example": "ok"}},
    },
    "StatsResponse": {
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "vectors": {"type": "integer"},
            "peers": {"type": "integer"},
            "uid": {"type": "integer", "nullable": True},
            "queries_today": {"type": "integer"},
            "p50_latency_ms": {"type": "number", "format": "float", "nullable": True},
            "proof_rate": {"type": "number", "format": "float", "nullable": True},
            "uptime_pct": {"type": "number", "format": "float"},
            "block": {"type": "integer", "nullable": True},
            "avg_score": {"type": "number", "format": "float", "nullable": True},
            "hotkey": {"type": "string"},
        },
    },
    "MetagraphResponse": {
        "type": "object",
        "properties": {
            "neurons": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "uid": {"type": "integer"},
                        "hotkey": {"type": "string", "nullable": True},
                        "ip": {"type": "string", "nullable": True},
                        "port": {"type": "integer", "nullable": True},
                        "incentive": {"type": "number", "format": "float"},
                    },
                },
            },
            "block": {"type": "integer", "nullable": True},
        },
    },
    "MetricsResponse": {
        "type": "string",
        "description": "Prometheus text exposition format.",
        "example": "# HELP engram_ingest_total ...\nengram_ingest_total{status=\"ok\"} 42\n",
    },
    "WalletStatsResponse": {
        "type": "object",
        "additionalProperties": True,
        "description": "Free-form shape — see ``engram.miner.wallet_tracker.WalletTracker``.",
    },
    "OkResponse": {
        "type": "object",
        "properties": {"ok": {"type": "boolean", "example": True}},
    },
    "Error": {
        "type": "object",
        "properties": {
            "error": {"type": "string", "description": "Human-readable error message."},
            "hint": {"type": "string", "description": "Optional remediation hint."},
        },
        "required": ["error"],
    },
}


# ── Build the OpenAPI document ────────────────────────────────────────────────


def build_spec() -> dict[str, Any]:
    """Build the full OpenAPI 3.0.3 document."""
    paths: dict[str, Any] = {}
    for route in ROUTES:
        method = route["method"].lower()
        path = route["path"]
        paths.setdefault(path, {})
        op: dict[str, Any] = {
            "summary": route["summary"],
            "description": route.get("description", ""),
            "tags": route.get("tags", []),
            "operationId": _operation_id(method, path),
            "responses": {
                code: _response(model) for code, model in route["responses"].items()
            },
        }
        if route.get("auth") and route["auth"] != "none":
            op["security"] = [{"EngramHotkeySignature": []}]
            if route["auth"] == "loopback":
                op["description"] = (
                    (op.get("description") or "")
                    + "\n\n**Auth:** Loopback-only (operator endpoint)."
                )
            elif route["auth"] == "namespace":
                op["description"] = (
                    (op.get("description") or "")
                    + "\n\n**Auth:** Requires namespace ownership proof "
                    "(namespace_hotkey + namespace_sig + namespace_timestamp_ms)."
                )
            elif route["auth"] == "network+namespace":
                op["description"] = (
                    (op.get("description") or "")
                    + "\n\n**Auth:** Network signature + (for private namespaces) "
                    "namespace ownership proof."
                )
            elif route["auth"] == "optional+namespace":
                op["description"] = (
                    (op.get("description") or "")
                    + "\n\n**Auth:** Optional network signature; required namespace "
                    "ownership proof for private namespaces."
                )
        parameters: list[dict[str, Any]] = []
        for name, spec in (route.get("path_params") or {}).items():
            parameters.append({
                "name": name,
                "in": "path",
                "required": True,
                **spec,
            })
        if parameters:
            op["parameters"] = parameters
        if route.get("request"):
            op["requestBody"] = {
                "required": True,
                "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{route['request']}"}}},
            }
        paths[path][method] = op

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "Engram Miner HTTP API",
            "version": "0.1.2",
            "description": (
                "HTTP API exposed by an Engram miner node (Bittensor subnet 450). "
                "All endpoints accept and return ``application/json`` unless noted. "
                "Endpoints requiring network authentication expect a Bittensor "
                "hotkey signature — see the **Authentication** section below."
            ),
        },
        "servers": [
            {"url": "http://localhost:8091", "description": "Local miner (default port)"},
            {"url": "https://theengram.space", "description": "Public testnet gateway"},
        ],
        "tags": [
            {"name": "Synapses", "description": "Bittensor Synapse protocol endpoints."},
            {"name": "Retrieval", "description": "Direct CID lookup / deletion."},
            {"name": "Proofs", "description": "Merkle inclusion and storage proofs."},
            {"name": "Namespaces", "description": "Private namespace management."},
            {"name": "KeyShares", "description": "Shamir secret-sharing deposits/withdrawals."},
            {"name": "Chat", "description": "Per-user chat history & conversations."},
            {"name": "Observability", "description": "Health, stats, metrics."},
        ],
        "security": [{"EngramHotkeySignature": []}],
        "paths": paths,
        "components": {
            "securitySchemes": {
                "EngramHotkeySignature": {
                    "type": "apiKey",
                    "in": "body",
                    "name": "signature",
                    "description": (
                        "**Bittensor sr25519 signed-challenge scheme.**\n\n"
                        "Three fields are added to the request body:\n\n"
                        "```json\n"
                        "{\n"
                        '  "hotkey":    "5F...",          // SS58 of the signing keypair\n'
                        '  "nonce":     1712345678123,    // unix ms — replay protection (±30 s)\n'
                        '  "signature": "0xabc123...",   // hex sr25519 sig over canonical message\n'
                        "  ...payload...\n"
                        "}\n```\n\n"
                        "**Canonical message** (UTF-8 bytes):\n\n"
                        "```python\n"
                        'f"{nonce}:{endpoint}:{body_hash}"\n'
                        "```\n\n"
                        "where:\n\n"
                        "- ``endpoint`` is the URL path *with* the leading slash "
                        "(e.g. ``/IngestSynapse``)\n"
                        "- ``body_hash = SHA256(``\n"
                        "  ``json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str)``\n"
                        "  ``)`` — i.e. the hash of the JSON-serialised payload, "
                        "*excluding* ``hotkey``/``nonce``/``signature`` themselves, "
                        "keys sorted lexicographically.\n\n"
                        "**Replay window:** ``|now_ms - nonce| <= 30_000``\n\n"
                        "**Operator policy** (env vars, see ``engram/miner/auth.py``):\n\n"
                        "- ``REQUIRE_HOTKEY_SIG=true`` — reject unsigned requests "
                        "(mainnet default)\n"
                        "- ``ALLOWED_VALIDATOR_HOTKEYS=5F...,5G...`` — strict allowlist\n"
                        "- ``REQUIRE_METAGRAPH_REG=true`` — reject unregistered hotkeys"
                    ),
                },
            },
            "schemas": COMPONENTS,
        },
    }


def _response(model: str) -> dict[str, Any]:
    if model == "MetricsResponse":
        return {
            "description": "Prometheus text exposition format.",
            "content": {"text/plain": {"schema": {"type": "string"}}},
        }
    if model == "Error":
        return {
            "description": "Error response.",
            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
        }
    return {
        "description": "Success.",
        "content": {
            "application/json": {"schema": {"$ref": f"#/components/schemas/{model}"}},
        },
    }


def _operation_id(method: str, path: str) -> str:
    """Stable, sortable operation IDs (e.g. ``post_IngestSynapse``)."""
    clean = path.replace("{", "").replace("}", "").replace("/", "_").strip("_")
    return f"{method.lower()}_{clean}"


# ── CLI ────────────────────────────────────────────────────────────────────────

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "docs" / "openapi" / "miner-openapi.yaml"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="Exit non-zero if file is stale.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output path.")
    args = parser.parse_args(argv)

    spec = build_spec()
    rendered = yaml.safe_dump(spec, sort_keys=False, allow_unicode=True, width=100)
    header = (
        "# Engram Miner — OpenAPI 3.0.3 spec\n"
        "# AUTO-GENERATED by scripts/generate_openapi.py — do not hand-edit.\n"
        "# Run `python scripts/generate_openapi.py` to regenerate.\n"
        "#\n"
        "# Render with Redoc: https://github.com/Redocly/redoc\n"
        "# CI sync check:     python scripts/check_openapi_sync.py\n\n"
    )
    body = header + rendered
    if args.check:
        if not args.out.exists():
            print(f"[openapi] MISSING: {args.out}", file=sys.stderr)
            return 1
        existing = args.out.read_text(encoding="utf-8")
        if existing != body:
            print(f"[openapi] STALE: {args.out}", file=sys.stderr)
            print("Re-run `python scripts/generate_openapi.py` to refresh.", file=sys.stderr)
            return 2
        print(f"[openapi] OK: {args.out}")
        return 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(body, encoding="utf-8")
    print(f"[openapi] Wrote {args.out} ({len(body)} bytes, {len(ROUTES)} routes, {len(COMPONENTS)} schemas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
