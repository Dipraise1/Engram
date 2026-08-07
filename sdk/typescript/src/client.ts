/**
 * EngramClient — TypeScript SDK for Engram decentralized knowledge graph.
 *
 * Mirrors the Python SDK (engram/sdk/client.py).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { namespaceAuth } from './crypto.js';
import {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from './errors.js';
import type {
  ApiResponse,
  BatchIngestOptions,
  ConversationMessage,
  EngramClientOptions,
  Filter,
  HealthResponse,
  ImageIngestResult,
  IngestOptions,
  Metadata,
  PdfIngestResult,
  QueryResult,
  EngramRecord,
  UrlIngestResult,
} from './types.js';

// Re-export for consumers
export { EngramError, MinerOfflineError, IngestError, QueryError, InvalidCIDError } from './errors.js';
export type * from './types.js';
export { namespaceAuth, isSr25519Available } from './crypto.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MINER_URL = 'http://127.0.0.1:8091';
const DEFAULT_TIMEOUT = 30_000; // ms

// ---------------------------------------------------------------------------
// EngramClient
// ---------------------------------------------------------------------------

export class EngramClient {
  public readonly minerUrl: string;
  public readonly timeout: number;
  public readonly namespace: string | undefined;
  private readonly namespaceKey: string | undefined;
  private readonly keypair: unknown | undefined;
  private _httpAgent: (url: string, options: RequestInit) => Promise<Response>;

  constructor(options: EngramClientOptions = {}) {
    this.minerUrl = (options.miner_url ?? DEFAULT_MINER_URL).replace(/\/+$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.namespace = options.namespace;
    this.namespaceKey = options.namespace_key;
    this.keypair = options.keypair;

    // Allow injecting a custom fetch for testing
    this._httpAgent = async (url: string, init: RequestInit): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const resp = await fetch(url, { ...init, signal: controller.signal });
        return resp;
      } finally {
        clearTimeout(timer);
      }
    };
  }

  /**
   * Override the HTTP agent (primarily for tests).
   */
  _setHttpAgent(agent: (url: string, options: RequestInit) => Promise<Response>): void {
    this._httpAgent = agent;
  }

  // -----------------------------------------------------------------------
  // Network layer
  // -----------------------------------------------------------------------

  private async _post(endpoint: string, payload: Metadata): Promise<ApiResponse> {
    const url = `${this.minerUrl}/${endpoint}`;
    let body = JSON.stringify(payload);
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Inject namespace auth
    const auth = await namespaceAuth(this.namespace, this.namespaceKey, this.keypair);
    if (Object.keys(auth).length > 0) {
      const merged = { ...payload, ...auth };
      body = JSON.stringify(merged);
    }

    let resp: Response;
    try {
      resp = await this._httpAgent(url, {
        method: 'POST',
        headers,
        body,
      });
    } catch (err) {
      throw new MinerOfflineError(`POST ${endpoint}: ${String(err)}`);
    }

    if (!resp.ok) {
      throw new MinerOfflineError(`HTTP ${resp.status} on POST ${endpoint}`);
    }

    const data = await resp.json() as ApiResponse;
    return data;
  }

  private async _get(endpoint: string): Promise<ApiResponse> {
    const url = `${this.minerUrl}/${endpoint}`;
    let resp: Response;
    try {
      resp = await this._httpAgent(url, { method: 'GET' });
    } catch (err) {
      throw new MinerOfflineError(`GET ${endpoint}: ${String(err)}`);
    }

    if (!resp.ok) {
      throw new MinerOfflineError(`HTTP ${resp.status} on GET ${endpoint}`);
    }

    const data = await resp.json() as ApiResponse;
    return data;
  }

  // -----------------------------------------------------------------------
  // Core API methods
  // -----------------------------------------------------------------------

  /**
   * Ingest text into the knowledge graph.
   * @returns The CID string of the ingested record.
   */
  async ingest(text: string, metadata?: Metadata): Promise<string> {
    const payload: Metadata = { text, metadata: metadata ?? {} };
    const data = await this._post('IngestSynapse', payload);
    if (data.error) throw new IngestError(String(data.error));
    const cid = data.cid;
    if (!cid || typeof cid !== 'string') {
      throw new IngestError('Miner returned no CID');
    }
    return cid;
  }

  /**
   * Ingest a pre-computed embedding vector.
   * @returns The CID string.
   */
  async ingestEmbedding(embedding: number[], metadata?: Metadata): Promise<string> {
    const payload: Metadata = { embedding, metadata: metadata ?? {} };
    const data = await this._post('IngestEmbedding', payload);
    if (data.error) throw new IngestError(String(data.error));
    const cid = data.cid;
    if (!cid || typeof cid !== 'string') {
      throw new IngestError('Miner returned no CID');
    }
    return cid;
  }

  /**
   * Query the knowledge graph by natural language text.
   * @returns Array of query results with cid, score, and metadata.
   */
  async query(
    text: string,
    topK: number = 10,
    filter?: Filter,
  ): Promise<QueryResult[]> {
    const payload: Metadata = { query_text: text, top_k: topK };
    if (filter) payload.filter = filter;
    const data = await this._post('QuerySynapse', payload);
    if (data.error) throw new QueryError(String(data.error));
    return (data.results as QueryResult[]) ?? [];
  }

  /**
   * Query by embedding vector.
   * @returns Array of query results.
   */
  async queryByVector(vector: number[], topK: number = 10): Promise<QueryResult[]> {
    const payload: Metadata = { vector, top_k: topK };
    const data = await this._post('QueryByVector', payload);
    if (data.error) throw new QueryError(String(data.error));
    return (data.results as QueryResult[]) ?? [];
  }

  /**
   * Retrieve a single record by CID.
   */
  async get(cid: string): Promise<EngramRecord> {
    const payload: Metadata = { cid, metadata: {} };
    const data = await this._post('GetSynapse', payload);
    if (data.error) throw new InvalidCIDError(String(data.error));
    return {
      cid: (data.cid as string) ?? cid,
      metadata: (data.metadata as Metadata) ?? {},
    };
  }

  /**
   * Delete a record by CID.
   * @returns true if successfully deleted.
   */
  async delete(cid: string): Promise<boolean> {
    const payload: Metadata = { cid };
    const data = await this._post('DeleteSynapse', payload);
    if (data.error) throw new InvalidCIDError(String(data.error));
    return true;
  }

  /**
   * List records with optional filter, limit, and offset.
   */
  async list(
    filter?: Filter,
    limit: number = 100,
    offset: number = 0,
  ): Promise<EngramRecord[]> {
    const payload: Metadata = { limit, offset };
    if (filter) payload.filter = filter;
    const data = await this._post('ListSynapses', payload);
    if (data.error) throw new QueryError(String(data.error));
    return (data.records as EngramRecord[]) ?? [];
  }

  /**
   * Health check.
   */
  async health(): Promise<HealthResponse> {
    const data = await this._get('health');
    return {
      status: (data.status as string) ?? 'unknown',
      vectors: (data.vectors as number) ?? 0,
      uid: (data.uid as string) ?? '',
    };
  }

  /**
   * Check if the miner is online.
   */
  async isOnline(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Batch ingest
  // -----------------------------------------------------------------------

  /**
   * Batch-ingest all records from a JSON-lines file.
   *
   * Each line must be a JSON object with `text` (required) and optional `metadata`.
   */
  async batchIngestFile(
    filePath: string,
    options: BatchIngestOptions = {},
  ): Promise<string[] | [string[], string[]]> {
    const returnErrors = options.return_errors ?? false;

    const absPath = path.resolve(filePath);
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());

    const cids: string[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const text = obj.text;
        if (!text) {
          throw new IngestError('Missing "text" field in batch line');
        }
        const cid = await this.ingest(text, obj.metadata);
        cids.push(cid);
      } catch (err) {
        if (returnErrors) {
          errors.push(String(err));
        } else {
          throw err;
        }
      }
    }

    return returnErrors ? [cids, errors] : cids;
  }

  // -----------------------------------------------------------------------
  // Ingest image (via xAI API)
  // -----------------------------------------------------------------------

  /**
   * Ingest an image by sending it to xAI for description, then ingesting
   * both the description and the base64-encoded content.
   */
  async ingestImage(
    source: string,
    xaiApiKey: string,
    model: string = 'grok-2-vision-latest',
  ): Promise<ImageIngestResult> {
    const imageData = fs.readFileSync(source);
    const base64 = imageData.toString('base64');
    const filename = path.basename(source);
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    // Get description from xAI
    let description: string;
    try {
      const xaiResp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${xaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
                },
                {
                  type: 'text',
                  text: 'Describe this image in detail, capturing all visible elements, text, colors, and context.',
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      if (!xaiResp.ok) {
        throw new EngramError(`xAI API returned HTTP ${xaiResp.status}`);
      }

      const xaiData = await xaiResp.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      description = xaiData.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      throw new EngramError(`xAI vision failed: ${String(err)}`);
    }

    // Ingest description
    const descCid = await this.ingest(description, { filename, type: 'image_description' });

    // Ingest image content (base64 encoded)
    const contentCid = await this.ingest(base64, {
      filename,
      type: 'image_content',
      encoding: 'base64',
      mime_type: mimeType,
    });

    return { cid: descCid, description, content_cid: contentCid, filename };
  }

  // -----------------------------------------------------------------------
  // Ingest PDF
  // -----------------------------------------------------------------------

  /**
   * Ingest a PDF file: extract text with pdf-parse, then ingest.
   */
  async ingestPdf(source: string): Promise<PdfIngestResult> {
    const filename = path.basename(source);
    const pdfData = fs.readFileSync(source);

    let pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    try {
      const mod = await import('pdf-parse');
      pdfParse = mod.default as typeof pdfParse;
    } catch {
      throw new EngramError('pdf-parse is not installed. Run: npm install pdf-parse');
    }

    const parsed = await pdfParse(pdfData);
    const text = parsed.text;
    const pages = parsed.numpages;
    const chars = text.length;

    // Ingest full text
    const contentCid = await this.ingest(text, {
      filename,
      type: 'pdf_content',
      pages,
      chars,
    });

    // Ingest metadata summary
    const summaryCid = await this.ingest(
      `PDF file "${filename}" with ${pages} page(s), ${chars} characters.`,
      { filename, type: 'pdf_summary', pages, chars, content_cid: contentCid },
    );

    return {
      cid: summaryCid,
      pages,
      chars,
      content_cid: contentCid,
      filename,
    };
  }

  // -----------------------------------------------------------------------
  // Ingest URL
  // -----------------------------------------------------------------------

  /**
   * Ingest a URL: fetch and extract text, then ingest.
   */
  async ingestUrl(url: string): Promise<UrlIngestResult> {
    let html: string;
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'EngramSDK/0.1' },
      });
      if (!resp.ok) {
        throw new EngramError(`HTTP ${resp.status} fetching ${url}`);
      }
      html = await resp.text();
    } catch (err) {
      throw new EngramError(`Failed to fetch URL: ${String(err)}`);
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Strip HTML tags for plain text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const chars = text.length;
    const cid = await this.ingest(text, { url, title, type: 'url_content', chars });

    return { cid, url, title, chars };
  }

  // -----------------------------------------------------------------------
  // Ingest conversation
  // -----------------------------------------------------------------------

  /**
   * Ingest a conversation (array of messages).
   * Each message is ingested individually + a summary record.
   */
  async ingestConversation(
    messages: ConversationMessage[],
    sessionId?: string,
  ): Promise<string[]> {
    const cids: string[] = [];
    const sid = sessionId ?? `conv_${Date.now()}`;

    for (const msg of messages) {
      const cid = await this.ingest(msg.content, {
        role: msg.role,
        session_id: sid,
        type: 'conversation_message',
      });
      cids.push(cid);
    }

    // Ingest conversation summary
    const summary = `Conversation (${sid}) with ${messages.length} messages. ` +
      `Roles: ${messages.map((m) => m.role).join(', ')}`;
    const summaryCid = await this.ingest(summary, {
      session_id: sid,
      type: 'conversation_summary',
      message_count: messages.length,
    });
    cids.push(summaryCid);

    return cids;
  }
}
