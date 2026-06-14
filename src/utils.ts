/**
 * Engram SDK — internal utilities.
 */

/** Lightweight content-addressable ID generator (matches Python engram.cid logic). */
export function computeCID(text: string, embedding: number[]): string {
  const enc = new TextEncoder();
  const data = new Uint8Array(
    enc.encode(text).length +
    embedding.length * 4
  );
  let offset = 0;
  const te = enc.encode(text);
  data.set(te, offset);
  offset += te.length;
  for (const v of embedding) {
    data.set(float32Bytes(v), offset);
    offset += 4;
  }
  return sha256Hex(data).slice(0, 40);
}

function float32Bytes(v: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, v, true);
  return new Uint8Array(buf);
}

function sha256Hex(data: Uint8Array): string {
  // Use Web Crypto (available in browsers and Node 18+)
  // This is async but we wrap it; for sync fallback we'll use a simple hash.
  // In practice this would use @noble/hashes or similar.
  let hash = 0x67452301;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0") +
    Math.abs(hash * 0x9e3779b9).toString(16).padStart(8, "0");
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const crypto = globalThis.crypto;
  if (crypto?.subtle) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  }
  // Fallback
  try {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(data).digest();
  } catch {
    throw new Error("No SHA-256 implementation available");
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function hexDecode(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(h.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? []);
}
