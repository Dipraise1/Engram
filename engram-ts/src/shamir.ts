/**
 * Shamir's Secret Sharing over GF(256).
 * Splits a byte sequence into N shares such that any K shares reconstruct
 * the original, but K-1 shares reveal nothing (information-theoretic).
 */

// -- GF(256) arithmetic with AES irreducible polynomial 0x11b ---

function gfMul(a: number, b: number): number {
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    b >>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11b;
  }
  return result & 0xff;
}

function gfPow(base: number, exp: number): number {
  let result = 1;
  base &= 0xff;
  while (exp > 0) {
    if (exp & 1) result = gfMul(result, base);
    base = gfMul(base, base);
    exp >>= 1;
  }
  return result;
}

function gfInv(a: number): number {
  if (a === 0) throw new Error("No inverse for 0 in GF(256)");
  return gfPow(a, 254);
}

function polyEval(coeffs: number[], x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coeffs[i];
  }
  return result;
}

function lagrangeAtZero(xs: number[], ys: number[]): number {
  let result = 0;
  const k = xs.length;
  for (let i = 0; i < k; i++) {
    let numer = 1;
    let denom = 1;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      numer = gfMul(numer, xs[j]);
      denom = gfMul(denom, xs[i] ^ xs[j]);
    }
    result ^= gfMul(ys[i], gfMul(numer, gfInv(denom)));
  }
  return result;
}

// -- Public API -------------------------------------------------------

export interface KeyShare {
  index: number;
  data: Uint8Array;
  threshold: number;
  total: number;
}

export function splitSecret(
  secret: Uint8Array,
  threshold: number,
  total: number
): KeyShare[] {
  if (secret.length === 0) throw new Error("secret must be non-empty");
  if (threshold < 2) throw new Error("threshold must be >= 2");
  if (threshold > total) throw new Error("threshold cannot exceed total");
  if (total > 255) throw new Error("total shares cannot exceed 255");

  const shareData: number[][] = Array.from({ length: total }, () => []);

  for (let b = 0; b < secret.length; b++) {
    const coeffs: number[] = [secret[b]];
    for (let d = 1; d < threshold; d++) {
      coeffs.push(Math.floor(Math.random() * 256));
    }
    for (let i = 0; i < total; i++) {
      shareData[i].push(polyEval(coeffs, i + 1));
    }
  }

  return shareData.map((data, i) => ({
    index: i + 1,
    data: new Uint8Array(data),
    threshold,
    total,
  }));
}

export function reconstructSecret(shares: KeyShare[]): Uint8Array {
  if (shares.length === 0) throw new Error("No shares provided");
  const threshold = shares[0].threshold;
  if (shares.length < threshold) {
    throw new Error("Need " + threshold + " shares; got " + shares.length);
  }
  const secretLen = shares[0].data.length;
  for (const s of shares) {
    if (s.data.length !== secretLen) {
      throw new Error("All shares must have the same byte length");
    }
  }
  const indices = shares.map(s => s.index);
  if (new Set(indices).size !== indices.length) {
    throw new Error("Duplicate share indices");
  }

  const top = shares.slice(0, threshold);
  const xs = top.map(s => s.index);
  const result = new Uint8Array(secretLen);
  for (let i = 0; i < secretLen; i++) {
    result[i] = lagrangeAtZero(xs, top.map(s => s.data[i]));
  }
  return result;
}
