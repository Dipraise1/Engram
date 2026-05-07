"""Tests for protocol imports in lightweight SDK/test environments."""

from __future__ import annotations

import subprocess
import sys


def test_protocol_imports_without_bittensor() -> None:
    code = r"""
import builtins

original_import = builtins.__import__

def guarded_import(name, *args, **kwargs):
    if name == "bittensor" or name.startswith("bittensor."):
        raise ModuleNotFoundError("No module named 'bittensor'")
    return original_import(name, *args, **kwargs)

builtins.__import__ = guarded_import

from engram.protocol import ChallengeSynapse, IngestSynapse, QuerySynapse

ingest = IngestSynapse(text="memory", metadata={"source": "test"})
ingest.cid = "v1::abc"
assert ingest.deserialize() == "v1::abc"

query = QuerySynapse(query_text="memory", top_k=3)
query.results = [{"cid": "v1::abc", "score": 1.0}]
assert query.deserialize() == [{"cid": "v1::abc", "score": 1.0}]

challenge = ChallengeSynapse(cid="v1::abc", nonce_hex="00" * 32, expires_at=1)
challenge.embedding_hash = "aa"
challenge.proof = "bb"
assert challenge.deserialize() == {"embedding_hash": "aa", "proof": "bb"}
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
