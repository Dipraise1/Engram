/**
 * Engram SDK — TypeScript type definitions.
 */

/** Metadata attached to stored memories. */
export type Metadata = Record<string, string>;

/** A single search result returned by query(). */
export interface QueryResult {
  cid: string;
  score: number;
  metadata: Metadata;
}

/** Response from the health endpoint. */
export interface HealthResponse {
  status: string;
  vectors: number;
  uid: number;
}

/** Record returned by get() and list(). */
export interface MemoryRecord {
  cid: string;
  metadata: Metadata;
}

/** Options for constructing an EngramClient. */
export interface ClientOptions {
  /** Base URL of the miner HTTP server. @default "http://127.0.0.1:8091" */
  minerUrl?: string;
  /** Request timeout in milliseconds. @default 30000 */
  timeout?: number;
  /** Private namespace name for encrypted storage. */
  namespace?: string;
  /** Secret key for the namespace. */
  namespaceKey?: string;
}
