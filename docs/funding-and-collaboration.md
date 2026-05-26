# Funding and Collaboration Plan

This document is the public funding and collaboration package for Engram. It is
written for grant reviewers, ecosystem partners, validators, miners, strategic
supporters, and contributors who need to understand what Engram is, what is live,
what is missing, and where support should go first.

## Short Pitch

Engram is a decentralized AI memory layer on Bittensor. It turns text, images,
PDFs, and URLs into content-addressed semantic memories, stores vectors across
miners, verifies storage with challenge-response proofs, and archives raw media
through Arweave.

AI agents are starting to depend on long-lived memory. Today that memory usually
lives in centralized vector databases. Engram's bet is that important AI memory
should be portable, verifiable, replicated, and economically incentivized.

## Current Status

- Live on Bittensor testnet as subnet UID 450.
- Working miner, validator, SDK, CLI, Rust core, and Next.js web app.
- Content-addressed CIDs for embeddings.
- Local 384-dimensional embedding model support.
- Arweave media upload path for images, PDFs, URLs, and encrypted private bytes.
- HMAC challenge-response storage proofs.
- Namespace authentication and trust-tier work in progress.
- Public dashboard and playground at https://theengram.space.

## Funding Thesis

Engram should seek funding in three lanes:

- Ecosystem-aligned strategic support: Bittensor validators, subnet accelerators,
  subnet investors, miners, and stakers who benefit when useful subnets grow.
- Storage and public-goods grants: Arweave, Filecoin, Gitcoin, and open-source
  infrastructure programs that fund decentralized storage, permanent data, and
  public goods.
- User-driven sponsorship: AI agent teams, RAG platforms, research archives, and
  data communities that need verifiable memory and can sponsor integrations.

The most credible ask is not "fund an idea." The stronger ask is "fund the next
mainnet-ready milestone for an already-running testnet subnet."

## Best-Fit Funding Targets

| Target | Why it fits | Suggested ask |
| --- | --- | --- |
| Yuma / Bittensor subnet ecosystem | Yuma describes itself as an accelerator for Bittensor teams and lists capital, technical advisory, compute, go-to-market, and community introductions as support areas. | Subnet acceleration, validator support, technical review, partner intros, and go-to-market help. |
| Bittensor validators and stakers | Bittensor subnet emissions depend on subnet value, miner performance, validator work, and TAO flow into subnets. | Validator participation, miner bootstrapping, staking support, and public subnet review. |
| Arweave ecosystem funding | Engram uses Arweave for permanent media storage, which aligns with Arweave's funding page for projects building on Arweave. | Grant for encrypted media permanence, retrieval UX, public datasets, and Arweave proof visibility. |
| Filecoin Foundation Grants / ProPGF | Filecoin funds open-source storage, retrieval, developer tooling, integrations, and research. ProPGF Batch 3 opens applications in June 2026. | Secondary decentralized blob backend, retrieval benchmarks, or cross-storage permanence research. |
| Gitcoin Grants | Gitcoin funds web3 public goods through seasonal grants, crowdfunding, and plural funding mechanisms. | Public-goods campaign for open-source AI memory infrastructure and developer tooling. |
| AI agent / RAG teams | Engram gives agents portable memory with deterministic CIDs and verifiable storage. | Paid pilots for SDK integrations, hosted endpoints, or private namespaces. |

## Near-Term Budget Packages

These are practical packages to sponsor. Amounts should be treated as planning
ranges, not financial, legal, tax, or investment advice.

| Package | Range | Deliverables |
| --- | --- | --- |
| Mainnet readiness sprint | USD 10k-25k | CI green, license/package cleanup, request signing, hardened deployment docs, testnet load report. |
| Proof hardening sprint | USD 8k-20k | Replace nonce-as-key proof design, Rust/PyO3 parity tests, validator compatibility, security notes. |
| Private memory sprint | USD 15k-40k | Threshold decryption design, private namespace tests, SDK docs, threat model update. |
| Replication reliability sprint | USD 8k-18k | Runtime repair worker, degraded CID recovery, miner churn simulation, dashboard metrics. |
| Arweave permanence sprint | USD 5k-15k | Better media archival, encrypted raw bytes by default for private namespaces, retrieval UX, examples. |
| Contributor bounty pool | USD 3k-10k | Small issues for docs, SDK integrations, tests, deployment scripts, and miner onboarding. |

## Collaboration Needs

