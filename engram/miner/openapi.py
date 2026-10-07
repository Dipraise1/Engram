"""OpenAPI metadata for the Engram miner HTTP API.

The miner runtime and the generated OpenAPI document both use
``MINER_HTTP_ROUTES`` so route drift is caught by tests and by the generation
script's ``--check`` mode.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class MinerRoute:
    method: str
    path: str
    handler: str
    summary: str
    tag: str
    request_schema: str | None = None
    response_schema: str = "ErrorResponse"
    private: bool = False


MINER_HTTP_ROUTES: tuple[MinerRoute, ...] = (
    MinerRoute(
        "post",
        "/IngestSynapse",
        "handle_ingest",
        "Store text or an embedding and return a CID.",
        "Memory",
        "IngestRequest",
        "IngestResponse",
    ),
    MinerRoute(
        "post",
        "/QuerySynapse",
        "handle_query",
        "Search stored vectors by text or embedding.",
        "Memory",
        "QueryRequest",
        "QueryResponse",
    ),
    MinerRoute(
        "post",
        "/ChallengeSynapse",
        "handle_challenge",
        "Return a storage proof for a challenged CID.",
        "Proofs",
        "ChallengeRequest",
        "ChallengeResponse",
    ),
    MinerRoute(
        "post",
        "/namespace",
        "handle_namespace",
        "Manage local private namespaces.",
        "Namespaces",
        "NamespaceRequest",
        "NamespaceResponse",
        private=True,
    ),
    MinerRoute(
        "post",
        "/AttestNamespace",
        "handle_attest",
        "Attest a namespace to a Bittensor hotkey.",
        "Namespaces",
        "AttestNamespaceRequest",
        "AttestNamespaceResponse",
    ),
    MinerRoute(
        "get",
        "/attestation/{namespace}",
        "handle_attestation_get",
        "Return attestation trust information for a namespace.",
        "Namespaces",
        None,
        "AttestationResponse",
    ),
    MinerRoute(
        "get",
        "/chat-history/{user_id}",
        "handle_chat_history_get",
        "Load chat history for a user.",
        "Chat",
        None,
        "ChatHistoryResponse",
    ),
    MinerRoute(
        "post",
        "/chat-history",
        "handle_chat_history_post",
        "Save chat history for a user.",
        "Chat",
        "ChatHistorySaveRequest",
        "OkSavedResponse",
    ),
    MinerRoute(
        "get",
        "/conversations/{user_id}",
        "handle_conversations_get",
        "List conversations for a user.",
        "Chat",
        None,
        "ConversationsResponse",
    ),
    MinerRoute(
        "post",
        "/conversations",
        "handle_conversations_post",
        "Create a conversation.",
        "Chat",
        "ConversationCreateRequest",
        "OkResponse",
    ),
    MinerRoute(
        "patch",
        "/conversations/{conv_id}",
        "handle_conversations_patch",
        "Rename a conversation.",
        "Chat",
        "ConversationRenameRequest",
        "OkResponse",
    ),
    MinerRoute(
        "delete",
        "/conversations/{conv_id}",
        "handle_conversations_delete",
        "Delete a conversation.",
        "Chat",
        None,
        "OkResponse",
    ),
    MinerRoute(
        "get",
        "/retrieve/{cid}",
        "handle_retrieve",
        "Retrieve public metadata for a CID.",
        "Memory",
        None,
        "RetrieveResponse",
    ),
    MinerRoute(
        "delete",
        "/retrieve/{cid}",
        "handle_delete",
        "Delete a stored memory by CID.",
        "Memory",
        "DeleteRequest",
        "DeleteResponse",
    ),
    MinerRoute(
        "post",
        "/RepairSynapse",
        "handle_repair_retrieve",
        "Return a public embedding for validator repair replication.",
        "Repair",
        "RepairRequest",
        "RepairResponse",
    ),
    MinerRoute(
        "post",
        "/KeyShareSynapse",
        "handle_key_share_store",
        "Store a Shamir key share for a namespace.",
        "Namespaces",
        "KeyShareStoreRequest",
        "KeyShareStoreResponse",
    ),
    MinerRoute(
        "post",
        "/KeyShareRetrieve",
        "handle_key_share_retrieve",
        "Retrieve this miner's Shamir key share for a namespace.",
        "Namespaces",
        "KeyShareRetrieveRequest",
        "KeyShareRetrieveResponse",
    ),
    MinerRoute(
        "post",
        "/list",
        "handle_list",
        "List stored memories with pagination and optional metadata filtering.",
        "Memory",
        "ListRequest",
        "ListResponse",
    ),
    MinerRoute(
        "get",
        "/health",
        "handle_health",
        "Return a minimal liveness status.",
        "Status",
        None,
        "HealthResponse",
    ),
    MinerRoute(
        "get",
        "/stats",
        "handle_stats",
        "Return public miner counters for dashboards.",
        "Status",
        None,
        "StatsResponse",
    ),
    MinerRoute(
        "get",
        "/metagraph",
        "handle_metagraph",
        "Return a public metagraph snapshot.",
        "Status",
        None,
        "MetagraphResponse",
    ),
    MinerRoute(
        "get",
        "/metrics",
        "handle_metrics",
        "Return Prometheus metrics.",
        "Status",
        None,
        "PrometheusMetricsResponse",
        private=True,
    ),
    MinerRoute(
        "get",
        "/wallet-stats",
        "handle_wallet_stats",
        "Return aggregate local wallet activity stats.",
        "Status",
        None,
        "GenericObjectResponse",
        private=True,
    ),
    MinerRoute(
        "get",
        "/wallet-stats/{hotkey}",
        "handle_wallet_stats",
        "Return local activity stats for one hotkey.",
        "Status",
        None,
        "GenericObjectResponse",
        private=True,
    ),
    MinerRoute(
        "get",
        "/commitment",
        "handle_commitment",
        "Return the Merkle root for the miner's memory corpus.",
        "Proofs",
        None,
        "CommitmentResponse",
    ),
    MinerRoute(
        "post",
        "/prove-memory",
        "handle_prove_memory",
        "Return a Merkle inclusion proof for a CID.",
        "Proofs",
        "ProveMemoryRequest",
        "ProveMemoryResponse",
    ),
)


def build_openapi_spec() -> dict[str, Any]:
    """Return the OpenAPI 3.1 document for the miner HTTP API."""
    paths: dict[str, dict[str, Any]] = {}
    for route in MINER_HTTP_ROUTES:
        operation: dict[str, Any] = {
            "operationId": _operation_id(route),
            "summary": route.summary,
            "tags": [route.tag],
            "responses": _responses(route.response_schema),
        }
        params = _path_parameters(route.path)
        if params:
            operation["parameters"] = params
        if route.request_schema:
            operation["requestBody"] = {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": f"#/components/schemas/{route.request_schema}"}
                    }
                },
            }
        if route.private:
            operation["x-engram-access"] = (
                "Restricted to localhost or namespace owner depending on endpoint."
            )
        paths.setdefault(route.path, {})[route.method] = operation

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Engram Miner HTTP API",
            "version": "0.1.0",
            "description": (
                "Machine-readable API contract for Engram miner endpoints. "
                "Signed requests use JSON body fields hotkey, nonce, and signature. "
                "The signature is sr25519 over '<nonce>:<endpoint>:<payload_hash>', "
                "where payload_hash is the SHA-256 hash of the canonical JSON body "
                "excluding hotkey, nonce, and signature."
            ),
        },
        "servers": [{"url": "http://127.0.0.1:8091", "description": "Local miner"}],
        "tags": [
            {"name": "Memory"},
            {"name": "Proofs"},
            {"name": "Namespaces"},
            {"name": "Repair"},
            {"name": "Chat"},
            {"name": "Status"},
        ],
        "paths": paths,
        "components": {
            "schemas": _schemas(),
            "securitySchemes": {
                "Sr25519SignedBody": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-Engram-Signature-Fields-In-Body",
                    "description": (
                        "Documentation marker for Engram signed-body auth. "
                        "Clients send hotkey, nonce, and signature in the JSON body; "
                        "the miner verifies sr25519 signatures with "
                        "engram.miner.auth.verify_request."
                    ),
                }
            },
        },
        "x-engram-route-count": len(MINER_HTTP_ROUTES),
    }


def _operation_id(route: MinerRoute) -> str:
    return route.handler.removeprefix("handle_")


def _path_parameters(path: str) -> list[dict[str, Any]]:
    params = []
    for name in ("namespace", "user_id", "conv_id", "cid", "hotkey"):
        if "{" + name + "}" in path:
            params.append({
                "name": name,
                "in": "path",
                "required": True,
                "schema": {"type": "string"},
            })
    return params


def _responses(schema_name: str) -> dict[str, Any]:
    content_type = (
        "text/plain" if schema_name == "PrometheusMetricsResponse" else "application/json"
    )
    schema: dict[str, Any]
    if schema_name == "PrometheusMetricsResponse":
        schema = {"type": "string"}
    else:
        schema = {"$ref": f"#/components/schemas/{schema_name}"}
    return {
        "200": {
            "description": "Success",
            "content": {content_type: {"schema": schema}},
        },
        "400": {
            "description": "Request failed validation.",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                }
            },
        },
        "401": {
            "description": "Authentication failed.",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                }
            },
        },
        "404": {
            "description": "Resource not found.",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                }
            },
        },
    }


def _schemas() -> dict[str, Any]:
    string_or_null = {"anyOf": [{"type": "string"}, {"type": "null"}]}
    number_or_null = {"anyOf": [{"type": "number"}, {"type": "null"}]}
    integer_or_null = {"anyOf": [{"type": "integer"}, {"type": "null"}]}
    object_schema = {"type": "object", "additionalProperties": True}
    signed_body = {
        "hotkey": string_or_null,
        "nonce": integer_or_null,
        "signature": string_or_null,
    }
    namespace_sig = {
        "namespace_hotkey": string_or_null,
        "namespace_sig": string_or_null,
        "namespace_timestamp_ms": integer_or_null,
        "namespace_key": string_or_null,
    }

    return {
        "ErrorResponse": {
            "type": "object",
            "properties": {"error": {"type": "string"}},
            "required": ["error"],
        },
        "IngestRequest": {
            "type": "object",
            "properties": {
                **signed_body,
                **namespace_sig,
                "text": string_or_null,
                "raw_embedding": {
                    "anyOf": [
                        {"type": "array", "items": {"type": "number"}},
                        {"type": "null"},
                    ]
                },
                "metadata": object_schema,
                "model_version": {"type": "string", "default": "v1"},
                "namespace": string_or_null,
            },
        },
        "IngestResponse": {
            "type": "object",
            "properties": {"cid": string_or_null, "error": string_or_null},
        },
        "QueryRequest": {
            "type": "object",
            "properties": {
                **signed_body,
                **namespace_sig,
                "query_text": string_or_null,
                "query_vector": {
                    "anyOf": [
                        {"type": "array", "items": {"type": "number"}},
                        {"type": "null"},
                    ]
                },
                "top_k": {"type": "integer", "minimum": 1, "maximum": 100, "default": 10},
                "namespace": string_or_null,
                "filter": object_schema,
            },
        },
        "QueryResult": {
            "type": "object",
            "properties": {
                "cid": {"type": "string"},
                "score": {"type": "number"},
                "metadata": object_schema,
            },
            "required": ["cid", "score"],
        },
        "QueryResponse": {
            "type": "object",
            "properties": {
                "results": {
                    "type": "array",
                    "items": {"$ref": "#/components/schemas/QueryResult"},
                },
                "latency_ms": number_or_null,
                "error": string_or_null,
            },
        },
        "ChallengeRequest": {
            "type": "object",
            "properties": {
                **signed_body,
                "cid": {"type": "string"},
                "nonce_hex": {"type": "string"},
                "expires_at": {"type": "integer"},
                "validator_hotkey_hex": string_or_null,
            },
            "required": ["cid", "nonce_hex", "expires_at"],
        },
        "ChallengeResponse": {
            "type": "object",
            "properties": {
                "embedding_hash": {"type": "string"},
                "proof": {"type": "string"},
            },
        },
        "NamespaceRequest": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create", "delete", "rotate", "list"],
                },
                "namespace": {"type": "string"},
                "key": {"type": "string"},
                "new_key": string_or_null,
            },
            "required": ["action"],
        },
        "NamespaceResponse": {"type": "object", "additionalProperties": True},
        "AttestNamespaceRequest": {
            "type": "object",
            "properties": {
                "namespace": {"type": "string"},
                "owner_hotkey": {"type": "string"},
                "signature": {"type": "string"},
                "timestamp_ms": {"type": "integer"},
            },
            "required": ["namespace", "owner_hotkey", "signature", "timestamp_ms"],
        },
        "AttestNamespaceResponse": {
            "type": "object",
            "properties": {
                "ok": {"type": "boolean"},
                "namespace": {"type": "string"},
                "trust_tier": {"type": "string"},
                "stake_tao": {"type": "number"},
            },
        },
        "AttestationResponse": {"type": "object", "additionalProperties": True},
        "ChatHistoryResponse": {
            "type": "object",
            "properties": {"messages": {"type": "array", "items": object_schema}},
        },
        "ChatHistorySaveRequest": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "conv_id": string_or_null,
                "messages": {"type": "array", "items": object_schema},
            },
            "required": ["user_id", "messages"],
        },
        "OkSavedResponse": {
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "saved": {"type": "integer"}},
        },
        "ConversationsResponse": {
            "type": "object",
            "properties": {"conversations": {"type": "array", "items": object_schema}},
        },
        "ConversationCreateRequest": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "conv_id": {"type": "string"},
                "title": {"type": "string"},
            },
            "required": ["user_id", "conv_id"],
        },
        "ConversationRenameRequest": {
            "type": "object",
            "properties": {"user_id": {"type": "string"}, "title": {"type": "string"}},
            "required": ["user_id", "title"],
        },
        "OkResponse": {"type": "object", "properties": {"ok": {"type": "boolean"}}},
        "RetrieveResponse": {
            "type": "object",
            "properties": {"cid": {"type": "string"}, "metadata": object_schema},
        },
        "DeleteRequest": {
            "type": "object",
            "properties": {**signed_body, **namespace_sig},
        },
        "DeleteResponse": {
            "type": "object",
            "properties": {"deleted": {"type": "boolean"}, "cid": {"type": "string"}},
        },
        "RepairRequest": {
            "type": "object",
            "properties": {**signed_body, "cid": {"type": "string"}},
            "required": ["cid"],
        },
        "RepairResponse": {
            "type": "object",
            "properties": {
                "cid": {"type": "string"},
                "embedding": {"type": "array", "items": {"type": "number"}},
                "metadata": object_schema,
            },
        },
        "KeyShareStoreRequest": {
            "type": "object",
            "properties": {
                **namespace_sig,
                "namespace": {"type": "string"},
                "share_index": {"type": "integer"},
                "share_hex": {"type": "string"},
                "threshold": {"type": "integer"},
                "total": {"type": "integer"},
            },
            "required": ["namespace", "share_index", "share_hex", "threshold", "total"],
        },
        "KeyShareStoreResponse": {"type": "object", "properties": {"stored": {"type": "boolean"}}},
        "KeyShareRetrieveRequest": {
            "type": "object",
            "properties": {**namespace_sig, "namespace": {"type": "string"}},
            "required": ["namespace"],
        },
        "KeyShareRetrieveResponse": {
            "type": "object",
            "properties": {
                "share_index": integer_or_null,
                "share_hex": string_or_null,
                "threshold": integer_or_null,
                "total": integer_or_null,
                "error": string_or_null,
            },
        },
        "ListRequest": {
            "type": "object",
            "properties": {
                **namespace_sig,
                "filter": object_schema,
                "limit": {"type": "integer", "default": 50, "maximum": 200},
                "offset": {"type": "integer", "default": 0},
                "namespace": {"type": "string", "default": "__public__"},
            },
        },
        "ListResponse": {
            "type": "object",
            "properties": {
                "records": {"type": "array", "items": object_schema},
                "count": {"type": "integer"},
                "offset": {"type": "integer"},
                "limit": {"type": "integer"},
            },
        },
        "HealthResponse": {
            "type": "object",
            "properties": {"status": {"type": "string"}},
        },
        "StatsResponse": {"type": "object", "additionalProperties": True},
        "MetagraphResponse": {
            "type": "object",
            "properties": {
                "neurons": {"type": "array", "items": object_schema},
                "block": integer_or_null,
            },
        },
        "PrometheusMetricsResponse": {"type": "string"},
        "GenericObjectResponse": object_schema,
        "CommitmentResponse": {
            "type": "object",
            "properties": {
                "root_hex": string_or_null,
                "count": {"type": "integer"},
                "built_at": {"type": "number"},
                "hotkey": {"type": "string"},
            },
        },
        "ProveMemoryRequest": {
            "type": "object",
            "properties": {
                "cid": {"type": "string"},
                "embedding_hash": {"type": "string"},
            },
            "required": ["cid", "embedding_hash"],
        },
        "ProveMemoryResponse": {
            "type": "object",
            "properties": {
                "root_hex": {"type": "string"},
                "cid": {"type": "string"},
                "proof": object_schema,
            },
        },
    }
