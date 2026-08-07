/**
 * @engram/client — TypeScript SDK for Engram decentralized knowledge graph.
 */

export { EngramClient } from './client.js';
export {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from './errors.js';
export { namespaceAuth, isSr25519Available } from './crypto.js';
export type {
  ApiResponse,
  BatchIngestOptions,
  ConversationMessage,
  EngramClientOptions,
  Filter,
  HealthResponse,
  ImageIngestResult,
  IngestOptions,
  Metadata,
  PdfIngestResult,
  QueryResult,
  EngramRecord,
  UrlIngestResult,
} from './types.js';
