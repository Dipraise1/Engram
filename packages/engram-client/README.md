# @engram/client

TypeScript SDK for [Engram](https://github.com/Dipraise1/Engram) — decentralized AI memory on Bittensor subnet 450.

Mirrors the Python `engram-subnet` SDK. Supports ingest, query, private namespaces with X25519 hybrid encryption, sr25519 request signing, and CID validation.

## Installation

```bash
npm install @engram/client
```

## Quick Start

```typescript
import { EngramClient } from "@engram/client";

const client = new EngramClient("http://127.0.0.1:8091");

// Store text
const cid = await client.ingest("The transformer architecture changed everything.");
console.log("Stored:", cid);

// Semantic search
const results = await client.query("attention mechanisms", top_k: 5);
for (const r of results) {
  console.log(r.cid, r.score);
}

// Health check
const health = await client.health();
console.log("Status:", health.status);
```

## Private Namespaces

```typescript
const client = new EngramClient({
  minerUrl: "http://127.0.0.1:8091",
  namespace: "my-namespace",
  namespaceKey: "my-secret-key",
});

// Data is encrypted client-side before sending to the miner
const cid = await client.ingest("This is private");
```

## sr25519 Signing

```typescript
import { generateKeypairFromSeed } from "@engram/client";

const keypair = generateKeypairFromSeed("my-seed-phrase");

const client = new EngramClient({
  minerUrl: "http://127.0.0.1:8091",
  keypair,
});
```

## API

### Core Methods

| Method | Description |
|--------|-------------|
| `ingest(text, metadata?)` | Embed and store text |
| `ingestEmbedding(vector, metadata?)` | Store pre-computed embedding |
| `query(text, top_k?, filter?)` | Semantic search |
| `queryByVector(vector, top_k?)` | Search by vector |
| `get(cid)` | Retrieve by CID |
| `delete(cid)` | Delete by CID |
| `list(opts?)` | List stored memories |
| `batchIngest(jsonl)` | Ingest JSONL data |
| `ingestConversation(messages, sessionId?)` | Store conversation |
| `ingestURL(url)` | Fetch and store URL |
| `health()` | Check miner liveness |
| `isOnline()` | Quick online check |

### Error Types

- `EngramError` — base
- `MinerOfflineError` — miner unreachable
- `IngestError` — ingest failed
- `QueryError` — query failed
- `InvalidCIDError` — CID validation failed

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
