/**
 * @engram/client — TypeScript SDK entry point
 *
 * Mirrors the public API of engram.sdk in the Python SDK.
 */

export { EngramClient } from "./client.js";
export type { Metadata, QueryResult, IngestImageResult, IngestUrlResult, IngestPdfResult } from "./client.js";

export {
  EngramError, MinerOfflineError,
  IngestError, QueryError, InvalidCIDError,
} from "./exceptions.js";

export {
  NamespaceEncryption, HybridEncryption,
  generateKeypair, publicKeyFromPrivate,
} from "./encryption.js";

export { splitSecret, reconstructSecret } from "./shamir.js";
export type { KeyShare } from "./shamir.js";
