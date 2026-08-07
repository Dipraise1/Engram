# @engram/client

TypeScript SDK for Engram — the decentralized AI memory layer on Bittensor.
Mirrors the Python SDK so JS/TS agent stacks can ingest, query, and manage private namespaces on the Engram subnet.

## Install

npm install @engram/client

Requires Node 18+.

## Quick Start

```typescript
import { EngramClient } from "@engram/client";
const client = new EngramClient({ minerUrl: "http://127.0.0.1:8091" });
const { cid } = await client.ingest("The transformer architecture changed everything.");
const results = await client.query("attention mechanisms", { topK: 5 });
```

## API Methods

**EngramClient**

- `ingest(text, opts?)` - Store text in the network
- `ingestEmbedding(vector, metadata?, opts?)` - Store a pre-computed embedding
- `query(text, opts?)` - Search by text
- `queryByVector(vector, opts?)` - Search by embedding vector
- `get(cid)` - Retrieve by content ID
- `delete(cid)` - Delete by content ID
- `list(opts?)` - List entries
- `health()` - Get miner health info
- `isOnline()` - Quick miner reachability check
- `ingestUrl(url)` - Ingest content from a URL
- `ingestConversation(messages, opts?)` - Ingest a chat conversation
- `ingestImage(source, altText?, opts?)` - Ingest an image
- `ingestPdf(source)` - Ingest a PDF document
- `batchIngestFile(content)` - Batch-ingest lines or paragraphs
- `distributeKeyShares(urls, secret, threshold)` - Distribute a secret across miners
- `collectKeyShares(urls)` - Reconstruct a secret from miner shares

## Error Types

- `EngramError` - Base error class
- `MinerOfflineError` - Miner unreachable
- `IngestError` - Miner rejects ingest
- `QueryError` - Miner returns query error
- `InvalidCIDError` - Malformed content ID
- `NamespaceAuthError` - Namespace auth misconfiguration

## Private Namespaces

```typescript
const client = new EngramClient({
  minerUrl: "http://127.0.0.1:8091",
  namespace: "my-secret-space",
  namespaceKey: "your-256-bit-hex-key",
});
```

## License

MIT

## Bounty

This SDK was built as part of the TypeScript SDK bounty (Issue #22).
Contact the Engram team via the collaboration template to claim the reward.
