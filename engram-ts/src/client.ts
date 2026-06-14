/**
 * Engram SDK — EngramClient
 *
 * High-level TypeScript client for the Engram decentralized vector database.
 *
 * Usage:
 *   import { EngramClient } from "@engram/client";
 *   const client = new EngramClient("http://127.0.0.1:8091");
 *   const cid = await client.ingest("Hello world!");
 *   const results = await client.query("hello", top_k: 5);
 */

import {
  EngramError, MinerOfflineError,
  IngestError, QueryError, InvalidCIDError,
} from "./exceptions.js";
import { NamespaceEncryption, HybridEncryption } from "./encryption.js";

export type Metadata = Record<string, unknown>;
export type QueryResult = { cid: string; score: number; metadata: Metadata };
export type IngestImageResult = {
  cid: string; description: string; content_cid: string;
  filename?: string; arweave_tx_id?: string; arweave_url?: string;
};
export type IngestUrlResult = {
  cid: string; url: string; title: string; chars: number;
  arweave_tx_id?: string; arweave_url?: string;
};
export type IngestPdfResult = {
  cid: string; pages: number; chars: number; content_cid: string;
  filename?: string; arweave_tx_id?: string; arweave_url?: string;
};

interface EngramClientOpts {
  minerUrl?: string;
  timeout?: number;
  namespace?: string;
  namespaceKey?: string;
}

export class EngramClient {
  public minerUrl: string;
  public timeout: number;
  public namespace?: string;
  private enc: any = null;

  constructor(opts: EngramClientOpts = {}) {
    this.minerUrl = (opts.minerUrl ?? "http://127.0.0.1:8091").replace(/\/+$/, "");
    this.timeout = opts.timeout ?? 30_000;
    this.namespace = opts.namespace;

    if (opts.namespace && opts.namespaceKey) {
      // Lazy init — caller must await initNamespace()
      this.enc = { type: "pending", namespace: opts.namespace, key: opts.namespaceKey };
    }
  }

  /** Initialize namespace encryption. Must be called before using encrypted ops. */
  async initEncryption(): Promise<void> {
    if (this.enc?.type === "pending") {
      this.enc = await NamespaceEncryption.create(this.enc.namespace, this.enc.key);
    }
  }

  // -- Internal HTTP helpers ------------------------------------------

