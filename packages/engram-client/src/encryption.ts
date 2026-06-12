/**
 * Engram SDK — Client-side Encryption for Private Namespaces
 *
 * Implements X25519 ECDH + HKDF + AES-256-GCM encryption, matching the
 * Python SDK's HybridEncryption scheme.
 *
 * Wire format (base64url):
 *   ephemeral_public[32] || iv[12] || ciphertext+tag
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const IV_LEN = 12;     // GCM nonce
const KEY_LEN = 32;    // AES-256
const X25519_LEN = 32; // X25519 public key size
const HKDF_INFO = Buffer.from("engram-hybrid-v1", "utf-8");
const AES_TAG_LEN = 16;

/**
 * Generate a random X25519 keypair.
 * Returns { privateKey, publicKey } as Uint8Array.
 */
export function generateX25519Keypair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const { generateKeyPairSync } = require("crypto") as typeof import("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  // Extract raw 32-byte keys from DER-encoded format
  // SPKI public key: 12-byte header + 32 bytes raw = 44 bytes
  // PKCS8 private key: 16-byte header + 32 bytes raw = 48 bytes
  return {
    privateKey: privateKey.subarray(privateKey.length - 32),
    publicKey: publicKey.subarray(publicKey.length - 32),
  };
}

/**
 * Compute X25519 public key from private key.
 */
function computeX25519Public(privateKey: Uint8Array): Uint8Array {
  const { createPublicKey } = require("crypto") as typeof import("crypto");
  const key = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b656e032100", "hex"),
      privateKey,
    ]),
    format: "der",
    type: "spki",
  });
  const raw = key.export({ type: "spki", format: "der" });
  return raw.subarray(raw.length - 32);
}

/**
 * Perform X25519 ECDH key agreement.
 */
function ecdh(privateKey: Uint8Array, publicKey: Uint8Array): Buffer {
  const { createPrivateKey, createPublicKey, diffieHellman } = require("crypto") as typeof import("crypto");

  const pkcs8Priv = Buffer.concat([
    Buffer.from("302e020100300506032b656604220420", "hex"),
    privateKey,
  ]);
  const spkiPub = Buffer.concat([
    Buffer.from("302a300506032b656e032100", "hex"),
    publicKey,
  ]);

  const priv = createPrivateKey({ key: pkcs8Priv, format: "der", type: "pkcs8" });
  const pub = createPublicKey({ key: spkiPub, format: "der", type: "spki" });

  // @ts-ignore - Node.js 18+ diffieHellman API supports (privateKey, publicKey)
  return diffieHellman(priv, pub);
}

/**
 * HKDF-SHA256 key derivation.
 */
function hkdf(
  salt: Buffer,
  ikm: Buffer,
  info: Buffer,
  length: number
): Buffer {
  const { createHmac } = require("crypto") as typeof import("crypto");

  // Extract
  const prk = createHmac("sha256", salt).update(ikm).digest();

  // Expand
  const N = Math.ceil(length / 32);
  const T: Buffer[] = [];
  for (let i = 1; i <= N; i++) {
    const data = i === 1
      ? Buffer.concat([T[i - 2] || Buffer.alloc(0), info, Buffer.from([i])])
      : Buffer.concat([T[i - 2], info, Buffer.from([i])]);
    T.push(createHmac("sha256", prk).update(data).digest());
  }

  return Buffer.concat(T).slice(0, length);
}

/**
 * HybridEncryption — X25519 ECDH + HKDF + AES-256-GCM.
 *
 * Encrypt: generate ephemeral key → ECDH → HKDF → AES-GCM.
 * Decrypt: extract ephemeral key → ECDH → HKDF → AES-GCM.
 */
export class HybridEncryption {
  private privateKey?: Uint8Array;
  private publicKey?: Uint8Array;

  /**
   * @param privateKey - For encrypt+decrypt (full access).
   * @param publicKey  - For encrypt only (write-only client).
   */
  constructor(opts: { privateKey?: Uint8Array; publicKey?: Uint8Array }) {
    if (!opts.privateKey && !opts.publicKey) {
      throw new Error("HybridEncryption requires either privateKey or publicKey");
    }
    this.privateKey = opts.privateKey;
    this.publicKey = opts.publicKey || computeX25519Public(opts.privateKey!);
  }

  /**
   * Encrypt a payload (text + metadata) for the recipient.
   * Returns base64url-encoded ciphertext.
   */
  encryptPayload(text: string, metadata: Record<string, unknown>): string {
    const plaintext = JSON.stringify({ text, metadata });
    const encrypted = this.encryptRaw(Buffer.from(plaintext, "utf-8"));
    return encrypted.toString("base64url");
  }

