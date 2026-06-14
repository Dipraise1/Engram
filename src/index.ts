/**
 * Engram TypeScript SDK — public API surface.
 */

export { EngramClient } from "./client";
export {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
  NamespaceAuthError,
} from "./errors";
export type {
  EngramClientOptions,
  IngestResponse,
  QueryResult,
  HealthResponse,
  ListEntry,
  KeyShare,
  ConversationMessage,
  EncryptionEngine,
  Sr25519Keypair,
  SubnetEntry,
} from "./types";
export { computeCID, sha256, hexEncode, hexDecode } from "./utils";
