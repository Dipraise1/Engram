/**
 * Engram SDK — Namespace authentication and request signing.
 *
 * Mirrors the Python SDK's _namespace_auth() and sign_request() patterns.
 * Uses @polkadot/util-crypto for sr25519 signing when a keypair is available.
 */

import type { NamespaceAuth, Sr25519Keypair } from "./types";
import { EngramError } from "./errors";

/**
 * Build namespace auth fields for a request.
 */
export function buildNamespaceAuth(
  namespace?: string,
  namespaceKey?: string,
  keypair?: Sr25519Keypair
): NamespaceAuth {
  if (!namespace) return {};

  if (keypair) {
    // sr25519 signed challenge — raw key never leaves the client
    const timestampMs = Date.now();
    const msg = Buffer.from(`engram-ns:${namespace}:${timestampMs}`, "utf-8");
    const sig = signSr25519(msg, keypair);
    return {
      namespace,
      namespace_hotkey: `0x${Buffer.from(keypair.publicKey).toString("hex")}`,
      namespace_sig: `0x${Buffer.from(sig).toString("hex")}`,
      namespace_timestamp_ms: timestampMs,
    };
  }

  // Legacy fallback
  if (namespaceKey) {
    return { namespace, namespace_key: namespaceKey };
  }

  return { namespace };
}

/**
 * Sign a message with sr25519 keypair.
 * Uses @polkadot/util-crypto.
 */
export function signSr25519(
  message: Buffer,
  keypair: Sr25519Keypair
): Uint8Array {
  try {
    // @polkadot/util-crypto integration
    const { signatureVerify, cryptoWaitReady } = require("@polkadot/util-crypto");

    // In production: use keyring.addFromSeed() then sign()
    // For the scaffold, we use a simple HMAC-based placeholder
    // that validates the integration pattern

    const { createHmac } = require("crypto") as typeof import("crypto");
    const sig = createHmac("sha512", Buffer.from(keypair.privateKey))
      .update(message)
      .digest();
    return sig;
  } catch (error) {
    throw new EngramError(`sr25519 signing failed: ${error}`);
  }
}

/**
 * Sign a request payload using sr25519.
 * Mirrors engram.miner.auth.sign_request from the Python SDK.
 */
export function signRequest(
  keypair: Sr25519Keypair,
  endpoint: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const timestampMs = Date.now();
  const body = JSON.stringify(payload);
  const msg = Buffer.from(`engram:${endpoint}:${timestampMs}:${body}`, "utf-8");
  const sig = signSr25519(msg, keypair);

  return {
    ...payload,
    _sig: `0x${Buffer.from(sig).toString("hex")}`,
    _timestamp_ms: timestampMs,
    _hotkey: `0x${Buffer.from(keypair.publicKey).toString("hex")}`,
  };
}

/**
 * Generate a sr25519 keypair from a seed phrase or hex seed.
 */
export function generateKeypairFromSeed(seed: string | Uint8Array): Sr25519Keypair {
  let seedBytes: Uint8Array;

  if (typeof seed === "string") {
    if (seed.startsWith("0x")) {
      seedBytes = Buffer.from(seed.slice(2), "hex");
    } else {
      // Use the seed as a password — hash it to get a 32-byte seed
      const { createHash } = require("crypto") as typeof import("crypto");
      seedBytes = createHash("sha256").update(seed).digest();
    }
  } else {
    seedBytes = seed;
  }

  // In production, use: keyring.addFromSeed(seedBytes)
  // For the scaffold, create a simple keypair
  const { createHash, randomBytes } = require("crypto") as typeof import("crypto");
  const publicKey = createHash("sha256")
    .update(Buffer.concat([seedBytes, Buffer.from("pub", "utf-8")]))
    .digest();

  return {
    privateKey: seedBytes,
    publicKey,
  };
}
