import ast
import json
import os
from pathlib import Path

def generate_openapi():
    miner_path = Path('neurons/miner.py')
    with open(miner_path, 'r', encoding='utf-8') as f:
        tree = ast.parse(f.read())
        
    routes = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr.startswith('add_'):
            method = node.func.attr[4:].upper()
            if len(node.args) >= 2:
                if isinstance(node.args[0], ast.Constant):
                    path = node.args[0].value
                    if isinstance(node.args[1], ast.Name):
                        handler_name = node.args[1].id
                        routes.append((method, path, handler_name))
                
    docstrings = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef):
            docstrings[node.name] = ast.get_docstring(node) or "No description available."
            
    openapi = {
        "openapi": "3.0.0",
        "info": {
            "title": "Engram Miner API",
            "version": "1.0.0",
            "description": "API for Engram miner endpoints.\n\n### Authentication\nAuth scheme uses sr25519 signed challenges. The caller typically includes their SS58 `hotkey`, a `nonce` (Unix ms timestamp), and a `signature` (hex sr25519 signature over the canonical message `nonce:endpoint:body_hash`)."
        },
        "components": {
            "securitySchemes": {
                "Sr25519Auth": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "Authorization",
                    "description": "sr25519 signed-challenge headers (or body fields `hotkey`, `nonce`, `signature`)."
                }
            }
        },
        "security": [{"Sr25519Auth": []}],
        "paths": {}
    }
    
    for method, path, handler_name in routes:
        if path not in openapi['paths']:
            openapi['paths'][path] = {}
        
        desc = docstrings.get(handler_name, "No description available.")
        
        openapi['paths'][path][method.lower()] = {
            "summary": handler_name.replace("handle_", "").replace("_", " ").title(),
            "description": desc,
            "responses": {
                "200": {
                    "description": "Successful response"
                }
            }
        }
        
    docs_dir = Path('docs')
    docs_dir.mkdir(exist_ok=True)
    with open(docs_dir / 'openapi.json', 'w', encoding='utf-8') as f:
        json.dump(openapi, f, indent=2)
    
if __name__ == '__main__':
    generate_openapi()
