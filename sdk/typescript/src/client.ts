/**
 * Engram SDK — EngramClient
 *
 * High-level TypeScript client for the Engram decentralized vector database.
 *
 * Usage:
 *   import { EngramClient } from "@engram/client";
 *
 *   const client = new EngramClient({ minerUrl: "http://127.0.0.1:8091" });
 *
 *   const cid = await client.ingest("The transformer architecture changed everything.");
 *   const results = await client.query("attention mechanisms in deep learning", { topK: 5 });
 *   for (const r of results) {
 *     console.log(r.cid, r.score);
 *   }
 */

import * as http from "http";
import * as https from "https";
import { URL } from "url";
import {
  EngramError,
  IngestError,
  InvalidCIDError,
  MinerOfflineError,
  QueryError,
} from "./errors";
import type {
  ClientOptions,
  HealthResponse,
  MemoryRecord,
  Metadata,
  QueryResult,
} from "./types";

/** CID must start with a known prefix. */
const CID_PREFIXES = ["v1::", "bafy", "Qm"];

function validateCid(cid: string): void {
  const valid = CID_PREFIXES.some((p) => cid.startsWith(p));
  if (!valid && cid.length > 4) {
    throw new InvalidCIDError(cid);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export class EngramClient {
  readonly minerUrl: string;
  readonly timeout: number;
  readonly namespace: string | undefined;
  readonly namespaceKey: string | undefined;

  constructor(options: ClientOptions = {}) {
    this.minerUrl = (options.minerUrl || "http://127.0.0.1:8091").replace(
      /\/$/,
      ""
    );
    this.timeout = options.timeout ?? 30_000;
    this.namespace = options.namespace;
    this.namespaceKey = options.namespaceKey;
  }

  // ── Namespace auth ────────────────────────────────────────────────────────

  private namespaceAuth(): Metadata {
    if (!this.namespace) return {};
    return {
      namespace: this.namespace,
      namespace_key: this.namespaceKey ?? "",
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Embed and store text on the miner.
   *
   * @returns The CID (content identifier) assigned to this embedding.
   */
  async ingest(text: string, metadata?: Metadata): Promise<string> {
    const payload: AnyObj = {
      text,
      metadata: metadata ?? {},
      ...this.namespaceAuth(),
    };

    const data: AnyObj = await this.post("IngestSynapse", payload);

    if (data.error) {
      throw new IngestError(data.error);
    }

    const cid: string | undefined = data.cid;
    if (!cid) {
      throw new IngestError("Miner returned no CID and no error");
    }

    validateCid(cid);
    return cid;
  }

  /**
   * Store a pre-computed embedding vector on the miner.
   */
  async ingestEmbedding(
    embedding: number[],
    metadata?: Metadata
  ): Promise<string> {
    const payload: AnyObj = {
      raw_embedding: embedding,
      metadata: metadata ?? {},
      ...this.namespaceAuth(),
    };

    const data: AnyObj = await this.post("IngestSynapse", payload);

    if (data.error) {
      throw new IngestError(data.error);
    }

    const cid: string | undefined = data.cid;
    if (!cid) {
      throw new IngestError("Miner returned no CID and no error");
    }

    validateCid(cid);
    return cid;
  }

  /**
   * Semantic search over the miner's stored embeddings.
   */
  async query(
    text: string,
    options: { topK?: number; filter?: Metadata } = {}
  ): Promise<QueryResult[]> {
    const { topK = 10, filter } = options;

    const payload: AnyObj = {
      query_text: text,
      top_k: topK,
      ...this.namespaceAuth(),
    };

    if (filter) {
      payload.filter = filter;
    }

    const data: AnyObj = await this.post("QuerySynapse", payload);

    if (data.error) {
      throw new QueryError(data.error);
    }

    return (data.results ?? []) as QueryResult[];
  }

  /**
   * ANN search using a pre-computed query vector.
   */
  async queryByVector(vector: number[], topK = 10): Promise<QueryResult[]> {
    const payload: AnyObj = {
      query_vector: vector,
      top_k: topK,
    };

    const data: AnyObj = await this.post("QuerySynapse", payload);

    if (data.error) {
      throw new QueryError(data.error);
    }

    return (data.results ?? []) as QueryResult[];
  }

  /**
   * Retrieve the metadata for a stored memory by CID.
   */
  async get(cid: string): Promise<MemoryRecord> {
    const encoded = encodeURIComponent(cid);
    const data: AnyObj = await this.httpGet(`retrieve/${encoded}`);

    if (data.error) {
      throw new Error(`CID not found: ${cid}`);
    }

    return data as MemoryRecord;
  }

  /**
   * Permanently delete a stored memory by CID.
   *
   * @returns true if deleted, false if not found.
   */
  async delete(cid: string): Promise<boolean> {
    const encoded = encodeURIComponent(cid);
    const url = `${this.minerUrl}/retrieve/${encoded}`;

    try {
      const data: AnyObj = await this.request(url, { method: "DELETE" });
      return Boolean(data.deleted);
    } catch {
      return false;
    }
  }

  /**
   * List stored memories, optionally filtered by metadata.
   */
  async list(
    options: {
      filter?: Metadata;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MemoryRecord[]> {
    const { filter, limit = 50, offset = 0 } = options;

    const payload: AnyObj = { limit, offset };
    if (filter) payload.filter = filter;
    if (this.namespace) payload.namespace = this.namespace;

    const data: AnyObj = await this.post("list", payload);
    return (data.records ?? []) as MemoryRecord[];
  }

  /**
   * Store a conversation (list of messages) as individual memories.
   */
  async ingestConversation(
    messages: Array<{ role: string; content: string }>,
    options: { sessionId?: string; metadata?: Metadata } = {}
  ): Promise<string[]> {
    const { sessionId, metadata } = options;
    const cids: string[] = [];

    for (const msg of messages) {
      const content = msg.content?.trim();
      if (!content) continue;

      const meta: Metadata = {
        role: msg.role || "user",
        ts: String(Math.floor(Date.now() / 1000)),
        text: content.slice(0, 500),
        ...(sessionId ? { session: sessionId } : {}),
        ...(metadata ?? {}),
      };

      const cid = await this.ingest(content, meta);
      cids.push(cid);
    }

    return cids;
  }

  /**
   * Check miner liveness.
   */
  async health(): Promise<HealthResponse> {
    const data: AnyObj = await this.httpGet("health");
    return data as HealthResponse;
  }

  /**
   * Return true if the miner responds to a health check.
   */
  async isOnline(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async post(
    endpoint: string,
    payload: AnyObj
  ): Promise<AnyObj> {
    const url = `${this.minerUrl}/${endpoint}`;
    return this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  private async httpGet(endpoint: string): Promise<AnyObj> {
    const url = `${this.minerUrl}/${endpoint}`;
    return this.request(url, { method: "GET" });
  }

  private request(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {}
  ): Promise<AnyObj> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === "https:";
      const transport = isHttps ? https : http;

      const reqOptions: http.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: options.headers ?? {},
        timeout: this.timeout,
      };

      const req = transport.request(reqOptions, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch {
            reject(
              new EngramError(
                `Failed to parse response from ${url}: ${data.slice(0, 200)}`
              )
            );
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new MinerOfflineError(url));
      });

      req.on("error", (err: NodeJS.ErrnoException) => {
        if (
          err.code === "ECONNREFUSED" ||
          err.code === "ENOTFOUND" ||
          err.code === "ECONNRESET"
        ) {
          reject(new MinerOfflineError(url, err));
        } else {
          reject(new EngramError(`HTTP request failed: ${err.message}`));
        }
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  toString(): string {
    return `EngramClient(minerUrl=${JSON.stringify(this.minerUrl)}, timeout=${this.timeout})`;
  }
}
