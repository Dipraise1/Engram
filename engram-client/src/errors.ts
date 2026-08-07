/**
 * Engram SDK — typed error hierarchy.
 * Mirrors engram/sdk/exceptions.py
 */

export class EngramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngramError";
  }
}

export class MinerOfflineError extends EngramError {
  readonly url: string;
  constructor(url: string, cause?: Error) {
    super(
      `Can't reach the miner at ${url}. Is it running? Start it with: python neurons/miner.py`
    );
    this.name = "MinerOfflineError";
    this.url = url;
    if (cause) this.cause = cause;
  }
}

export class IngestError extends EngramError {
  constructor(message: string) {
    super(`Couldn't store your data: ${message}`);
    this.name = "IngestError";
  }
}

export class QueryError extends EngramError {
  constructor(message: string) {
    super(`Search failed: ${message}`);
    this.name = "QueryError";
  }
}

export class InvalidCIDError extends EngramError {
  readonly cid: string;
  constructor(cid: string) {
    super(
      `The miner returned a malformed content ID (${JSON.stringify(cid)}). This is a miner-side issue.`
    );
    this.name = "InvalidCIDError";
    this.cid = cid;
  }
}

export class NamespaceAuthError extends EngramError {
  constructor(message: string) {
    super(`Namespace authentication failed: ${message}`);
    this.name = "NamespaceAuthError";
  }
}
