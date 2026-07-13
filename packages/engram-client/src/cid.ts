/**
 * Engram SDK — CID parsing and validation.
 *
 * CID format: <scheme>::<hash>
 * Example: v1::a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
 */

/** A parsed CID. */
export interface ParsedCID {
  scheme: string;
  hash: string;
  encoded: string;
}

/**
 * Parse and validate a CID string.
 * @throws {Error} If the CID format is invalid.
 */
export function parseCID(cid: string): ParsedCID {
  if (!cid || typeof cid !== "string") {
    throw new Error(`Invalid CID: empty or non-string`);
  }

  const parts = cid.split("::");
  if (parts.length !== 2) {
    throw new Error(`Invalid CID format: expected 'scheme::hash', got '${cid}'`);
  }

  const [scheme, hash] = parts;

  if (!scheme || scheme.length === 0) {
    throw new Error(`Invalid CID: empty scheme`);
  }

  if (!hash || hash.length === 0) {
    throw new Error(`Invalid CID: empty hash`);
  }

  // Hash should be hex-encoded (at minimum 8 chars for a real CID)
  if (hash.length < 8) {
    throw new Error(`Invalid CID: hash too short (${hash.length} chars)`);
  }

  const hexRegex = /^[0-9a-f]+$/i;
  if (!hexRegex.test(hash)) {
    throw new Error(`Invalid CID: hash is not valid hex`);
  }

  return { scheme, hash, encoded: cid };
}

/**
 * Validate a CID string. Returns true if valid, false otherwise.
 */
export function isValidCID(cid: string): boolean {
  try {
    parseCID(cid);
    return true;
  } catch {
    return false;
  }
}
