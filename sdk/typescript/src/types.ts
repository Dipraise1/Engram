/**
 * TypeScript type definitions for Engram SDK.
 */

/** Metadata associated with a knowledge record. */
export interface Metadata {
  [key: string]: unknown;
}

/** Result returned by query / query_by_vector. */
export interface QueryResult {
  cid: string;
  score: number;
  metadata: Metadata;
}

/** A single knowledge record from list / get. */
export interface EngramRecord {
  cid: string;
  metadata: Metadata;
}

/** Health check response. */
export interface HealthResponse {
  status: string;
  vectors: number;
  uid: string;
}

/** Generic API response wrapper. */
export interface ApiResponse {
  [key: string]: unknown;
}

/** Ingestion options shared across ingest methods. */
export interface IngestOptions {
  metadata?: Metadata;
}

/** Response from ingest_image. */
export interface ImageIngestResult {
  cid: string;
  description: string;
  content_cid: string;
  filename: string;
}

/** Response from ingest_pdf. */
export interface PdfIngestResult {
  cid: string;
  pages: number;
  chars: number;
  content_cid: string;
  filename: string;
}

/** Response from ingest_url. */
export interface UrlIngestResult {
  cid: string;
  url: string;
  title: string;
  chars: number;
}

/** A single message in a conversation. */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Batch ingest file options. */
export interface BatchIngestOptions {
  return_errors?: boolean;
}

/** Filter for queries and lists. */
export interface Filter {
  [key: string]: unknown;
}

/** Constructor options for EngramClient. */
export interface EngramClientOptions {
  miner_url?: string;
  timeout?: number;
  namespace?: string;
  namespace_key?: string;
  keypair?: unknown; // sr25519 keypair from @polkadot/util-crypto
}
