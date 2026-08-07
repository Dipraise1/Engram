---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: acb9c50358234750b38baff6e88cca8d_4977ea286ae111f18805525400d9a7a1
    ReservedCode1: 5PtZXgpyNUqM6Bm/IEWxQASD4dT4L4V6xhfs4OB6FrFb5SfQi+4Z5TOAowk7MEdp0FMplThuY13wXmEWeit0C7DueQTx4KnVe5BPWyem/dJ4OM9POvOshq/yGyVx6f75y4j+ONcus3WbfCYQwUnbpex+Fe5CtYqC7Hxm+zEXslr9XIpcBBLX7Un+CoA=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: acb9c50358234750b38baff6e88cca8d_4977ea286ae111f18805525400d9a7a1
    ReservedCode2: 5PtZXgpyNUqM6Bm/IEWxQASD4dT4L4V6xhfs4OB6FrFb5SfQi+4Z5TOAowk7MEdp0FMplThuY13wXmEWeit0C7DueQTx4KnVe5BPWyem/dJ4OM9POvOshq/yGyVx6f75y4j+ONcus3WbfCYQwUnbpex+Fe5CtYqC7Hxm+zEXslr9XIpcBBLX7Un+CoA=
---

# @engram/client

TypeScript SDK for the [Engram](https://engram.org) decentralized knowledge graph.

Mirrors the Python SDK (`engram/sdk/client.py`) with full TypeScript type safety.

## Installation

```bash
npm install @engram/client
```

For sr25519 namespace signing support (optional):

```bash
npm install @polkadot/util-crypto
```

## Quick Start

```typescript
import { EngramClient } from '@engram/client';

const client = new EngramClient({
  miner_url: 'http://127.0.0.1:8091',
  timeout: 30000,
});

// Ingest text
const cid = await client.ingest('Hello, Engram!', { source: 'tutorial' });
console.log('Ingested:', cid);

// Query
const results = await client.query('Hello', 5);
for (const r of results) {
  console.log(`${r.cid}: score=${r.score}`);
}

// Health check
const health = await client.health();
console.log('Miner status:', health.status);

// Check if online
const online = await client.isOnline();
```

## Namespace Authentication

```typescript
import { EngramClient } from '@engram/client';
import { Keyring } from '@polkadot/keyring';

const keyring = new Keyring({ type: 'sr25519' });
const pair = keyring.addFromUri('//Alice');

const client = new EngramClient({
  namespace: 'my-namespace',
  keypair: pair,
});

// Requests will include sr25519-signed namespace auth headers
await client.ingest('secured data');
```

## API Reference

### Constructor

```typescript
new EngramClient(options?: EngramClientOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `miner_url` | `string` | `http://127.0.0.1:8091` | Miner endpoint URL |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `namespace` | `string` | — | Namespace for data isolation |
| `namespace_key` | `string` | — | Plain namespace key |
| `keypair` | `KeyringPair` | — | sr25519 keypair for signed auth |

### Core Methods

- **`ingest(text, metadata?)`** → `Promise<string>` — Ingest text, returns CID
- **`ingestEmbedding(embedding, metadata?)`** → `Promise<string>` — Ingest a pre-computed vector
- **`query(text, topK?, filter?)`** → `Promise<QueryResult[]>` — Semantic search
- **`queryByVector(vector, topK?)`** → `Promise<QueryResult[]>` — Vector search
- **`get(cid)`** → `Promise<Record>` — Retrieve by CID
- **`delete(cid)`** → `Promise<boolean>` — Delete by CID
- **`list(filter?, limit?, offset?)`** → `Promise<Record[]>` — List records
- **`health()`** → `Promise<HealthResponse>` — Health check
- **`isOnline()`** → `Promise<boolean>` — Check miner availability

### Content Ingestion

- **`ingestImage(source, xaiApiKey, model?)`** → `Promise<ImageIngestResult>` — Describe via xAI vision, then ingest
- **`ingestPdf(source)`** → `Promise<PdfIngestResult>` — Extract and ingest PDF text
- **`ingestUrl(url)`** → `Promise<UrlIngestResult>` — Fetch and ingest web page content
- **`ingestConversation(messages, sessionId?)`** → `Promise<string[]>` — Ingest conversation messages
- **`batchIngestFile(path, options?)`** → `Promise<string[] | [string[], string[]]>` — Batch ingest from JSONL file

### Error Classes

| Class | Description |
|-------|-------------|
| `EngramError` | Base error class |
| `MinerOfflineError` | Miner unreachable |
| `IngestError` | Ingestion failure |
| `QueryError` | Query failure |
| `InvalidCIDError` | CID not found or malformed |

## Development

```bash
git clone https://github.com/engramhq/engram-client.git
cd engram-client
npm install
npm test          # Run tests (vitest)
npm run build     # Compile TypeScript
```

## License

MIT
*（内容由AI生成，仅供参考）*
