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

- [ ] **Erasure coding** — replace 3× replication with (k, n) shards so any k recover the vector; reduces redundancy cost and improves durability
- [ ] **Mainnet registration** — register subnet on Bittensor mainnet; validator weight-setting live
- [ ] **TLS on all miner endpoints** — nginx reverse proxy + Let's Encrypt; `MINER_USE_HTTPS=true` by default
- [ ] **Slash execution** — validators submit slashing transactions for miners below the proof-rate threshold
- [ ] **Staking gate on ingest** — minimum TAO stake required to write to the network (anti-spam)
- [ ] **Stake-weighted replication** — assign replicas to highest-stake miners to align incentives
- [ ] **Miner reputation score** — persistent per-miner reliability record fed into assignment
- [ ] **Validator consensus** — multi-validator agreement on scores before weight-setting
- [ ] **PyPI stable release** — `engram-subnet 1.0.0` with stable API contract

**Help wanted:** erasure coding implementation, TLS automation, slashing transaction tests.

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
| TypeScript SDK | TBD | open |
| Erasure coding (k,n) | TBD | open |
| OpenAPI spec generation | TBD | open |
| Recall benchmark suite | TBD | open |

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
