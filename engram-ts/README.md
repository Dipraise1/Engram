# @engram/client

TypeScript SDK for [Engram](https://github.com/Dipraise1/Engram) — a decentralized vector database on Bittensor.

Mirrors the [Python SDK](https://github.com/Dipraise1/Engram/tree/main/engram/sdk) API.

## Installation

```bash
npm install @engram/client
```

## Quick Start

```typescript
import { EngramClient } from "@engram/client";

const client = new EngramClient({ minerUrl: "http://127.0.0.1:8091" });

// Store a memory
const cid = await client.ingest("Transformers changed deep learning.");
console.log("Stored as:", cid);

// Search
const results = await client.query("deep learning", 5);
for (const r of results) {
  console.log(r.cid, r.score, r.metadata);
}
```

## API

### EngramClient

| Method | Description |
|--------|-------------|
| `ingest(text, metadata?)` | Embed and store text |
| `ingestEmbedding(embedding, metadata?)` | Store a pre-computed vector |
| `query(text, topK?, filter?)` | Semantic search |
| `queryByVector(vector, topK?)` | Search by vector |
| `get(cid)` | Retrieve by CID |
| `delete(cid)` | Delete by CID |
| `list(filter?, limit?, offset?)` | List records |
| `health()` | Miner liveness check |
| `isOnline()` | Returns boolean |
| `batchIngestFile(path)` | Ingest from JSONL |
| `ingestUrl(url)` | Fetch and store URL |
| `ingestConversation(messages)` | Store conversation |

### Encryption

```typescript
import { generateKeypair, HybridEncryption, NamespaceEncryption } from "@engram/client";

// X25519 + HKDF + AES-256-GCM (recommended)
const [priv, pub] = generateKeypair();
const enc = new HybridEncryption({ privateKey: priv });
const blob = await enc.encryptPayload("secret", { tags: ["demo"] });
const [text, meta] = await enc.decryptPayload(blob);

// Password-based (legacy)
const enc2 = await NamespaceEncryption.create("my-ns", "my-key");
```

### Shamir Secret Sharing

```typescript
import { splitSecret, reconstructSecret } from "@engram/client";

const secret = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const shares = splitSecret(secret, 2, 3);  // 2-of-3 threshold

const recovered = reconstructSecret(shares.slice(0, 2));
```

### Error Handling

```typescript
import { EngramError, MinerOfflineError, IngestError, QueryError } from "@engram/client";

try {
  await client.ingest("hello");
} catch (err) {
  if (err instanceof MinerOfflineError) {
    console.log("Miner unreachable:", err.url);
  }
}
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
