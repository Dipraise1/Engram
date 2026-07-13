/**
 * Engram SDK — Type definitions mirroring the Python SDK.
 */

/** Response from a health check. */
export interface HealthResponse {
  status: string;
  vectors?: number;
  uid?: number;
}

/** Generic metadata record. */
export type MetadataRecord = { [key: string]: unknown };

/** A single result from a query. */
export interface QueryResult {
  cid: string;
  score: number;
  metadata: MetadataRecord;
}

/** Ingest response. */
export interface IngestResponse {
  cid: string;
}

/** Batch ingest result. */
export interface BatchIngestResult {
  cids: string[];
  errors: string[];
}

/** Metadata stored alongside a vector. */
export interface IngestMetadata {
  [key: string]: unknown;
  text?: string;
  type?: string;
  source?: string;
  role?: string;
  session?: string;
  ts?: string;
}

/** Image ingest result. */
export interface ImageIngestResult {
  cid: string;
  description: string;
  content_cid: string;
  filename?: string;
  arweave_tx_id?: string;
  arweave_url?: string;
}

/** PDF ingest result. */
export interface PDFIngestResult {
  cid: string;
  pages: number;
  chars: number;
  content_cid: string;
  filename?: string;
  arweave_tx_id?: string;
  arweave_url?: string;
}

/** URL ingest result. */
export interface URLIngestResult {
  cid: string;
  url: string;
  title: string;
  chars: number;
  arweave_tx_id?: string;
  arweave_url?: string;
}

/** A retrieved record (get/list). */
export interface Record {
  cid: string;
  metadata: MetadataRecord;
}

/** List options. */
export interface ListOptions {
  filter?: { [key: string]: string };
  limit?: number;
  offset?: number;
}

/** Conversation message. */
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Encrypted payload wire format. */
export interface EncryptedPayload {
  ciphertext: string; // base64url
}

/** Options for creating an EngramClient. */
export interface EngramClientOptions {
  minerUrl?: string;
  timeout?: number;
  namespace?: string;
  namespaceKey?: string;
  /** sr25519 keypair for request signing (hex seed or JSON). */
  keypair?: Sr25519Keypair;
}

/** sr25519 keypair. */
export interface Sr25519Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** Namespace auth fields sent in requests. */
export interface NamespaceAuth {
  namespace?: string;
  namespace_key?: string;
  namespace_hotkey?: string;
  namespace_sig?: string;
  namespace_timestamp_ms?: number;
}

/** Shielded coin info (from Midnight, re-exported for compatibility). */
export interface ShieldedCoinInfo {
  nonce: Uint8Array;
  color: Uint8Array;
  value: bigint;
}

/** Key share for Shamir's secret sharing. */
export interface KeyShare {
  index: number;
  data: Uint8Array;
  threshold: number;
  total: number;
}
