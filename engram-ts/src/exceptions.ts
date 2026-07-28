/**
 * Engram SDK — Exception hierarchy (mirrors engram/sdk/exceptions.py)
 */

export class EngramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngramError";
  }
}

export class MinerOfflineError extends EngramError {
  url: string;
  cause?: Error;

  constructor(url: string, cause?: Error) {
    const msg = "Can't reach the miner at " + url + ". " +
      "Is it running? Start it with: python neurons/miner.py";
    super(msg);
    this.name = "MinerOfflineError";
    this.url = url;
    this.cause = cause;
  }
}

export class IngestError extends EngramError {
  constructor(message: string) {
    super("Couldn't store your data: " + message);
    this.name = "IngestError";
  }
}

export class QueryError extends EngramError {
  constructor(message: string) {
    super("Search failed: " + message);
    this.name = "QueryError";
  }
}

export class InvalidCIDError extends EngramError {
  cid: string;

  constructor(cid: string) {
    const msg = "The miner returned a malformed content ID (" +
      JSON.stringify(cid) + "). This is a miner-side issue — try a different miner or report it.";
    super(msg);
    this.name = "InvalidCIDError";
    this.cid = cid;
  }
}
