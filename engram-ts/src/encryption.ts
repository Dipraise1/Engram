/**
 * Engram SDK — Client-side Encryption for Private Namespaces
 *
 * Two encryption schemes:
 * 1. NamespaceEncryption (password-based, PBKDF2 + AES-256-GCM)
 * 2. HybridEncryption (X25519 ECDH + HKDF + AES-256-GCM)
 *
 * Uses @noble/ciphers, @noble/curves, and @noble/hashes for
 * pure-JS crypto with no native dependencies.
 */

import { webcrypto } from "node:crypto";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { x25519 } from "@noble/curves/ed25519";
import { extract, expand } from "@noble/hashes/hkdf";

const IV_LEN = 12;
const KEY_LEN = 32;
const X25519_LEN = 32;
const PBKDF2_ITERATIONS = 100_000;
const HKDF_INFO = "engram-hybrid-v1";

// -- AES-256-GCM helpers using Web Crypto API -------------------------

function getKey(): Promise<CryptoKey> {
  // Key is derived elsewhere; this is the raw key wrapper
  throw new Error("Not used directly; see encrypt/decrypt below");
}

function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LEN));
  // Use Web Crypto for AES-256-GCM
  return iv; // placeholder — will use imported key
}

async function aes256GcmEncrypt(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LEN));
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw", key, { name: "AES-GCM", length: 256 },
    false, ["encrypt"]
  );
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plaintext
  );
  const result = new Uint8Array(IV_LEN + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), IV_LEN);
  return result;
}

async function aes256GcmDecrypt(key: Uint8Array, blob: Uint8Array): Promise<Uint8Array> {
  const iv = blob.slice(0, IV_LEN);
  const ct = blob.slice(IV_LEN);
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw", key, { name: "AES-GCM", length: 256 },
    false, ["decrypt"]
  );
  const decrypted = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ct
  );
  return new Uint8Array(decrypted);
}

// -- Helpers ----------------------------------------------------------

function serializePayload(text: string | null, metadata: Record<string, unknown>): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify({ text: text ?? "", metadata }));
}

function deserializePayload(data: Uint8Array): [string, Record<string, unknown>] {
  const decoder = new TextDecoder();
  const payload = JSON.parse(decoder.decode(data));
  return [payload.text ?? "", payload.metadata ?? {}];
}

function deriveKeyHkdf(sharedSecret: Uint8Array, salt: Uint8Array): Uint8Array {
  return hkdf(sha256, sharedSecret, salt, HKDF_INFO, KEY_LEN);
}

// -- Key generation ----------------------------------------------------

export function generateKeypair(): [Uint8Array, Uint8Array] {
  const privKey = x25519.utils.randomPrivateKey();
  const pubKey = x25519.getPublicKey(privKey);
  return [privKey, pubKey];
}

export function publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(privateKey);
}

// -- Password-based encryption (legacy) --------------------------------

export class NamespaceEncryption {
  private key: Uint8Array;

  constructor(namespace: string, namespaceKey: string) {
    // Note: async in real usage — pbkdf2Async returns a Promise
    // For simplicity we use a sync stub; real impl should await
    throw new Error("NamespaceEncryption requires async init — use initNamespaceEncryption()");
  }

  static async create(namespace: string, namespaceKey: string): Promise<NamespaceEncryption> {
    const inst = Object.create(NamespaceEncryption.prototype);
    const encoder = new TextEncoder();
    inst.key = pbkdf2Async(sha256, encoder.encode(namespaceKey), encoder.encode(namespace), {
      c: PBKDF2_ITERATIONS,
      dkLen: KEY_LEN,
    });
    return inst;
  }

  async encryptPayload(text: string | null, metadata: Record<string, unknown>): Promise<string> {
    const plaintext = serializePayload(text, metadata);
    const encrypted = await aes256GcmEncrypt(this.key, plaintext);
    return Buffer.from(encrypted).toString("base64url");
  }

  async decryptPayload(blob: string): Promise<[string, Record<string, unknown>]> {
    const raw = Buffer.from(blob, "base64url");
    const plaintext = await aes256GcmDecrypt(this.key, raw);
    return deserializePayload(plaintext);
  }

