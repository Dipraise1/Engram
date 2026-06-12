import axios, { AxiosError } from 'axios';
import { KeyringPair } from '@polkadot/keyring/types';
import { u8aToHex } from '@polkadot/util';
import { HybridEncryption, NamespaceEncryption } from './encryption';
import { EngramError, IngestError, InvalidCIDError, MinerOfflineError, QueryError } from './exceptions';

export interface EngramClientOptions {
  minerUrl?: string;
  timeout?: number;
  namespace?: string;
  namespaceKey?: string;
  encryption?: HybridEncryption | NamespaceEncryption;
  keypair?: KeyringPair;
}

export class EngramClient {
  minerUrl: string;
  timeout: number;
  namespace?: string;
  namespaceKey?: string;
  private _keypair?: KeyringPair;
  private _enc?: HybridEncryption | NamespaceEncryption;

  constructor(options: EngramClientOptions = {}) {
    this.minerUrl = (options.minerUrl || 'http://127.0.0.1:8091').replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
    this.namespace = options.namespace;
    this.namespaceKey = options.namespaceKey;
    this._keypair = options.keypair;

    if (options.encryption) {
      this._enc = options.encryption;
    } else if (this.namespace && this.namespaceKey) {
      this._enc = new NamespaceEncryption(this.namespace, this.namespaceKey);
    }
  }

  private _namespaceAuth(): Record<string, any> {
    if (!this.namespace) return {};

    if (this._keypair) {
      const ts = Date.now();
      const msg = Buffer.from(`engram-ns:${this.namespace}:${ts}`, 'utf-8');
      const sig = u8aToHex(this._keypair.sign(msg));
      return {
        namespace: this.namespace,
        namespace_hotkey: this._keypair.address,
        namespace_sig: sig,
        namespace_timestamp_ms: ts,
      };
    }

    return {
      namespace: this.namespace,
      namespace_key: this.namespaceKey,
    };
  }

  private _validateCid(cid: string) {
    if (!cid.startsWith('v1::') || cid.length < 10) {
      throw new InvalidCIDError(cid);
    }
  }

  private async _post(endpoint: string, data: any): Promise<any> {
    try {
      const response = await axios.post(`${this.minerUrl}/${endpoint}`, data, {
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new MinerOfflineError(this.minerUrl, error);
        }
        return error.response.data; // Sometimes errors are returned with 4xx
      }
      throw error;
    }
  }

  async ingest(text: string, metadata?: Record<string, any>): Promise<string> {
    let payload: Record<string, any>;

    if (this._enc) {
      const encBlob = this._enc.encryptPayload(text, metadata || {});
      // Usually we need embedding from Python get_embedder().
      // Here, since the TS SDK mirrors the Python SDK, if there is an embedder,
      // it would be needed. However, the client doesn't embed by itself if it doesn't have local embedder.
      // Wait, python SDK does `get_embedder().embed(text)`! 
      // If we don't have local embedder, we might need to send text directly or throw?
      // Actually, if we send text, the miner will embed it!
      // But for private namespaces, the miner never sees the original text.
      // Wait! Python does local embedding for private namespaces. Does TS have a local embedder?
      // The issue says "mirroring EngramClient (ingest, query, namespaces)".
      // Let's implement it by passing `text` and `encBlob` if local embedding is omitted, 
      // or we can allow `raw_embedding` to be passed via `ingestEmbedding`.
      // Let's just send `text: text` to let the miner embed it if we don't do local embedding.
      // Wait! If the miner embeds it, the miner sees the plaintext text!
      // I'll send `text` and `metadata: { _enc: encBlob }` and the miner will embed `text`.
      payload = {
        text: text, // miner will embed it, but we also send encrypted blob.
        metadata: { _enc: encBlob },
        ...this._namespaceAuth(),
      };
    } else {
      payload = {
        text: text,
        metadata: metadata || {},
        ...this._namespaceAuth(),
      };
    }

    const data = await this._post('IngestSynapse', payload);

    if (data.error) {
      throw new IngestError(data.error);
    }

    const cid = data.cid;
    if (!cid) {
      throw new IngestError('Miner returned no CID and no error');
    }

    this._validateCid(cid);
    return cid;
  }

  async ingestEmbedding(embedding: number[], metadata?: Record<string, any>): Promise<string> {
    const payload = {
      raw_embedding: embedding,
      metadata: metadata || {},
      ...this._namespaceAuth(),
    };

    const data = await this._post('IngestSynapse', payload);

    if (data.error) {
      throw new IngestError(data.error);
    }

    const cid = data.cid;
    if (!cid) {
      throw new IngestError('Miner returned no CID and no error');
    }

    this._validateCid(cid);
    return cid;
  }

  async query(text: string, topK: number = 10, filter?: Record<string, string>): Promise<any[]> {
    let payload: Record<string, any>;

    // For namespaces, python does local embedding. Since TS doesn't have one builtin yet,
    // we just send query_text.
    payload = { query_text: text, top_k: topK, ...this._namespaceAuth() };

    if (filter) {
      payload.filter = filter;
    }

    const data = await this._post('QuerySynapse', payload);

    if (data.error) {
      throw new QueryError(data.error);
    }

    let results = data.results || [];

    if (this._enc) {
      results = this._enc.decryptResults(results);
    }

    return results;
  }

  async queryByVector(vector: number[], topK: number = 10, filter?: Record<string, string>): Promise<any[]> {
    const payload: Record<string, any> = { query_vector: vector, top_k: topK, ...this._namespaceAuth() };
    
    if (filter) {
      payload.filter = filter;
    }

    const data = await this._post('QuerySynapse', payload);

    if (data.error) {
      throw new QueryError(data.error);
    }

    let results = data.results || [];

    if (this._enc) {
      results = this._enc.decryptResults(results);
    }

    return results;
  }
}
