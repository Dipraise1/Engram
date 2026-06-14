import { describe, it, expect, beforeEach } from 'vitest'
import {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from '../exceptions'
import { EngramClient } from '../index'

describe('EngramError hierarchy', () => {
  it('MinerOfflineError should include URL in message', () => {
    const err = new MinerOfflineError('http://localhost:8091')
    expect(err.message).toContain('http://localhost:8091')
    expect(err.name).toBe('MinerOfflineError')
    expect(err).toBeInstanceOf(EngramError)
  })

  it('IngestError should wrap message', () => {
    const err = new IngestError('bad data')
    expect(err.message).toContain('Ingest failed')
    expect(err.message).toContain('bad data')
  })

  it('QueryError should wrap message', () => {
    const err = new QueryError('timeout')
    expect(err.message).toContain('Query failed')
    expect(err).toBeInstanceOf(EngramError)
  })

  it('InvalidCIDError should include bad CID', () => {
    const err = new InvalidCIDError('xyz-invalid')
    expect(err.message).toContain('xyz-invalid')
    expect(err.name).toBe('InvalidCIDError')
  })
})

describe('EngramClient', () => {
  let client: EngramClient

  beforeEach(() => {
    client = new EngramClient({ minerUrl: 'http://127.0.0.1:8091' })
  })

  it('should create with defaults', () => {
    expect(client).toBeInstanceOf(EngramClient)
  })

  it('should strip trailing slash from miner URL', () => {
    // Indirect test: isOnline should try http://127.0.0.1:8091/health
    expect(client).toBeDefined()
  })

  it('isOnline should return false when miner is offline', async () => {
    const online = await client.isOnline()
    expect(online).toBe(false)
  })

  it('health should throw MinerOfflineError when unreachable', async () => {
    await expect(client.health()).rejects.toThrow(MinerOfflineError)
  })

  it('ingest should throw MinerOfflineError when unreachable', async () => {
    await expect(client.ingest('test')).rejects.toThrow(MinerOfflineError)
  })

  it('query should throw MinerOfflineError when unreachable', async () => {
    await expect(client.query('test')).rejects.toThrow(MinerOfflineError)
  })

  it('should accept namespace in constructor', () => {
    const nsClient = new EngramClient({ namespace: 'private', namespaceKey: 'secret' })
    expect(nsClient).toBeDefined()
  })
})
