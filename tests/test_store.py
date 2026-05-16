"""Tests for FAISSStore and QdrantStore.list() (no external dependencies needed)."""

from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from engram.miner.store import FAISSStore, VectorRecord


_PUBLIC = "__public__"
_VEC = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)


@pytest.fixture
def store():
    return FAISSStore(dim=4)


def make_record(cid: str, vec: list[float], ns: str = _PUBLIC, meta: dict | None = None) -> VectorRecord:
    return VectorRecord(
        cid=cid,
        embedding=np.array(vec, dtype=np.float32),
        metadata=meta or {"source": "test"},
        namespace=ns,
    )


def test_upsert_and_count(store):
    store.upsert(make_record("cid1", [1.0, 0.0, 0.0, 0.0]))
    assert store.count() == 1


def test_search_returns_results(store):
    store.upsert(make_record("cid1", [1.0, 0.0, 0.0, 0.0]))
    store.upsert(make_record("cid2", [0.0, 1.0, 0.0, 0.0]))
    results = store.search(np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32), top_k=2)
    assert len(results) > 0
    assert results[0].cid == "cid1"


def test_get_existing(store):
    store.upsert(make_record("cid1", [1.0, 0.0, 0.0, 0.0]))
    record = store.get("cid1")
    assert record is not None
    assert record.cid == "cid1"


def test_get_missing(store):
    assert store.get("nonexistent") is None


def test_delete(store):
    store.upsert(make_record("cid1", [1.0, 0.0, 0.0, 0.0]))
    assert store.delete("cid1")
    assert store.get("cid1") is None


def test_search_empty(store):
    results = store.search(np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32))
    assert results == []


# ── list() — FAISSStore (authoritative reference behaviour) ───────────────────

def test_list_public_namespace(store):
    store.upsert(make_record("pub1", [1.0, 0.0, 0.0, 0.0], ns=_PUBLIC))
    store.upsert(make_record("priv1", [1.0, 0.0, 0.0, 0.0], ns="team_ns"))
    results = store.list(namespace=_PUBLIC)
    cids = {r["cid"] for r in results}
    assert "pub1" in cids
    assert "priv1" not in cids


def test_list_private_namespace(store):
    store.upsert(make_record("pub1", [1.0, 0.0, 0.0, 0.0], ns=_PUBLIC))
    store.upsert(make_record("priv1", [1.0, 0.0, 0.0, 0.0], ns="team_ns"))
    results = store.list(namespace="team_ns")
    cids = {r["cid"] for r in results}
    assert "priv1" in cids
    assert "pub1" not in cids


def test_list_metadata_shape(store):
    store.upsert(make_record("cid1", [1.0, 0.0, 0.0, 0.0], meta={"author": "alice", "tag": "ml"}))
    results = store.list(namespace=_PUBLIC)
    assert len(results) == 1
    assert results[0]["cid"] == "cid1"
    assert results[0]["metadata"] == {"author": "alice", "tag": "ml"}


def test_list_pagination(store):
    for i in range(5):
        store.upsert(make_record(f"cid{i}", [float(i), 0.0, 0.0, 0.0]))
    page1 = store.list(limit=2, offset=0)
    page2 = store.list(limit=2, offset=2)
    assert len(page1) == 2
    assert len(page2) == 2
    assert {r["cid"] for r in page1}.isdisjoint({r["cid"] for r in page2})


# ── list() — QdrantStore (mocked client) ─────────────────────────────────────

def _make_qdrant_point(cid: str, ns: str, meta: dict) -> MagicMock:
    point = MagicMock()
    point.payload = {"cid": cid, "_ns": ns, **meta}
    return point


@pytest.fixture
def qdrant_store():
    from engram.miner.store import QdrantStore
    client = MagicMock()
    store = QdrantStore.__new__(QdrantStore)
    store._client = client
    store._collection = "test_col"
    yield store, client


def test_qdrant_list_filters_on_ns(qdrant_store):
    store, client = qdrant_store
    pub_point = _make_qdrant_point("pub1", _PUBLIC, {"tag": "a"})
    priv_point = _make_qdrant_point("priv1", "team_ns", {"tag": "b"})
    client.scroll.return_value = ([pub_point], None)

    results = store.list(namespace=_PUBLIC)

    call_kwargs = client.scroll.call_args.kwargs
    flt = call_kwargs["scroll_filter"]
    condition = flt.must[0]
    assert condition.key == "_ns"
    assert condition.match.value == _PUBLIC


def test_qdrant_list_metadata_strips_internals(qdrant_store):
    store, client = qdrant_store
    point = _make_qdrant_point("cid1", _PUBLIC, {"author": "bob"})
    client.scroll.return_value = ([point], None)

    results = store.list(namespace=_PUBLIC)

    assert len(results) == 1
    assert results[0]["cid"] == "cid1"
    assert results[0]["metadata"] == {"author": "bob"}
    assert "_ns" not in results[0]["metadata"]
    assert "cid" not in results[0]["metadata"]


def test_qdrant_list_private_namespace_filter(qdrant_store):
    store, client = qdrant_store
    client.scroll.return_value = ([], None)

    store.list(namespace="team_ns")

    call_kwargs = client.scroll.call_args.kwargs
    condition = call_kwargs["scroll_filter"].must[0]
    assert condition.key == "_ns"
    assert condition.match.value == "team_ns"
