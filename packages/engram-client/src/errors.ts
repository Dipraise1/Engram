/**
 * Engram SDK — Exception hierarchy matching engram/sdk/exceptions.py.
 */

/** Base class for all Engram SDK errors. */
export class EngramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngramError";
  }
}

/** Raised when the miner cannot be reached. */
export class MinerOfflineError extends EngramError {
  public readonly url: string;
  public readonly cause?: Error;

  constructor(url: string, cause?: Error) {
    super(
      `Can't reach the miner at ${url}. Is it running?`
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

/** Raised when a CID fails validation. */
export class InvalidCIDError extends EngramError {
  public readonly cid: string;

  constructor(cid: string) {
    super(
      `The miner returned a malformed content ID (${cid}). This is a miner-side issue.`
    );
    this.name = "InvalidCIDError";
    this.cid = cid;
  }
}
