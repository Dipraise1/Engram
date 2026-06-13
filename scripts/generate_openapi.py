import json
import os
from pathlib import Path
from typing import Any

from pydantic.json_schema import models_json_schema

# We need to import the protocol models
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from engram.protocol import (
    IngestSynapse,
    QuerySynapse,
    ChallengeSynapse,
    KeyShareSynapse,
    KeyShareRetrieve,
)

def generate_openapi() -> dict[str, Any]:
    # 1. Generate schemas from Pydantic models
    models = [
        IngestSynapse,
        QuerySynapse,
        ChallengeSynapse,
        KeyShareSynapse,
        KeyShareRetrieve,
    ]
    
    _, schemas = models_json_schema(
        [(m, "validation") for m in models],
        title="Engram Miner API",
        ref_template="#/components/schemas/{model}",
    )

    # Clean up definitions vs $defs
    defs = schemas.get("$defs", {})
    
    # 2. Build the base OpenAPI dict
    openapi = {
        "openapi": "3.0.3",
        "info": {
            "title": "Engram Miner API",
            "version": "1.0.0",
            "description": "HTTP API for Engram miners. Used by validators and external clients.",
        },
        "servers": [{"url": "http://localhost:8091", "description": "Miner Node"}],
        "components": {
            "schemas": defs,
            "securitySchemes": {
                "sr25519_signature": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "namespace_sig",
                    "description": (
                        "Requires `namespace_hotkey`, `namespace_sig`, and `namespace_timestamp_ms` "
                        "in the request payload instead of standard headers for most synapse endpoints."
                    ),
                }
            },
        },
        "paths": {},
    }

    # 3. Helper to define an endpoint mapping to a synapse
    def add_endpoint(path: str, method: str, model_name: str, summary: str):
        if path not in openapi["paths"]:
            openapi["paths"][path] = {}
            
        openapi["paths"][path][method] = {
            "summary": summary,
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": f"#/components/schemas/{model_name}"}
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "Successful operation",
                    "content": {
                        "application/json": {
                            # The response is typically just the same Synapse model returned
                            # with the response fields populated
                            "schema": {"$ref": f"#/components/schemas/{model_name}"}
                        }
                    }
                }
            }
        }

    # 4. Map endpoints
    add_endpoint("/IngestSynapse", "post", "IngestSynapse", "Ingest an embedding or text")
    add_endpoint("/QuerySynapse", "post", "QuerySynapse", "Query vectors (approximate nearest neighbor)")
    add_endpoint("/ChallengeSynapse", "post", "ChallengeSynapse", "Respond to a storage proof challenge")
    add_endpoint("/KeyShareSynapse", "post", "KeyShareSynapse", "Store a Shamir key share")
    add_endpoint("/KeyShareRetrieve", "post", "KeyShareRetrieve", "Retrieve a stored Shamir key share")

    # Add standard endpoints that might not have a full Synapse schema
    openapi["paths"]["/health"] = {
        "get": {
            "summary": "Liveness probe",
            "responses": {
                "200": {
                    "description": "OK"
                }
            }
        }
    }
    
    openapi["paths"]["/metrics"] = {
        "get": {
            "summary": "Prometheus metrics",
            "responses": {
                "200": {
                    "description": "Prometheus text format"
                }
            }
        }
    }

    return openapi

if __name__ == "__main__":
    docs_dir = Path(__file__).parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)
    
    openapi_spec = generate_openapi()
    out_path = docs_dir / "openapi.json"
    
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(openapi_spec, f, indent=2)
        
    print(f"✅ Generated OpenAPI spec at {out_path}")
