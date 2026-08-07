import ast
import json
import os
import yaml
from pathlib import Path

def parse_miner_routes(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()

    tree = ast.parse(source)
    
    # 1. Find all async handlers and their docstrings
    handlers = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef):
            docstring = ast.get_docstring(node)
            handlers[node.name] = docstring or ""

    # 2. Find route registrations: app.router.add_<method>("path", handler)
    routes = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            # Look for app.router.add_xxx(...)
            if isinstance(node.func, ast.Attribute) and node.func.attr.startswith("add_"):
                if isinstance(node.func.value, ast.Attribute) and node.func.value.attr == "router":
                    method = node.func.attr.replace("add_", "").lower()
                    if len(node.args) >= 2:
                        path_node = node.args[0]
                        handler_node = node.args[1]
                        
                        if isinstance(path_node, ast.Constant):
                            path = path_node.value
                            handler_name = handler_node.id if isinstance(handler_node, ast.Name) else None
                            
                            docstring = handlers.get(handler_name, "") if handler_name else ""
                            routes.append({
                                "method": method,
                                "path": path,
                                "handler": handler_name,
                                "docstring": docstring
                            })
    return routes

def generate_openapi():
    base_dir = Path(__file__).parent.parent
    miner_file = base_dir / "neurons" / "miner.py"
    
    routes = parse_miner_routes(miner_file)
    
    openapi = {
        "openapi": "3.0.3",
        "info": {
            "title": "Engram Miner API",
            "description": "Auto-generated OpenAPI specification for Engram Miner HTTP endpoints.",
            "version": "1.0.0"
        },
        "components": {
            "securitySchemes": {
                "sr25519_auth": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "Authorization",
                    "description": "Request body must be signed. Validation depends on Bittensor SS58 hotkeys and sr25519 signatures."
                }
            }
        },
        "paths": {}
    }
    
    for route in routes:
        path = route["path"]
        method = route["method"]
        docstring = route["docstring"]
        
        # Parse docstring for summary and description
        lines = docstring.strip().split("\n")
        summary = lines[0] if lines else f"{method.upper()} {path}"
        description = "\n".join(lines[1:]).strip() if len(lines) > 1 else summary
        
        if path not in openapi["paths"]:
            openapi["paths"][path] = {}
            
        operation = {
            "summary": summary.replace(f"{method.upper()} {path} — ", "").replace(f"POST {path} — ", "").strip(),
            "description": description,
            "responses": {
                "200": {
                    "description": "Successful operation"
                },
                "400": {
                    "description": "Bad Request"
                },
                "401": {
                    "description": "Unauthorized - Auth signature invalid"
                },
                "403": {
                    "description": "Forbidden - Missing or invalid namespace signature"
                },
                "404": {
                    "description": "Not Found"
                },
                "500": {
                    "description": "Internal Server Error"
                }
            }
        }
        
        # Add auth requirement to most POST endpoints
        if method == "post" and path not in ["/health"]:
            operation["security"] = [{"sr25519_auth": []}]
            
        # Parse path parameters
        if "{" in path and "}" in path:
            param_name = path.split("{")[1].split("}")[0]
            operation["parameters"] = [
                {
                    "name": param_name,
                    "in": "path",
                    "required": True,
                    "schema": {
                        "type": "string"
                    }
                }
            ]
            
        openapi["paths"][path][method] = operation
        
    return openapi

if __name__ == "__main__":
    openapi_spec = generate_openapi()
    
    docs_dir = Path(__file__).parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)
    
    json_path = docs_dir / "openapi.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(openapi_spec, f, indent=2)
        
    yaml_path = docs_dir / "openapi.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(openapi_spec, f, sort_keys=False)
        
    print(f"Generated {json_path} and {yaml_path}")
