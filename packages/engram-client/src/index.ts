/**
 * @engram/client — TypeScript SDK for Engram decentralized AI memory
 *
 * Entry point — exports all public types and classes.
 */

export { EngramClient } from "./client";
export {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from "./errors";
export {
  HybridEncryption,
  NamespaceEncryption,
  generateX25519Keypair,
} from "./encryption";
export { parseCID, isValidCID } from "./cid";
export { buildNamespaceAuth, signSr25519, generateKeypairFromSeed } from "./namespace";

export type {
  EngramClientOptions,
  HealthResponse,
  QueryResult,
  IngestMetadata,
  ImageIngestResult,
  PDFIngestResult,
  URLIngestResult,
  Record as EngramRecord,
  ListOptions,
  ConversationMessage,
  Sr25519Keypair,
  EncryptedPayload,
  NamespaceAuth,
  KeyShare,
} from "./types";
