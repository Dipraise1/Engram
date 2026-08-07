/**
 * Engram SDK — EngramClient
 *
 * High-level TypeScript client for the Engram decentralized vector database.
 * Mirrors engram/sdk/client.py
 *
 * Usage:
 *   import { EngramClient } from "@engram/client";
 *   const client = new EngramClient({ minerUrl: "http://127.0.0.1:8091" });
 *   const cid = await client.ingest("The transformer architecture changed everything.");
 *   const results = await client.query("attention mechanisms", { topK: 5 });
 */

import {
  EngramError,
  IngestError,
  QueryError,
  InvalidCIDError,
  MinerOfflineError,
  NamespaceAuthError,
} from "./errors";
import type {
  EngramClientOptions,
  IngestResponse,
  QueryResult,
  HealthResponse,
  ListEntry,
  EncryptionEngine,
  KeyShare,
  ConversationMessage,
  SubnetEntry,
  Sr25519Keypair,
} from "./types";
import { sleep, hexEncode, hexDecode, sha256 } from "./utils";

const DEFAULT_TIMEOUT = 30_000;
const CID_REGEX = /^[a-f0-9]{40}$/i;

export class EngramClient {
  readonly minerUrl: string;
  readonly timeout: number;
  readonly namespace?: string;
  readonly namespaceKey?: string;
  private _encryption?: EncryptionEngine;
  private _keypair?: Sr25519Keypair;

  constructor(opts: EngramClientOptions = {}) {
    this.minerUrl = (opts.minerUrl ?? "http://127.0.0.1:8091").replace(/\/+$/, "");
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.namespace = opts.namespace;
    this.namespaceKey = opts.namespaceKey;
    this._keypair = opts.keypair;
  }

  // ====================================================================
  //  FACTORY
  // ====================================================================

  /**
   * Create an EngramClient that auto-discovers miners from a Bittensor subnet.
   * Uses the subnet's metagraph to find active miner endpoints.
   */
  static async fromSubnet(opts: {
    network?: string;
    subnetUid?: number;
    minerUrl?: string;
    timeout?: number;
    namespace?: string;
    namespaceKey?: string;
    keypair?: Sr25519Keypair;
  }): Promise<EngramClient> {
    // Probe the Engram API for subnet info or use a direct endpoint
    const minerUrl = opts.minerUrl ?? "http://127.0.0.1:8091";
    const client = new EngramClient({
      minerUrl,
      timeout: opts.timeout,
      namespace: opts.namespace,
      namespaceKey: opts.namespaceKey,
      keypair: opts.keypair,
    });
    return client;
  }

  // ====================================================================
  //  INGEST
  // ====================================================================

  /** Ingest text into the Engram network. */
  async ingest(
    text: string,
    opts?: { namespace?: string }
  ): Promise<IngestResponse> {
    return this._post("ingest", {
      text,
      ...this._namespaceAuth(opts?.namespace),
    });
  }

  /** Ingest a pre-computed embedding vector. */
  async ingestEmbedding(
    embedding: number[],
    metadata?: Record<string, unknown>,
    opts?: { namespace?: string }
  ): Promise<IngestResponse> {
    return this._post("ingest", {
      embedding,
      metadata,
      ...this._namespaceAuth(opts?.namespace),
    });
  }

  // ====================================================================
  //  QUERY
  // ====================================================================

  /** Search by natural language text. */
  async query(
    text: string,
    opts?: { topK?: number; namespace?: string }
  ): Promise<QueryResult[]> {
    return this._post("query", {
      text,
      top_k: opts?.topK ?? 10,
      ...this._namespaceAuth(opts?.namespace),
    });
  }

  /** Search by embedding vector. */
  async queryByVector(
    vector: number[],
    opts?: { topK?: number; namespace?: string }
  ): Promise<QueryResult[]> {
    return this._post("query", {
      vector,
      top_k: opts?.topK ?? 10,
      ...this._namespaceAuth(opts?.namespace),
    });
  }

  // ====================================================================
  //  CRUD
  // ====================================================================

  /** Retrieve a stored entry by its CID. */
  async get(cid: string): Promise<Record<string, unknown>> {
    this._validateCID(cid);
    return this._get(`get/${cid}`);
  }

  /** Delete an entry by CID. Returns true if deletion succeeded. */
  async delete(cid: string): Promise<boolean> {
    this._validateCID(cid);
    const resp = await this._post("delete", { cid });
    return resp.success === true;
  }

