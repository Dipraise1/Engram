# Engram Roadmap

> Decentralized AI memory — from testnet to mainnet to the permanent internet.

This document tracks where Engram is, where it's going, and what contributions move it forward. Pull requests and issues are welcome at any stage.

---

## Phase 1 — Testnet Foundation ✅

*Goal: prove the protocol works end-to-end on Bittensor testnet (subnet 450).*

- [x] Content-addressed vector storage (CID = deterministic hash of embedding)
- [x] 3× replication across miners with DHT-based assignment
- [x] HMAC-SHA256 storage proof challenge-response
- [x] Merkle commitment over full miner corpus
- [x] Private namespaces with X25519 hybrid encryption + differential privacy noise
- [x] Arweave permanent blob pinning (images, PDFs, raw media)
- [x] Validator scoring: recall@K + latency + storage proof rate
- [x] Runtime repair worker for under-replicated CIDs
- [x] Shamir threshold decryption (K-of-N key shares across miners)
- [x] sr25519 signed requests — key never travels over the wire
- [x] Mobile mining via managed Akash Network nodes
- [x] Python SDK (`pip install engram-subnet`) with LangChain + LlamaIndex integrations
- [x] Live dashboard at [theengram.space](https://theengram.space)
- [x] CI pipeline: Python tests + Rust build + Docker image

---

## Phase 2 — Mainnet Readiness 🔨 *in progress*

*Goal: harden the protocol for economic stake and real data.*

- [x] **Erasure coding** — (k, n) shards so any k recover the vector; 1.67× overhead vs 3× replication
- [ ] **Mainnet registration** — register subnet on Bittensor mainnet; validator weight-setting live
- [x] **TLS on miner endpoints** — `https://api.theengram.space` routes to the miner; nginx + Let's Encrypt
- [x] **Slash execution** — slash registry; validators record miners below the proof-rate threshold
- [x] **Staking gate on ingest** — minimum TAO stake required to write to the network (anti-spam)
- [x] **Stake-weighted replication** — `ReplicationManager.register(reliability_map=...)` blends XOR proximity (60%) with miner reliability score (40%) to prefer proven miners for replica assignment
- [x] **Miner reputation score** — persistent per-miner reliability record (`ReputationStore`) fed into `RewardManager`; EMA score + confidence discount for new miners; `reliability_map()` available to replication assignment
- [x] **Validator consensus** — multi-validator agreement on scores before weight-setting
- [ ] **PyPI stable release** — `engram-subnet 1.0.0` with stable API contract

**Help wanted:** mainnet registration dry-runs, slashing transaction tests, 1.0.0 API audit.

---

## Phase 3 — Developer Experience 📦

*Goal: make Engram the easiest decentralized memory layer to integrate.*

- [ ] **TypeScript SDK** — `@engram/client` mirroring the Python SDK
- [ ] **REST API docs** — OpenAPI spec for all miner endpoints (auto-generated from code)
- [ ] **Agent examples** — reference implementations for AutoGPT, CrewAI, LangGraph
- [ ] **Retrieval benchmarks** — recall@K vs Pinecone, Weaviate, pgvector on public datasets
- [ ] **Semantic caching** — deduplicate equivalent embeddings before storage
- [ ] **Namespace access control** — multi-owner namespaces with per-key write permissions
- [ ] **Streaming ingest** — chunked upload for large document collections

**Help wanted:** TypeScript SDK, agent examples, OpenAPI spec generation.

---

## Phase 4 — Permanence & Decentralized Storage 🌐

*Goal: make Engram data truly permanent, not just replicated.*

- [ ] **IPFS pinning integration** — CID pinned to IPFS on every ingest
- [ ] **Filecoin deals** — long-term Filecoin storage deal for high-value namespaces
- [ ] **Cross-subnet memory** — validators relay curated memories to other Bittensor subnets
- [ ] **Verifiable retrieval** — ZK proof that a query result was computed correctly
- [ ] **Decentralized validator** — eliminate single-validator trust assumption

---

## Open Bounties

Issues marked [`bounty`](https://github.com/Dipraise1/Engram/labels/bounty) have rewards attached. Contact the team via the collaboration issue template or Discord to claim.

| Issue | Bounty | Status |
|-------|--------|--------|
| TypeScript SDK ([#22](https://github.com/Dipraise1/Engram/issues/22)) | TBD | open |
| OpenAPI spec generation ([#23](https://github.com/Dipraise1/Engram/issues/23)) | TBD | open |
| Recall benchmark suite ([#24](https://github.com/Dipraise1/Engram/issues/24)) | TBD | open |

---

## Good First Issues

New to the codebase? Start here:

- Issues labeled [`good first issue`](https://github.com/Dipraise1/Engram/labels/good%20first%20issue)
- Reproduce a bug and add a failing test
- Add a setup guide with exact commands and expected output
- Add an agent example (LangChain, CrewAI, LlamaIndex)
- Improve error messages in the CLI or SDK

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. In short:
1. Find or open a GitHub issue.
2. Open a PR — keep the scope small.
3. Add tests. All CI checks must pass.

Questions? Open a [Discussion](https://github.com/Dipraise1/Engram/discussions).
