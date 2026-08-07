/**
 * Exception classes for Engram SDK.
 */

/** Base error for all Engram-related failures. */
export class EngramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngramError';
  }
}

/** Raised when the miner is unreachable or returns HTTP errors. */
export class MinerOfflineError extends EngramError {
  constructor(message: string) {
    super(`Miner offline: ${message}`);
    this.name = 'MinerOfflineError';
  }
}

/** Raised when an ingest operation fails. */
export class IngestError extends EngramError {
  constructor(message: string) {
    super(`Ingest failed: ${message}`);
    this.name = 'IngestError';
  }
}

/** Raised when a query operation fails. */
export class QueryError extends EngramError {
  constructor(message: string) {
    super(`Query failed: ${message}`);
    this.name = 'QueryError';
  }
}

/** Raised when a CID is malformed or not found. */
export class InvalidCIDError extends EngramError {
  constructor(message: string) {
    super(`Invalid CID: ${message}`);
    this.name = 'InvalidCIDError';
  }
}
