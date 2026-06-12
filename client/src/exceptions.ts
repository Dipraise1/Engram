export class EngramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngramError';
  }
}

export class MinerOfflineError extends EngramError {
  url: string;
  cause?: Error;

  constructor(url: string, cause?: Error) {
    super(`Can't reach the miner at ${url}. Is it running? Start it with: python neurons/miner.py`);
    this.name = 'MinerOfflineError';
    this.url = url;
    this.cause = cause;
  }
}

export class IngestError extends EngramError {
  constructor(message: string) {
    super(`Couldn't store your data: ${message}`);
    this.name = 'IngestError';
  }
}

export class QueryError extends EngramError {
  constructor(message: string) {
    super(`Search failed: ${message}`);
    this.name = 'QueryError';
  }
}

export class InvalidCIDError extends EngramError {
  cid: string;

  constructor(cid: string) {
    super(`The miner returned a malformed content ID ('${cid}'). This is a miner-side issue — try a different miner or report it.`);
    this.name = 'InvalidCIDError';
    this.cid = cid;
  }
}
