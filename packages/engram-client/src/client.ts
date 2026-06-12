/**
 * Engram SDK — EngramClient
 *
 * High-level TypeScript client for the Engram decentralized vector database.
 * Mirrors the Python SDK (engram/sdk/client.py).
 *
 * Usage:
 *   import { EngramClient } from "@engram/client";
 *   const client = new EngramClient("http://127.0.0.1:8091");
 *   const cid = await client.ingest("The transformer architecture changed everything.");
 *   const results = await client.query("attention mechanisms", 5);
 */

import type {
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
} from "./types";

import {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from "./errors";

import { postRequest, getRequest, deleteRequest } from "./utils";
import { parseCID, isValidCID } from "./cid";
import { buildNamespaceAuth, signRequest, generateKeypairFromSeed } from "./namespace";
import { HybridEncryption, NamespaceEncryption, type EncryptionEngine } from "./encryption";

const DEFAULT_MINER_URL = "http://127.0.0.1:8091";
const DEFAULT_TIMEOUT = 30_000;

/**
 * Client for a single Engram miner node.
 */
export class EngramClient {
  public readonly minerUrl: string;
  public readonly timeout: number;
  public readonly namespace?: string;
  public readonly namespaceKey?: string;

  private _keypair?: Sr25519Keypair;
  private _enc?: EncryptionEngine;

  constructor(opts: EngramClientOptions = {}) {
    this.minerUrl = (opts.minerUrl || DEFAULT_MINER_URL).replace(/\/+$/, "");
    this.timeout = (opts.timeout || DEFAULT_TIMEOUT);
    this.namespace = opts.namespace;
    this.namespaceKey = opts.namespaceKey;
    this._keypair = opts.keypair;

    // Encryption engine setup
    if (this.namespace && this.namespaceKey) {
      this._enc = new NamespaceEncryption(this.namespace, this.namespaceKey);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private _namespaceAuth() {
    return buildNamespaceAuth(this.namespace, this.namespaceKey, this._keypair);
  }

  private _signPayload(
    endpoint: string,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    if (!this._keypair) return payload;
    return signRequest(this._keypair, endpoint, payload);
  }

  private async _post(
    endpoint: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const url = `${this.minerUrl}/${endpoint}`;
    const signedPayload = this._signPayload(endpoint, payload);
    try {
      return await postRequest(url, signedPayload, this.timeout);
    } catch (error) {
      if (error instanceof MinerOfflineError) throw error;
      if (error instanceof EngramError) throw error;
      throw new MinerOfflineError(url, error as Error);
    }
  }

  private async _get(endpoint: string): Promise<Record<string, unknown>> {
    const url = `${this.minerUrl}/${endpoint}`;
    try {
      return await getRequest(url, this.timeout);
    } catch (error) {
      if (error instanceof MinerOfflineError) throw error;
      throw new MinerOfflineError(url, error as Error);
    }
  }

  private async _delete(endpoint: string): Promise<Record<string, unknown>> {
    const url = `${this.minerUrl}/${endpoint}`;
    try {
      return await deleteRequest(url, this.timeout);
    } catch (error) {
      if (error instanceof MinerOfflineError) throw error;
      throw new MinerOfflineError(url, error as Error);
    }
  }

  private _validateCID(cid: string): void {
    try {
      parseCID(cid);
    } catch (error) {
      throw new InvalidCIDError(cid);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Embed and store text on the miner.
   */
  async ingest(
    text: string,
    metadata?: IngestMetadata
  ): Promise<string> {
    let payload: Record<string, unknown>;

    if (this._enc) {
      // Private namespace: encrypt client-side
      const encBlob = this._enc.encryptPayload(text, metadata || {});
      payload = {
        raw_embedding: [], // Will be computed server-side
        metadata: { _enc: encBlob },
        ...this._namespaceAuth(),
      };
    } else {
      payload = { text, metadata: metadata || {} };
    }

    const data = await this._post("IngestSynapse", payload);

    if (data.error) throw new IngestError(data.error as string);

    const cid = data.cid as string;
    if (!cid) throw new IngestError("Miner returned no CID and no error");

    this._validateCID(cid);
    return cid;
  }

  /**
   * Store a pre-computed embedding vector.
   */
  async ingestEmbedding(
    embedding: number[],
    metadata?: IngestMetadata
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      raw_embedding: embedding,
      metadata: metadata || {},
      ...this._namespaceAuth(),
    };

    const data = await this._post("IngestSynapse", payload);

    if (data.error) throw new IngestError(data.error as string);

    const cid = data.cid as string;
    if (!cid) throw new IngestError("Miner returned no CID and no error");

    this._validateCID(cid);
    return cid;
  }

  /**
   * Semantic search over the miner's stored embeddings.
   */
  async query(
    text: string,
    top_k: number = 10,
    filter?: Record<string, string>
  ): Promise<QueryResult[]> {
    let payload: Record<string, unknown>;

    if (this._enc) {
      payload = {
        query_vector: [], // Client-side embedding in full implementation
        top_k,
        ...this._namespaceAuth(),
      };
    } else {
      payload = { query_text: text, top_k };
    }

    if (filter) payload.filter = filter;

    const data = await this._post("QuerySynapse", payload);

    if (data.error) throw new QueryError(data.error as string);

    const results = (data.results as QueryResult[]) || [];

    // Decrypt _enc metadata if this is a private namespace client
    if (this._enc) {
      return results.map((r) => ({
        ...r,
        metadata: this._decryptResultMetadata(r.metadata),
      }));
    }

    return results;
  }

  /**
   * ANN search using a pre-computed query vector.
   */
  async queryByVector(
    vector: number[],
    top_k: number = 10
  ): Promise<QueryResult[]> {
    const payload = { query_vector: vector, top_k };
    const data = await this._post("QuerySynapse", payload);

    if (data.error) throw new QueryError(data.error as string);

    return (data.results as QueryResult[]) || [];
  }

  /**
   * Ingest all records from a JSONL string.
   */
  async batchIngest(
    jsonl: string,
    returnErrors: boolean = false
  ): Promise<string[] | { cids: string[]; errors: string[] }> {
    const lines = jsonl.split("\n").filter((l) => l.trim());
    const cids: string[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const text = obj.text;
        if (!text || typeof text !== "string") {
          errors.push(`Missing or empty 'text' field in: ${line.slice(0, 80)}`);
          continue;
        }
        const cid = await this.ingest(text, obj.metadata || {});
        cids.push(cid);
      } catch (error) {
        errors.push(`Error: ${error}`);
      }
    }

    if (returnErrors) return { cids, errors };
    return cids;
  }

  /**
   * Retrieve metadata for a stored memory by CID.
   */
  async get(cid: string): Promise<EngramRecord> {
    const encodedCID = encodeURIComponent(cid);
    const data = await this._get(`retrieve/${encodedCID}`);

    if (data.error) throw new Error(`CID not found: ${cid}`);

    return {
      cid: data.cid as string,
      metadata: (data.metadata as Record<string, unknown>) || {},
    };
  }

  /**
   * Permanently delete a stored memory by CID.
   */
  async delete(cid: string): Promise<boolean> {
    const encodedCID = encodeURIComponent(cid);
    const data = await this._delete(`retrieve/${encodedCID}`);

    if (data.deleted === false) return false;
    return true;
  }

  /**
   * List stored memories, optionally filtered.
   */
  async list(opts: ListOptions = {}): Promise<EngramRecord[]> {
    const payload: Record<string, unknown> = {
      limit: opts.limit || 50,
      offset: opts.offset || 0,
    };
    if (opts.filter) payload.filter = opts.filter;
    if (this.namespace) payload.namespace = this.namespace;

    const data = await this._post("list", payload);
    return (data.records as EngramRecord[]) || [];
  }

  /**
   * Store a conversation as individual memories.
   */
  async ingestConversation(
    messages: ConversationMessage[],
    sessionId?: string,
    metadata?: IngestMetadata
  ): Promise<string[]> {
    const cids: string[] = [];
    const timestampMs = Date.now();

    for (const msg of messages) {
      const content = msg.content.trim();
      if (!content) continue;

      const meta: IngestMetadata = {
        role: msg.role,
        ts: String(Math.floor(timestampMs / 1000)),
        text: content.slice(0, 500),
        ...(sessionId ? { session: sessionId } : {}),
        ...(metadata || {}),
      };

      const cid = await this.ingest(content, meta);
      cids.push(cid);
    }

    return cids;
  }

  /**
   * Fetch a URL, extract text, and store it.
   */
  async ingestURL(
    url: string,
    metadata?: IngestMetadata
  ): Promise<URLIngestResult> {
    // Fetch the URL
    const response = await fetch(url, {
      headers: { "User-Agent": "EngramBot/1.0 (semantic-memory-indexer)" },
      signal: AbortSignal.timeout(15_000),
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = Buffer.from(await response.arrayBuffer());

    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(
        `URL returned ${contentType} — only text/html and text/plain are supported.`
      );
    }

    // Simple HTML text extraction
    const html = raw.toString("utf-8");
    let text: string;
    let title: string = url;

    if (contentType.includes("text/plain")) {
      text = html.replace(/\s+/g, " ").trim();
    } else {
      // Basic HTML tag stripping
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();
    }

    if (!text) throw new Error(`No text content found at ${url}`);

    const contentHash = sha256(raw);
    const meta: IngestMetadata = {
      source: url,
      type: "url",
      title: title.slice(0, 256),
      text: text.slice(0, 500),
      content_cid: `sha256:${contentHash}`,
      ...(metadata || {}),
    };

    const MAX_CHARS = 8192;
    const cid = await this.ingest(text.slice(0, MAX_CHARS), meta);

    return { cid, url, title, chars: text.length };
  }

  /**
   * Check miner liveness.
   */
  async health(): Promise<HealthResponse> {
    const data = await this._get("health");
    return data as unknown as HealthResponse;
  }

  /**
   * Returns true if the miner responds.
   */
  async isOnline(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────

  private _decryptResultMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    if (!this._enc || !metadata._enc) return metadata;
    try {
      const decrypted = this._enc.decryptPayload(metadata._enc as string);
      return {
        ...metadata,
        ...decrypted.metadata,
        _text: decrypted.text,
        _enc: undefined, // Remove raw ciphertext
      };
    } catch {
      // If decryption fails, return metadata as-is
      return metadata;
    }
  }
}

/** SHA-256 hash helper. */
function sha256(data: Buffer): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(data).digest("hex");
}