  private async post(endpoint: string, payload: unknown): Promise<any> {
    const url = this.minerUrl + "/" + endpoint;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new EngramError("HTTP " + resp.status + ": " + await resp.text());
      }
      return await resp.json();
    } catch (err: any) {
      if (err.name === "AbortError" || err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
        throw new MinerOfflineError(url, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async _get(endpoint: string): Promise<any> {
    const url = this.minerUrl + "/" + endpoint;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        if (resp.status === 404) throw new Error("Not found");
        throw new EngramError("HTTP " + resp.status + ": " + await resp.text());
      }
      return await resp.json();
    } catch (err: any) {
      if (err.name === "AbortError" || err.code === "ECONNREFUSED") {
        throw new MinerOfflineError(url, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async del(endpoint: string): Promise<any> {
    const url = this.minerUrl + "/" + endpoint;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(url, { method: "DELETE", signal: controller.signal });
      if (resp.status === 404) return { deleted: false };
      return await resp.json();
    } catch (err: any) {
      if (err.name === "AbortError" || err.code === "ECONNREFUSED") {
        throw new MinerOfflineError(url, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // -- Public API ----------------------------------------------------

  async ingest(text: string, metadata?: Metadata): Promise<string> {
    if (this.enc) {
      const encBlob = await this.enc.encryptPayload(text, metadata ?? {});
      // Client-side embedding would go here in practice
      const payload = {
        raw_embedding: [0], // placeholder — use embedder
        metadata: { _enc: encBlob },
      };
      const data = await this.post("IngestSynapse", payload);
      if (data.error) throw new IngestError(data.error);
      if (!data.cid) throw new IngestError("Miner returned no CID and no error");
      return data.cid;
    }
    const data = await this.post("IngestSynapse", { text, metadata: metadata ?? {} });
    if (data.error) throw new IngestError(data.error);
    if (!data.cid) throw new IngestError("Miner returned no CID and no error");
    return data.cid;
  }

  async ingestEmbedding(embedding: number[], metadata?: Metadata): Promise<string> {
    const payload = { raw_embedding: embedding, metadata: metadata ?? {} };
    const data = await this.post("IngestSynapse", payload);
    if (data.error) throw new IngestError(data.error);
    if (!data.cid) throw new IngestError("Miner returned no CID and no error");
    return data.cid;
  }

  async query(text: string, topK: number = 10, filter?: Record<string, string>): Promise<QueryResult[]> {
    const payload: any = { query_text: text, top_k: topK };
    if (filter) payload.filter = filter;
    const data = await this.post("QuerySynapse", payload);
    if (data.error) throw new QueryError(data.error);
    return data.results ?? [];
  }

  async queryByVector(vector: number[], topK: number = 10): Promise<QueryResult[]> {
    const data = await this.post("QuerySynapse", { query_vector: vector, top_k: topK });
    if (data.error) throw new QueryError(data.error);
    return data.results ?? [];
  }

  async get(cid: string): Promise<{ cid: string; metadata: Metadata }> {
    const data = await this._get("retrieve/" + encodeURIComponent(cid));
    if (data.error) throw new Error("CID not found: " + cid);
    return data;
  }

  async delete(cid: string): Promise<boolean> {
    const data = await this.del("retrieve/" + encodeURIComponent(cid));
    return data.deleted === true;
  }

  async list(filter?: Record<string, string>, limit: number = 50, offset: number = 0): Promise<any[]> {
    const payload: any = { limit, offset };
    if (filter) payload.filter = filter;
    const data = await this.post("list", payload);
    return data.records ?? [];
  }

  async health(): Promise<Record<string, unknown>> {
    return this._get("health");
  }

  async isOnline(): Promise<boolean> {
    try { await this.health(); return true; }
    catch { return false; }
  }

  async batchIngestFile(path: string, returnErrors: boolean = false): Promise<string[] | [string[], string[]]> {
    const fs = await import("node:fs");
    const content = fs.readFileSync(path, "utf-8");
    const lines = content.split("\n").filter(l => l.trim().length > 0);
    const cids: string[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (!obj.text || typeof obj.text !== "string") {
          errors.push("Missing or empty text field");
          continue;
        }
        const cid = await this.ingest(obj.text, obj.metadata ?? {});
        cids.push(cid);
      } catch (e: any) {
        errors.push(e.message);
      }
    }
    if (returnErrors) return [cids, errors];
    return cids;
  }

  async ingestUrl(url: string, metadata?: Metadata): Promise<IngestUrlResult> {
    const resp = await fetch(url, {
      headers: { "User-Agent": "EngramBot/1.0 (semantic-memory-indexer)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error("Failed to fetch " + url + ": HTTP " + resp.status);

    const contentType = resp.headers.get("content-type") ?? "";
    const html = await resp.text();

    // Simple title extraction
    let title = url;
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();

    // Strip HTML tags for text
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) throw new Error("No text content found at " + url);

    const meta: Metadata = {
      source: url, type: "url", title: title.slice(0, 256),
      text: text.slice(0, 500), ...(metadata ?? {}),
    };
    const cid = await this.ingest(text.slice(0, 8192), meta);
    return { cid, url, title: title.slice(0, 256), chars: text.length };
  }

  async ingestConversation(
    messages: Array<{ role: string; content: string }>,
    sessionId?: string,
    metadata?: Metadata
  ): Promise<string[]> {
    const cids: string[] = [];
    const ts = Math.floor(Date.now() / 1000).toString();
    for (const msg of messages) {
      const content = (msg.content ?? "").trim();
      if (!content) continue;
      const meta: Metadata = {
        role: msg.role, ts,
        text: content.slice(0, 500),
        ...(sessionId ? { session: sessionId } : {}),
        ...(metadata ?? {}),
      };
      const cid = await this.ingest(content, meta);
      cids.push(cid);
    }
    return cids;
  }

  toString(): string {
    return "EngramClient(minerUrl=" + JSON.stringify(this.minerUrl) + ")";
  }
}
