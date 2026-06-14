import ast
import json
from pathlib import Path
from typing import Any
import sys

from pydantic.json_schema import models_json_schema

# Import protocol models
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from engram.protocol import (
    IngestSynapse,
    QuerySynapse,
    ChallengeSynapse,
    KeyShareSynapse,
    KeyShareRetrieve,
)

def extract_routes_from_miner() -> list[dict[str, Any]]:
    miner_path = project_root / 'neurons' / 'miner.py'
    with open(miner_path, 'r', encoding='utf-8') as f:
        source = f.read()

    tree = ast.parse(source)
    
    # Extract handler docstrings
    handlers = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef):
            doc = ast.get_docstring(node)
            handlers[node.name] = doc

    # Extract routes
    routes = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr in ['add_post', 'add_get', 'add_patch', 'add_delete']:
                if isinstance(node.func.value, ast.Attribute) and node.func.value.attr == 'router':
                    method = node.func.attr.split('_')[1]
                    path = node.args[0].value
                    handler = node.args[1].id
                    routes.append({
                        'method': method,
                        'path': path,
                        'handler': handler,
                        'summary': handlers.get(handler) or handler.replace('handle_', '').replace('_', ' ').title()
                    })
    return routes

def generate_openapi() -> dict[str, Any]:
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

    defs = schemas.get("$defs", {})
    
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

    routes = extract_routes_from_miner()
    
    # Map Synapse models to paths
    synapse_models = {
        "/IngestSynapse": "IngestSynapse",
        "/QuerySynapse": "QuerySynapse",
        "/ChallengeSynapse": "ChallengeSynapse",
        "/KeyShareSynapse": "KeyShareSynapse",
        "/KeyShareRetrieve": "KeyShareRetrieve",
    }

    for route in routes:
        path = route['path']
        method = route['method']
        summary = route['summary'].split('\n')[0] # Use first line of docstring
        
        if path not in openapi["paths"]:
            openapi["paths"][path] = {}
            
        endpoint_def = {
            "summary": summary,
            "responses": {
                "200": {
                    "description": "Successful operation"
                }
            }
        }
        
        # Attach request body and response schema if it's a known synapse
        if path in synapse_models:
            model_name = synapse_models[path]
            endpoint_def["requestBody"] = {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": f"#/components/schemas/{model_name}"}
                    }
                }
            }
            endpoint_def["responses"]["200"]["content"] = {
                "application/json": {
                    "schema": {"$ref": f"#/components/schemas/{model_name}"}
                }
            }
        elif method in ['post', 'patch']:
            # Generic JSON request body for other methods
            endpoint_def["requestBody"] = {
                "content": {
                    "application/json": {
                        "schema": {"type": "object"}
                    }
                }
            }
            
        openapi["paths"][path][method] = endpoint_def

    return openapi

if __name__ == "__main__":
    docs_dir = project_root / "docs"
    docs_dir.mkdir(exist_ok=True)
    
    openapi_spec = generate_openapi()
    out_path = docs_dir / "openapi.json"
    
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(openapi_spec, f, indent=2)
        
    print(f"Generated OpenAPI spec at {out_path}")
