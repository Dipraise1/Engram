/**
 * @engram/client — TypeScript SDK for the Engram decentralized vector database.
 *
 * @example
 *   import { EngramClient } from "@engram/client";
 *
 *   const client = new EngramClient({ minerUrl: "http://127.0.0.1:8091" });
 *   const cid = await client.ingest("Hello from TypeScript!");
 *   console.log("Stored:", cid);
 */

export { EngramClient } from "./client";
export {
  EngramError,
  IngestError,
  InvalidCIDError,
  MinerOfflineError,
  QueryError,
} from "./errors";
export type {
  ClientOptions,
  HealthResponse,
  MemoryRecord,
  Metadata,
  QueryResult,
} from "./types";
