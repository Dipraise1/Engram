/**
 * Engram SDK — Exception hierarchy.
 *
 * Mirrors the Python SDK error classes so JS/TS consumers get
 * the same catch semantics.
 */

/** Base class for all Engram SDK errors. */
export class EngramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngramError";
  }
}

/** Raised when the miner cannot be reached (connection refused, timeout). */
export class MinerOfflineError extends EngramError {
  url: string;
  cause: Error | undefined;

  constructor(url: string, cause?: Error) {
    super(
      `Can't reach the miner at ${url}. Is it running? Start it with: python neurons/miner.py`
    );
    this.name = "MinerOfflineError";
    this.url = url;
    this.cause = cause;
  }
}

/** Raised when the miner returns an error on ingest. */
export class IngestError extends EngramError {
  constructor(message: string) {
    super(`Couldn't store your data: ${message}`);
    this.name = "IngestError";
  }
}

/** Raised when the miner returns an error on query. */
export class QueryError extends EngramError {
  constructor(message: string) {
    super(`Search failed: ${message}`);
    this.name = "QueryError";
  }
}

/** Raised when a CID returned by the miner fails validation. */
export class InvalidCIDError extends EngramError {
  cid: string;

  constructor(cid: string) {
    super(
      `The miner returned a malformed content ID (${JSON.stringify(cid)}). ` +
        "This is a miner-side issue — try a different miner or report it."
    );
    this.name = "InvalidCIDError";
    this.cid = cid;
  }
}