  async encryptRaw(data: Uint8Array): Promise<Uint8Array> {
    return aes256GcmEncrypt(this.key, data);
  }

  async decryptRaw(data: Uint8Array): Promise<Uint8Array> {
    return aes256GcmDecrypt(this.key, data);
  }
}

// -- Hybrid encryption (X25519 + HKDF + AES-256-GCM) -------------------

export class HybridEncryption {
  private privateKey?: Uint8Array;
  private publicKey: Uint8Array;

  constructor(opts: { privateKey?: Uint8Array; publicKey?: Uint8Array }) {
    if (!opts.privateKey && !opts.publicKey) {
      throw new Error("HybridEncryption requires at least one of: privateKey, publicKey");
    }
    this.privateKey = opts.privateKey;
    this.publicKey = opts.publicKey ?? publicKeyFromPrivate(opts.privateKey!);
  }

  async encryptPayload(text: string | null, metadata: Record<string, unknown>): Promise<string> {
    // 1. Generate ephemeral keypair
    const ephPriv = x25519.utils.randomPrivateKey();
    const ephPub = x25519.getPublicKey(ephPriv);

    // 2. ECDH
    const sharedSecret = x25519.getSharedSecret(ephPriv, this.publicKey);

    // 3. HKDF
    const aesKey = deriveKeyHkdf(sharedSecret, ephPub);

    // 4. AES-256-GCM
    const encrypted = await aes256GcmEncrypt(aesKey, serializePayload(text, metadata));

    // 5. Wire: ephemeral_public || iv || ciphertext+tag
    const wire = new Uint8Array(ephPub.length + encrypted.length);
    wire.set(ephPub, 0);
    wire.set(encrypted, ephPub.length);
    return Buffer.from(wire).toString("base64url");
  }

  async decryptPayload(blob: string): Promise<[string, Record<string, unknown>]> {
    if (!this.privateKey) {
      throw new Error(
        "This HybridEncryption instance has no private key — it can encrypt but not decrypt."
      );
    }
    const raw = Buffer.from(blob, "base64url");

    // 1. Extract ephemeral public key
    const ephPub = raw.subarray(0, X25519_LEN);
    const encrypted = raw.subarray(X25519_LEN);

    // 2. ECDH
    const sharedSecret = x25519.getSharedSecret(this.privateKey, ephPub);

    // 3. HKDF
    const aesKey = deriveKeyHkdf(sharedSecret, ephPub);

    // 4. AES-256-GCM decrypt
    const plaintext = await aes256GcmDecrypt(aesKey, encrypted);
    return deserializePayload(plaintext);
  }

  async encryptRaw(data: Uint8Array): Promise<Uint8Array> {
    const ephPriv = x25519.utils.randomPrivateKey();
    const ephPub = x25519.getPublicKey(ephPriv);
    const sharedSecret = x25519.getSharedSecret(ephPriv, this.publicKey);
    const aesKey = deriveKeyHkdf(sharedSecret, ephPub);
    const encrypted = await aes256GcmEncrypt(aesKey, data);
    const wire = new Uint8Array(ephPub.length + encrypted.length);
    wire.set(ephPub, 0);
    wire.set(encrypted, ephPub.length);
    return wire;
  }

  async decryptRaw(data: Uint8Array): Promise<Uint8Array> {
    if (!this.privateKey) throw new Error("No private key — cannot decrypt raw bytes.");
    const ephPub = data.subarray(0, X25519_LEN);
    const encrypted = data.subarray(X25519_LEN);
    const sharedSecret = x25519.getSharedSecret(this.privateKey, ephPub);
    const aesKey = deriveKeyHkdf(sharedSecret, ephPub);
    return aes256GcmDecrypt(aesKey, encrypted);
  }
}

function decryptResults(enc: NamespaceEncryption | HybridEncryption, results: any[]): any[] {
  return results.map(r => {
    const meta = r.metadata ?? {};
    const blob = meta._enc;
    if (blob && typeof enc.decryptPayload === "function") {
      try {
        enc.decryptPayload(blob).then(([_, dm]) => {
          r = { ...r, metadata: dm };
        });
      } catch {
        r = { ...r, metadata: { _error: "decryption_failed" } };
      }
    }
    return r;
  });
}
