/** Base class for all Engram SDK errors */
export class EngramError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngramError'
  }
}

/** Miner cannot be reached */
export class MinerOfflineError extends EngramError {
  constructor(
    public readonly url: string,
    public readonly cause?: Error
  ) {
    super(
      `Can't reach the miner at ${url}. Is it running? Start it with: python neurons/miner.py`
    )
    this.name = 'MinerOfflineError'
  }
}

/** Ingest operation failed */
export class IngestError extends EngramError {
  constructor(message: string) {
    super(`Ingest failed: ${message}`)
    this.name = 'IngestError'
  }
}

/** Query operation failed */
export class QueryError extends EngramError {
  constructor(message: string) {
    super(`Query failed: ${message}`)
    this.name = 'QueryError'
  }
}

/** CID format is invalid */
export class InvalidCIDError extends EngramError {
  constructor(cid: string) {
    super(`Invalid CID format: ${cid}`)
    this.name = 'InvalidCIDError'
  }
}
