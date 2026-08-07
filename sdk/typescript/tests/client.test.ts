/**
 * Unit tests for EngramClient.
 *
 * All HTTP calls are mocked via _setHttpAgent.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EngramClient } from '../src/client.js';
import {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from '../src/errors.js';
import type { ApiResponse, Metadata, EngramRecord } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFetch(responses: ApiResponse[]) {
  let idx = 0;
  return async (_url: string, _init: RequestInit): Promise<Response> => {
    const data = responses[idx++] ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => data,
    } as Response;
  };
}

function makeErrorFetch(status: number, message: string) {
  return async (_url: string, _init: RequestInit): Promise<Response> => {
    return {
      ok: false,
      status,
      statusText: message,
      json: async () => ({ error: message }),
    } as Response;
  };
}

function makeClient(responses: ApiResponse[]): EngramClient {
  const client = new EngramClient({ miner_url: 'http://test:8091' });
  client._setHttpAgent(makeMockFetch(responses));
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EngramClient', () => {
  // ---- Constructor ----
  describe('constructor', () => {
    it('should use default values', () => {
      const c = new EngramClient();
      expect(c.minerUrl).toBe('http://127.0.0.1:8091');
      expect(c.timeout).toBe(30_000);
      expect(c.namespace).toBeUndefined();
    });

    it('should strip trailing slash from miner_url', () => {
      const c = new EngramClient({ miner_url: 'http://example.com/' });
      expect(c.minerUrl).toBe('http://example.com');
    });

    it('should accept custom timeout', () => {
      const c = new EngramClient({ timeout: 5000 });
      expect(c.timeout).toBe(5000);
    });

    it('should store namespace options', () => {
      const c = new EngramClient({
        namespace: 'myns',
        namespace_key: 'key123',
      });
      expect(c.namespace).toBe('myns');
    });
  });

  // ---- Error classes ----
  describe('error classes', () => {
    it('EngramError is base', () => {
      const e = new EngramError('test');
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe('EngramError');
    });

    it('MinerOfflineError extends EngramError', () => {
      const e = new MinerOfflineError('test');
      expect(e).toBeInstanceOf(EngramError);
      expect(e.message).toContain('Miner offline');
    });

    it('IngestError extends EngramError', () => {
      const e = new IngestError('test');
      expect(e).toBeInstanceOf(EngramError);
      expect(e.message).toContain('Ingest failed');
    });

    it('QueryError extends EngramError', () => {
      const e = new QueryError('test');
      expect(e).toBeInstanceOf(EngramError);
      expect(e.message).toContain('Query failed');
    });

    it('InvalidCIDError extends EngramError', () => {
      const e = new InvalidCIDError('test');
      expect(e).toBeInstanceOf(EngramError);
      expect(e.message).toContain('Invalid CID');
    });
  });

  // ---- ingest ----
  describe('ingest', () => {
    it('returns CID on success', async () => {
      const c = makeClient([{ cid: 'abc123' }]);
      const cid = await c.ingest('Hello world');
      expect(cid).toBe('abc123');
    });

    it('throws IngestError when miner returns error', async () => {
      const c = makeClient([{ error: 'bad payload' }]);
      await expect(c.ingest('x')).rejects.toThrow(IngestError);
    });

    it('throws IngestError when CID is missing', async () => {
      const c = makeClient([{}]);
      await expect(c.ingest('x')).rejects.toThrow(IngestError);
    });
  });

  // ---- ingestEmbedding ----
  describe('ingestEmbedding', () => {
    it('returns CID on success', async () => {
      const c = makeClient([{ cid: 'emb456' }]);
      const cid = await c.ingestEmbedding([0.1, 0.2, 0.3]);
      expect(cid).toBe('emb456');
    });
  });

  // ---- query ----
  describe('query', () => {
    it('returns results array', async () => {
      const results = [
        { cid: 'a', score: 0.9, metadata: {} },
        { cid: 'b', score: 0.8, metadata: {} },
      ];
      const c = makeClient([{ results }]);
      const got = await c.query('search text', 5);
      expect(got).toEqual(results);
    });

    it('throws QueryError on error', async () => {
      const c = makeClient([{ error: 'search failed' }]);
      await expect(c.query('x')).rejects.toThrow(QueryError);
    });

    it('returns empty array when results missing', async () => {
      const c = makeClient([{}]);
      const got = await c.query('x');
      expect(got).toEqual([]);
    });
  });

  // ---- queryByVector ----
  describe('queryByVector', () => {
    it('returns results', async () => {
      const results = [{ cid: 'v1', score: 1.0, metadata: {} }];
      const c = makeClient([{ results }]);
      const got = await c.queryByVector([0.5, 0.5]);
      expect(got).toEqual(results);
    });
  });

  // ---- get ----
  describe('get', () => {
    it('returns record', async () => {
      const c = makeClient([{ cid: 'rec1', metadata: { foo: 'bar' } }]);
      const rec = await c.get('rec1');
      expect(rec.cid).toBe('rec1');
      expect(rec.metadata).toEqual({ foo: 'bar' });
    });

    it('throws InvalidCIDError on error', async () => {
      const c = makeClient([{ error: 'not found' }]);
      await expect(c.get('bad')).rejects.toThrow(InvalidCIDError);
    });
  });

  // ---- delete ----
  describe('delete', () => {
    it('returns true on success', async () => {
      const c = makeClient([{}]);
      const ok = await c.delete('rec1');
      expect(ok).toBe(true);
    });

    it('throws InvalidCIDError on error', async () => {
      const c = makeClient([{ error: 'gone' }]);
      await expect(c.delete('x')).rejects.toThrow(InvalidCIDError);
    });
  });

  // ---- list ----
  describe('list', () => {
    it('returns records', async () => {
      const records = [
        { cid: 'r1', metadata: {} },
        { cid: 'r2', metadata: {} },
      ];
      const c = makeClient([{ records }]);
      const got = await c.list();
      expect(got).toEqual(records);
    });

    it('throws QueryError on error', async () => {
      const c = makeClient([{ error: 'list failed' }]);
      await expect(c.list()).rejects.toThrow(QueryError);
    });
  });

  // ---- health ----
  describe('health', () => {
    it('returns health object', async () => {
      const c = makeClient([{ status: 'ok', vectors: 42, uid: 'abc' }]);
      const h = await c.health();
      expect(h.status).toBe('ok');
      expect(h.vectors).toBe(42);
      expect(h.uid).toBe('abc');
    });
  });

  // ---- isOnline ----
  describe('isOnline', () => {
    it('returns true when healthy', async () => {
      const c = makeClient([{ status: 'ok', vectors: 0, uid: '' }]);
      const ok = await c.isOnline();
      expect(ok).toBe(true);
    });

    it('returns false when offline', async () => {
      const c = new EngramClient({ miner_url: 'http://offline:9999' });
      c._setHttpAgent(async () => {
        throw new Error('Connection refused');
      });
      const ok = await c.isOnline();
      expect(ok).toBe(false);
    });
  });

  // ---- MinerOfflineError ----
  describe('network errors', () => {
    it('throws MinerOfflineError when fetch fails', async () => {
      const c = new EngramClient({ miner_url: 'http://dead:9999' });
      c._setHttpAgent(async () => {
        throw new Error('ECONNREFUSED');
      });
      await expect(c.health()).rejects.toThrow(MinerOfflineError);
    });

    it('throws MinerOfflineError on HTTP error', async () => {
      const c = new EngramClient({ miner_url: 'http://bad:9999' });
      c._setHttpAgent(makeErrorFetch(500, 'Internal Error'));
      await expect(c.health()).rejects.toThrow(MinerOfflineError);
    });
  });

  // ---- ingestConversation ----
  describe('ingestConversation', () => {
    it('ingests each message + summary', async () => {
      const responses: ApiResponse[] = [
        { cid: 'm1' },
        { cid: 'm2' },
        { cid: 'summary' },
      ];
      const c = makeClient(responses);
      const cids = await c.ingestConversation([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ]);
      expect(cids).toEqual(['m1', 'm2', 'summary']);
    });
  });

  // ---- ingestUrl ----
  describe('ingestUrl', () => {
    it('fetches and ingests URL content', async () => {
      const c = new EngramClient({ miner_url: 'http://test' });

      const htmlContent = '<html><head><title>Test Page</title></head><body><p>Hello world!</p></body></html>';

      // Mock _httpAgent for the ingest POST
      c._setHttpAgent(async (_url: string, _init: RequestInit) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ cid: 'url123' }),
        } as Response;
      });

      // Mock global fetch for the URL content fetch
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
        return {
          ok: true,
          status: 200,
          text: async () => htmlContent,
        } as Response;
      };

      try {
        const result = await c.ingestUrl('http://example.com');
        expect(result.cid).toBe('url123');
        expect(result.url).toBe('http://example.com');
        expect(result.title).toBe('Test Page');
        expect(result.chars).toBeGreaterThan(0);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
});
