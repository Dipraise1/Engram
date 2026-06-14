/**
 * Engram TypeScript SDK — The Official Client for the Engram Decentralized Vector Database
 *
 * Usage:
 *   import { EngramClient } from '@engram/client'
 *
 *   const client = new EngramClient()
 *   const cid = await client.ingest('Hello world')
 *   const results = await client.query('hello', { topK: 5 })
 */

import type {
  EngramClientOptions,
  IngestResponse,
  QueryResponse,
  HealthResponse,
  Sr25519Keypair,
  SignedFields,
  NamespaceAuth,
} from './types'
import {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from './exceptions'

export type { EngramClientOptions, QueryResult, IngestResponse, QueryResponse, HealthResponse, Sr25519Keypair } from './types'
export { EngramError, MinerOfflineError, IngestError, QueryError, InvalidCIDError } from './exceptions'

export class EngramClient {
  private readonly minerUrl: string
  private readonly timeout: number
  private readonly namespace?: string
  private readonly namespaceKey?: string
  private readonly keypair?: Sr25519Keypair

  constructor(options: EngramClientOptions = {}) {
    this.minerUrl = (options.minerUrl ?? 'http://127.0.0.1:8091').replace(/\/$/, '')
    this.timeout = options.timeout ?? 30_000
    this.namespace = options.namespace
    this.namespaceKey = options.namespaceKey
    this.keypair = options.keypair
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Store text and return its CID */
  async ingest(text: string, metadata?: Record<string, unknown>): Promise<string> {
    const payload: Record<string, unknown> = {
      text,
      ...(metadata ? { metadata } : {}),
      ...this.namespaceAuth(),
    }
    const response = await this.post<IngestResponse>('IngestSynapse', payload)
    if (response.error) throw new IngestError(response.error as string)
    if (!response.cid) throw new IngestError('Miner did not return a CID')
    return response.cid
  }

  /** Store a pre-computed embedding and return its CID */
  async ingestEmbedding(embedding: number[], metadata?: Record<string, unknown>): Promise<string> {
    const payload: Record<string, unknown> = {
      raw_embedding: embedding,
      ...(metadata ? { metadata } : {}),
      ...this.namespaceAuth(),
    }
    const response = await this.post<IngestResponse & { error?: string }>('IngestSynapse', payload)
    if (response.error) throw new IngestError(response.error)
    if (!response.cid) throw new IngestError('Miner did not return a CID')
    return response.cid
  }

  /** Query the miner for top-K results */
  async query(
    text: string,
    options?: { topK?: number }
  ): Promise<QueryResponse['results']> {
    const payload: Record<string, unknown> = {
      query_text: text,
      top_k: options?.topK ?? 10,
      ...this.namespaceAuth(),
    }
    const response = await this.post<QueryResponse & { error?: string }>('QuerySynapse', payload)
    if (response.error) throw new QueryError(response.error as string)
    return response.results ?? []
  }

  /** Check if the miner is online and healthy */
  async health(): Promise<HealthResponse> {
    const url = `${this.minerUrl}/health`
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(this.timeout) })
      return resp.json() as Promise<HealthResponse>
    } catch (err: unknown) {
      if (err instanceof TypeError || (err as Error).name === 'TimeoutError') {
        throw new MinerOfflineError(url, err as Error)
      }
      throw new EngramError(`Health check failed: ${(err as Error).message}`)
    }
  }

  /** Quick liveness check */
  async isOnline(): Promise<boolean> {
    try {
      await this.health()
      return true
    } catch {
      return false
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  /** Build namespace auth fields for a request body */
  private namespaceAuth(): NamespaceAuth {
    if (!this.namespace) return {}
    if (this.keypair) {
      const ts = Date.now()
      const msg = new TextEncoder().encode(`engram-ns:${this.namespace}:${ts}`)
      const sig = '0x' + Buffer.from(this.keypair.sign(msg)).toString('hex')
      return {
        namespace: this.namespace,
        namespace_hotkey: this.keypair.ss58Address,
        namespace_sig: sig,
        namespace_timestamp_ms: ts,
      }
    }
    return { namespace: this.namespace, namespace_key: this.namespaceKey }
  }

  /** Sign a request payload if a keypair is available */
  private signRequest(endpoint: string, payload: Record<string, unknown>): Record<string, unknown> {
    if (!this.keypair) return payload

    const nonce = Date.now()
    // Build canonical message: nonce:endpoint:sha256(sorted_payload)
    const sorted = JSON.stringify(payload, Object.keys(payload).sort())
    const bodyHash = this.sha256(sorted)
    const canonical = `${nonce}:${endpoint}:${bodyHash}`
    const sig = '0x' + Buffer.from(this.keypair.sign(new TextEncoder().encode(canonical))).toString('hex')

    return {
      hotkey: this.keypair.ss58Address,
      nonce,
      signature: sig,
      ...payload,
    }
  }

  /** POST JSON to a miner endpoint, returning parsed JSON */
  private async post<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const url = `${this.minerUrl}/${endpoint}`
    const body = this.signRequest(endpoint, payload)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        return err as T
      }
      return resp.json() as Promise<T>
    } catch (err: unknown) {
      if (err instanceof TypeError || (err as Error).name === 'TimeoutError') {
        throw new MinerOfflineError(url, err as Error)
      }
      throw new EngramError(`Request failed: ${(err as Error).message}`)
    }
  }

  /** SHA-256 hex digest */
  private sha256(input: string): string {
    // Node.js crypto
    const { createHash } = require('crypto')
    return createHash('sha256').update(input).digest('hex')
  }
}