| Role | What they would build |
| --- | --- |
| Bittensor operator | Run miners/validators, test emissions, document operational issues, help with mainnet strategy. |
| Rust / cryptography engineer | Harden proof primitives, add property tests, review PyO3 boundary behavior. |
| Distributed systems engineer | Build replication repair, failure simulation, miner health scoring, and recovery flows. |
| Security reviewer | Review web API signing, namespace auth, private memory, and secret handling. |
| AI integrations engineer | Improve LangChain, LlamaIndex, agent examples, benchmarking, and demos. |
| Developer relations writer | Turn the subnet into tutorials, grant updates, miner guides, and launch posts. |
| Design / frontend engineer | Improve the dashboard, CID explorer, playground, and contributor onboarding. |

## Grant Narrative

Engram contributes to decentralized infrastructure by making AI memory portable
and verifiable. Centralized vector databases are useful, but they create a single
point of failure for AI agents and retrieval systems. Engram uses Bittensor to
incentivize miners to store and serve semantic memory, and it uses content
addressing so memories are identified by what they encode rather than by the
server that happens to hold them.

The project already has a working testnet, miner, validator, SDK, CLI, web app,
Rust core, and Arweave integration. Funding would be used to harden the protocol,
improve replication, prepare for mainnet, and make the network easier for miners,
validators, and application developers to use.

## Outreach Copy

### Short DM

Engram is a live Bittensor testnet subnet for decentralized AI memory. It stores
semantic vectors across miners, verifies storage with proofs, and archives raw
media through Arweave. We are looking for ecosystem collaborators, validator
operators, and milestone funding to harden the subnet for mainnet. Repo:
https://github.com/Dipraise1/Engram. Demo: https://theengram.space.

### Grant Intro

Engram is building permanent, content-addressed semantic memory for AI agents.
The project is live on Bittensor testnet subnet 450 with a working miner,
validator, SDK, CLI, Rust proof/CID core, web dashboard, playground, and Arweave
media archival. We are requesting support to harden the network for mainnet:
storage proof security, private namespaces, replication repair, signed web
requests, and better developer onboarding.

### Collaborator Intro

We are looking for collaborators who want to help build a decentralized AI
memory subnet. The highest-impact areas are Bittensor miner/validator operations,
Rust proof hardening, private memory, replication repair, SDK integrations, and
security review. The codebase is open source and the testnet is live.

## What To Show Funders

- Live demo: https://theengram.space
- GitHub repo: https://github.com/Dipraise1/Engram
- Architecture: docs/architecture.md
- Protocol: docs/protocol.md
- Miner guide: docs/miner.md
- Validator guide: docs/validator.md
- SDK guide: docs/sdk.md
- Current priority issues: security, proof hardening, private namespaces,
  replication repair, deployment architecture, packaging, and licensing.
- Evidence: CI status, test results, running miner health, dashboard metrics,
  example CIDs, and screenshots of the playground.

## 30-Day Action Plan

1. Merge and deploy the critical security and correctness PRs.
2. Add the missing license and package extras so grant reviewers can consume the
   project cleanly.
3. Publish a mainnet-readiness roadmap with milestones, budget, and risks.
4. Contact Yuma and Bittensor ecosystem validators with a concise subnet memo.
5. Apply to Arweave-aligned funding for encrypted permanent media and retrieval
   UX.
6. Prepare Filecoin grant material only if Engram adds or commits to a Filecoin
   storage/retrieval integration.
7. Create a Gitcoin/public-goods page once the license, docs, screenshots, and
   contributor issues are polished.
8. Recruit three collaborator types first: Bittensor operator, Rust/security
   engineer, and AI integrations engineer.

## Guardrails

- Do not sell token, equity, revenue-share, or investment exposure without legal
  advice.
- Keep grant asks milestone-based and technical.
- Do not overclaim production readiness while the project is on testnet.
- Keep security issues public enough for trust, but avoid publishing exploit
  details before fixes are merged.
- Prefer sponsors who bring ecosystem distribution, operators, and technical
  review, not only cash.

## Source Links

- Bittensor subnet overview: https://docs.learnbittensor.org/subnets/understanding-subnets
- Bittensor emissions: https://docs.learnbittensor.org/learn/emissions
- Yuma services: https://www.yumaai.com/services
- Arweave funding: https://www.arweave.org/funding
- Filecoin grants: https://fil.org/grants
- Filecoin ProPGF: https://filpgf.io/propgf/
- Gitcoin grants program: https://www.gitcoin.co/program
