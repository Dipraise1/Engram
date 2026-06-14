/** Query result item returned by QuerySynapse */
export interface QueryResult {
  cid: string
  score: number
  metadata: Record<string, unknown>
}

/** Response from an ingest operation */
export interface IngestResponse {
  cid: string
}

/** Response from a query operation */
export interface QueryResponse {
  results: QueryResult[]
  latency_ms?: number
}

/** Response from the health endpoint */
export interface HealthResponse {
  status: string
  version?: string
}

/** Options for the EngramClient constructor */
export interface EngramClientOptions {
  /** Base URL of the miner HTTP server (default: http://127.0.0.1:8091) */
  minerUrl?: string
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Private namespace name */
  namespace?: string
  /** Legacy namespace key (deprecated, prefer keypair) */
  namespaceKey?: string
  /** sr25519 keypair for request signing */
  keypair?: Sr25519Keypair
}

/** Minimal sr25519 keypair interface */
export interface Sr25519Keypair {
  /** Sign a message, returning hex string */
  sign(message: Uint8Array): Uint8Array
  /** SS58 address of the public key */
  ss58Address: string
}

/** Auto-generated request signing fields */
export interface SignedFields {
  hotkey: string
  nonce: number
  signature: string
}

/** Auth fields for namespace access */
export interface NamespaceAuth {
  namespace?: string
  namespace_hotkey?: string
  namespace_sig?: string
  namespace_timestamp_ms?: number
  namespace_key?: string
}
