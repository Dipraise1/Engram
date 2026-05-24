# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ |
| Older tags | ❌ — update to `main` |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@theengram.space** with:

1. A description of the vulnerability and its impact.
2. Steps to reproduce (proof-of-concept if available).
3. The component affected (`engram-core`, miner, validator, SDK, web).

You will receive an acknowledgment within **48 hours** and a status update within **7 days**.

## Scope

In scope:
- Storage proof bypass or forgery (`engram-core`, `validator/challenge.py`)
- Private namespace data leakage (encryption, namespace auth, DP noise)
- Authentication bypass on miner HTTP endpoints
- Replay attacks on signed requests
- CID collision or content spoofing

Out of scope:
- Bittensor chain-level vulnerabilities (report to the Bittensor team)
- Issues only exploitable with physical access to the server
- Social engineering

## Disclosure Policy

We follow **coordinated disclosure**. We will work with you to understand and fix the issue before any public disclosure. Credit will be given in the release notes unless you prefer to remain anonymous.