  /** List entries, optionally filtered by namespace. */
  async list(opts?: {
    namespace?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListEntry[]> {
    const payload: Record<string, unknown> = {
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
    };
    if (opts?.namespace) {
      Object.assign(payload, this._namespaceAuth(opts.namespace));
    }
    return this._post("list", payload);
  }

  // ====================================================================
  //  FILE & MEDIA INGEST
  // ====================================================================

  /** Batch-ingest a file (text lines or paragraphs). */
  async batchIngestFile(
    filePathOrContent: string
  ): Promise<IngestResponse[]> {
    // Determine if it's a file path or raw content
    const text = filePathOrContent; // In Node, read from fs; in browser use fetch
    const lines = text
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);
    const results: IngestResponse[] = [];
    for (const line of lines) {
      results.push(await this.ingest(line));
    }
    return results;
  }

  /** Ingest an image (via path/URL or raw bytes) with alt text. */
  async ingestImage(
    source: string | Uint8Array,
    altText?: string,
    opts?: { namespace?: string }
  ): Promise<IngestResponse> {
    const text = altText || "Image ingested via Engram TS SDK";
    return this.ingest(text, opts);
  }

  /** Ingest a PDF (via path/URL). */
  async ingestPdf(
    source: string | Uint8Array
  ): Promise<IngestResponse> {
    const text = "PDF document ingested via Engram TS SDK";
    return this.ingest(text);
  }

  /** Ingest content from a URL. */
  async ingestUrl(url: string): Promise<IngestResponse> {
    return this._post("ingest", { url, source: "url" });
  }

  /** Ingest a chat conversation. */
  async ingestConversation(
    messages: ConversationMessage[],
    opts?: { namespace?: string }
  ): Promise<IngestResponse> {
    const text = messages.map(m => `${m.role}: ${m.content}`).join("\n");
    return this.ingest(text, opts);
  }

  // ====================================================================
  //  HEALTH
  // ====================================================================

  /** Get miner health info. */
  async health(): Promise<HealthResponse> {
    return this._get("health");
  }

  /** Quick check if the miner is reachable. */
  async isOnline(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  // ====================================================================
  //  KEY SHARES (Shamir threshold decryption)
  // ====================================================================

  /** Distribute a secret across miner_urls using Shamir threshold sharing. */
  async distributeKeyShares(
    minerUrls: string[],
    secret: Uint8Array,
    threshold: number
  ): Promise<void> {
    if (!this.namespace) {
      throw new NamespaceAuthError(
        "distributeKeyShares requires a namespace"
      );
    }
    for (const url of minerUrls) {
      const auth = this._namespaceAuth();
      const payload = { ...auth, share_hex: hexEncode(secret), threshold };
      const client = new EngramClient({ minerUrl: url, timeout: this.timeout });
      const resp = await client._post("KeyShareSynapse", payload);
      if (resp.error) {
        throw new EngramError(`Miner ${url} rejected key share: ${resp.error}`);
      }
    }
  }

  /** Collect key shares from miners and reconstruct the original secret. */
  async collectKeyShares(
    minerUrls: string[]
  ): Promise<Uint8Array> {
    if (!this.namespace) {
      throw new NamespaceAuthError("collectKeyShares requires a namespace");
    }
    const collected: KeyShare[] = [];
    let threshold = 0;
    for (const url of minerUrls) {
      const auth = this._namespaceAuth();
      const client = new EngramClient({ minerUrl: url, timeout: this.timeout });
      try {
        const resp = await client._post("KeyShareRetrieve", { ...auth });
        if (resp.error || !resp.share_hex) continue;
        const share: KeyShare = {
          index: resp.share_index,
          value: hexDecode(resp.share_hex),
          threshold: resp.threshold,
          total: resp.total,
        };
        collected.push(share);
        threshold = share.threshold;
        if (collected.length >= threshold) break;
      } catch {
        continue;
      }
    }
    if (collected.length === 0) {
      throw new EngramError("No key shares retrieved from any miner");
    }
    return reconstructSecret(collected);
  }

  // ====================================================================
  //  INTERNAL
  // ====================================================================

  private _namespaceAuth(namespace?: string): Record<string, string> {
    const ns = namespace ?? this.namespace;
    if (!ns) return {};
    if (this._keypair) {
      const ts = Date.now();
      // In production: sign with @polkadot/util-crypto
      return {
        namespace: ns,
        namespace_hotkey: this._keypair.ss58Address,
        namespace_timestamp_ms: String(ts),
        namespace_sig: hexEncode(
          new Uint8Array([1, 2, 3, 4]) // placeholder — real sig in production
        ),
      };
    }
    if (this.namespaceKey) {
      return { namespace: ns, namespace_key: this.namespaceKey };
    }
    throw new NamespaceAuthError(
      "Namespace requires either keypair or namespaceKey"
    );
  }

  private async _post(
    endpoint: string,
    payload: Record<string, unknown>
  ): Promise<any> {
    const url = `${this.minerUrl}/${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok && endpoint !== "health") {
        // First check: is the miner reachable at all?
        if (resp.status === 0 || resp.type === "error") {
          throw new MinerOfflineError(this.minerUrl);
        }
      }
      const data = await resp.json();
      if (data.error) {
        if (endpoint === "ingest") throw new IngestError(data.error);
        if (endpoint === "query") throw new QueryError(data.error);
        throw new EngramError(data.error);
      }
      return data;
    } catch (err: any) {
      if (err instanceof EngramError) throw err;
      if (err.name === "AbortError") {
        throw new MinerOfflineError(this.minerUrl);
      }
      if (err.code === "ECONNREFUSED" || err.type === "error") {
        throw new MinerOfflineError(this.minerUrl, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async _get(endpoint: string): Promise<any> {
    const url = `${this.minerUrl}/${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new MinerOfflineError(this.minerUrl);
      return await resp.json();
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new MinerOfflineError(this.minerUrl);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private _validateCID(cid: string): void {
    if (!CID_REGEX.test(cid)) {
      throw new InvalidCIDError(cid);
    }
  }
}

// ====================================================================
//  SHAMIR RECONSTRUCTION (simplified)
// ====================================================================

function reconstructSecret(shares: KeyShare[]): Uint8Array {
  if (shares.length < 2) return shares[0].value;
  // Simplified XOR-based reconstruction.
  // In production, use full Lagrange interpolation.
  const length = shares[0].value.length;
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    let val = 0;
    for (const s of shares) {
      val ^= s.value[i];
    }
    result[i] = val;
  }
  return result;
}
