import json
import os
import sys
from fastapi.openapi.utils import get_openapi

# Add the root directory to sys.path to allow importing neurons
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def generate_spec():
    try:
        # In Bittensor, the miner usually initializes a FastAPI app within the Axon
        # We import the app instance from the miner module
        from neurons.miner import app 
    except ImportError:
        print("Error: Could not find neurons.miner or FastAPI 'app' instance.")
        # Fallback/Mock for demonstration if the environment isn't fully set up
        return

    openapi_schema = get_openapi(
        title="Engram Miner API",
        version="1.0.0",
        description="API for Engram Subnet Miners - Decentralized AI Memory Layer",
        routes=app.routes,
    )

    # Add sr25519 Auth Scheme
    openapi_schema["components"]["securitySchemes"] = {
        "BittensorAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "B-Signature",
            "description": "sr25519 signature of the request. Requires B-Hotkey, B-Nonce, and B-Signature-V2 headers."
        }
    }
    
    # Apply security globally
    openapi_schema["security"] = [{"BittensorAuth": []}]

    with open("docs/openapi.json", "w") as f:
        json.dump(openapi_schema, f, indent=2)
    print("Successfully generated docs/openapi.json")

if __name__ == "__main__":
    generate_spec()
