# Contributing to Engram

Engram is a Bittensor subnet for decentralized AI memory. Contributions are most
valuable when they improve mainnet readiness, protocol safety, miner/validator
operations, SDK usability, or public documentation.

## High-Impact Areas

- Storage proof hardening in `engram-core` and validator challenge code.
- Private namespaces, request signing, and security review.
- Replication repair and miner failure recovery.
- Miner and validator setup, monitoring, and reliability docs.
- SDK examples for LangChain, LlamaIndex, agents, media ingestion, and retrieval.
- Tests that cover protocol compatibility, namespace auth, and storage behavior.
- Web dashboard and playground improvements that make the live subnet easier to
  inspect.

## Good First Contributions

- Reproduce an open issue and add a failing test.
- Improve a setup guide with exact commands and expected output.
- Add SDK examples for a real agent or RAG workflow.
- Add monitoring or health-check documentation for miners.
- Improve error messages and validation around user-facing CLI or SDK flows.

## Collaboration Process

1. Pick or open a GitHub issue that describes the problem.
2. Keep the scope small enough to review in one pull request.
3. Add tests or a clear manual verification note.
4. Avoid unrelated formatting and refactors.
5. For security-sensitive work, describe impact without publishing exploit
   details before a fix is ready.

## Local Checks

```bash
python -m pytest tests/ -q
cargo test --manifest-path engram-core/Cargo.toml --no-default-features
```

If your environment uses the repo virtualenv, run:

```bash
.venv/bin/python -m pytest tests/ -q
```

## Collaboration Contact

Open a GitHub issue for technical collaboration. For funding, sponsorship, or
ecosystem partnership discussions, see `FUNDING.md` and
`docs/funding-and-collaboration.md`.
