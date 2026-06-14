/**
 * Engram SDK — TypeScript type definitions.
 */

export interface IngestResponse {
  cid: string;
  namespace?: string;
}

export interface QueryResult {
  cid: string;
  score: number;
  text?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

export interface MinerInfo {
  hotkey: string;
  url: string;
  isOnline: boolean;
}

export interface HealthResponse {
  status: string;
  miner_uid?: number;
  hotkey?: string;
  version?: string;
  uptime_seconds?: number;
  namespace_count?: number;
  total_cids?: number;
}

export interface ListEntry {
  cid: string;
  text?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface KeyShare {
  index: number;
  value: Uint8Array;
  threshold: number;
  total: number;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface EngramClientOptions {
  minerUrl?: string;
  timeout?: number;
  namespace?: string;
  namespaceKey?: string;
  /** sr25519 keypair for signed requests (SS58 private key or URI) */
  keypair?: Sr25519Keypair;
}

export interface Sr25519Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  /** SS58-encoded address */
  ss58Address: string;
}

export interface EncryptionEngine {
  encrypt(plaintext: Uint8Array, aad?: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array, aad?: Uint8Array): Promise<Uint8Array>;
}

export interface SubnetEntry {
  hotkey: string;
  url: string | null;
}
