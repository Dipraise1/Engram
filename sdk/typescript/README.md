# @engram/client

TypeScript client for the [Engram](https://github.com/Dipraise1/Engram) decentralized vector database.

Mirrors the Python `engram.sdk` API so JS/TS agent stacks can use Engram for semantic memory.

## Install

```bash
npm install @engram/client
```

## Quick Start

```typescript
import { EngramClient } from "@engram/client";

const client = new EngramClient({
  minerUrl: "http://127.0.0.1:8091",
});

// Store a memory
const cid = await client.ingest("The transformer architecture changed everything.");
console.log("Stored:", cid);

// Search
const results = await client.query("attention mechanisms in deep learning", {
  topK: 5,
});
for (const r of results) {
  console.log(r.cid, r.score);
}
```

## API

### `new EngramClient(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minerUrl` | `string` | `"http://127.0.0.1:8091"` | Miner HTTP endpoint |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `namespace` | `string` | — | Private namespace name |
| `namespaceKey` | `string` | — | Namespace encryption key |

### Methods

- **`ingest(text, metadata?)`** — Store text, returns CID
- **`ingestEmbedding(vector, metadata?)`** — Store a pre-computed embedding
- **`query(text, options?)`** — Semantic search, returns `QueryResult[]`
- **`queryByVector(vector, topK?)`** — Search by vector
- **`get(cid)`** — Retrieve a memory by CID
- **`delete(cid)`** — Delete a memory
- **`list(options?)`** — List memories with optional filter
- **`ingestConversation(messages, options?)`** — Store a conversation
- **`health()`** — Check miner liveness
- **`isOnline()`** — Boolean health check

### Errors

All errors extend `EngramError`:

- `MinerOfflineError` — miner unreachable
- `IngestError` — storage failed
- `QueryError` — search failed
- `InvalidCIDError` — malformed CID from miner

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