  /**
   * Decrypt a payload and return { text, metadata }.
   */
  decryptPayload(
    blob: string
  ): { text: string; metadata: Record<string, unknown> } {
    if (!this.privateKey) {
      throw new Error("Cannot decrypt without private key");
    }
    const raw = Buffer.from(blob, "base64url");
    const decrypted = this.decryptRaw(raw);
    const parsed = JSON.parse(decrypted.toString("utf-8"));
    return {
      text: parsed.text || "",
      metadata: parsed.metadata || {},
    };
  }

  /**
   * Encrypt raw bytes. Returns Buffer(ephemeral_public[32] || iv[12] || ciphertext+tag).
   */
  encryptRaw(plaintext: Buffer): Buffer {
    // Generate ephemeral keypair
    const { generateKeyPairSync, createPrivateKey, createPublicKey, diffieHellman } = require("crypto") as typeof import("crypto");
    const eph = generateKeyPairSync("x25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    const ephemeralPub = eph.publicKey.subarray(eph.publicKey.length - 32);

    // ECDH
    const spkiPub = Buffer.concat([
      Buffer.from("302a300506032b656e032100", "hex"),
      Buffer.from(this.publicKey!),
    ]);
    const pubKey = createPublicKey({ key: spkiPub, format: "der", type: "spki" });
    const privKey = createPrivateKey({ key: eph.privateKey, format: "der", type: "pkcs8" });
    // @ts-ignore - Node.js 18+ diffieHellman API supports (privateKey, publicKey)
    const sharedSecret = diffieHellman(privKey, pubKey);

    // HKDF
    const key = hkdf(ephemeralPub, sharedSecret, HKDF_INFO, KEY_LEN);

    // AES-256-GCM
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // Wire: ephemeral_pub || iv || ciphertext+tag
    return Buffer.concat([ephemeralPub, iv, encrypted]);
  }

  /**
   * Decrypt raw bytes.
   */
  decryptRaw(ciphertext: Buffer): Buffer {
    if (!this.privateKey) {
      throw new Error("Cannot decrypt without private key");
    }

    // Parse wire format
    const ephemeralPub = ciphertext.subarray(0, X25519_LEN);
    const iv = ciphertext.subarray(X25519_LEN, X25519_LEN + IV_LEN);
    const encrypted = ciphertext.subarray(X25519_LEN + IV_LEN);

    // ECDH
    const { createPrivateKey, createPublicKey, diffieHellman } = require("crypto") as typeof import("crypto");
    const pkcs8Priv = Buffer.concat([
      Buffer.from("302e020100300506032b656604220420", "hex"),
      Buffer.from(this.privateKey),
    ]);
    const spkiPub = Buffer.concat([
      Buffer.from("302a300506032b656e032100", "hex"),
      ephemeralPub,
    ]);
    const priv = createPrivateKey({ key: pkcs8Priv, format: "der", type: "pkcs8" });
    const pub = createPublicKey({ key: spkiPub, format: "der", type: "spki" });
    // @ts-ignore - Node.js 18+ diffieHellman API
    const sharedSecret = diffieHellman(priv, pub);

    // HKDF
    const key = hkdf(ephemeralPub, sharedSecret, HKDF_INFO, KEY_LEN);

    // AES-256-GCM
    const tag = encrypted.subarray(encrypted.length - AES_TAG_LEN);
    const data = encrypted.subarray(0, encrypted.length - AES_TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  /** Get the public key. */
  getPublicKey(): Uint8Array {
    return this.publicKey!;
  }
}

/**
 * NamespaceEncryption — password-based AES-256-GCM (legacy).
 */
export class NamespaceEncryption {
  private key: Buffer;

  constructor(namespace: string, namespaceKey: string) {
    // PBKDF2-HMAC-SHA256 (100k iterations, salt = namespace)
    const { pbkdf2Sync } = require("crypto") as typeof import("crypto");
    this.key = pbkdf2Sync(
      namespaceKey,
      namespace,
      100_000,
      KEY_LEN,
      "sha256"
    );
  }

  encryptPayload(text: string, metadata: Record<string, unknown>): string {
    const plaintext = JSON.stringify({ text, metadata });
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plaintext, "utf-8")),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return Buffer.concat([iv, encrypted]).toString("base64url");
  }

  decryptPayload(
    blob: string
  ): { text: string; metadata: Record<string, unknown> } {
    const raw = Buffer.from(blob, "base64url");
    const iv = raw.subarray(0, IV_LEN);
    const encrypted = raw.subarray(IV_LEN);
    const tag = encrypted.subarray(encrypted.length - AES_TAG_LEN);
    const data = encrypted.subarray(0, encrypted.length - AES_TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString("utf-8"));
    return {
      text: parsed.text || "",
      metadata: parsed.metadata || {},
    };
  }

  encryptRaw(bytes: Buffer): Buffer {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(bytes),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return Buffer.concat([iv, encrypted]);
  }
}

/** Union type for encryption engines. */
export type EncryptionEngine = HybridEncryption | NamespaceEncryption;
