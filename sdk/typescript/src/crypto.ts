/**
 * Cryptographic utilities for Engram SDK.
 *
 * - sr25519 signing for namespace authentication (optional, via @polkadot/util-crypto)
 * - X25519 key agreement for namespace encryption (Node.js crypto)
 */

import type { Metadata } from './types.js';

// ---------------------------------------------------------------------------
// sr25519 helpers (optional dependency — fails gracefully if not installed)
// ---------------------------------------------------------------------------

let _polkadotCrypto: {
  cryptoWaitReady: () => Promise<boolean>;
  sr25519Sign: (message: Uint8Array, keypair: { publicKey: Uint8Array; secretKey: Uint8Array }) => Uint8Array;
  encodeAddress: (publicKey: Uint8Array, ss58Format?: number) => string;
} | null = null;

let _polkadotLoaded = false;
let _polkadotLoadAttempted = false;

async function ensurePolkadot(): Promise<boolean> {
  if (_polkadotLoaded) return true;
  if (_polkadotLoadAttempted) return false;
  _polkadotLoadAttempted = true;

  try {
    const pkg = await import('@polkadot/util-crypto');
    _polkadotCrypto = {
      cryptoWaitReady: pkg.cryptoWaitReady,
      sr25519Sign: pkg.sr25519Sign,
      encodeAddress: pkg.encodeAddress,
    };
    await pkg.cryptoWaitReady();
    _polkadotLoaded = true;
    return true;
  } catch {
    return false;
  }
}

/** Check whether sr25519 support is available. */
export async function isSr25519Available(): Promise<boolean> {
  return ensurePolkadot();
}

/**
 * Sign a namespace-auth message using the provided sr25519 keypair.
 * Returns an auth header object, or an empty object if namespace is not set.
 */
export async function namespaceAuth(
  namespace: string | undefined,
  namespaceKey: string | undefined,
  keypair: unknown | undefined,
): Promise<Metadata> {
  if (!namespace) return {};

  // If keypair is provided, do sr25519 signing
  if (keypair) {
    const available = await ensurePolkadot();
    if (!available) {
      throw new Error(
        'sr25519 keypair provided but @polkadot/util-crypto is not installed. ' +
        'Install with: npm install @polkadot/util-crypto',
      );
    }

    const ts = Date.now();
    const msg = new TextEncoder().encode(`engram-ns:${namespace}:${ts}`);
    const kp = keypair as { sign: (msg: Uint8Array) => Uint8Array; publicKey: Uint8Array };

    // Use polkadot sr25519Sign
    let sig: Uint8Array;
    let address: string;
    try {
      // For KeyringPair, use its own sign method
      sig = kp.sign(msg);
      // Use polkadot encodeAddress for ss58
      address = _polkadotCrypto!.encodeAddress(kp.publicKey, 42);
    } catch {
      // Fallback: use polkadot's sr25519Sign directly
      sig = _polkadotCrypto!.sr25519Sign(
        msg,
        kp as unknown as { publicKey: Uint8Array; secretKey: Uint8Array },
      );
      address = _polkadotCrypto!.encodeAddress((kp as unknown as { publicKey: Uint8Array }).publicKey, 42);
    }

    const sigHex = '0x' + Buffer.from(sig).toString('hex');
    return {
      namespace,
      namespace_hotkey: address,
      namespace_sig: sigHex,
      namespace_timestamp_ms: ts,
    };
  }

  // No keypair: use plain namespace_key
  return {
    namespace,
    namespace_key: namespaceKey || '',
  };
}

// ---------------------------------------------------------------------------
// X25519 encryption helpers (Node.js built-in crypto)
// ---------------------------------------------------------------------------

/**
 * Derive a shared secret using X25519 ECDH.
 * Returns 32-byte shared secret as Buffer.
 */
export function x25519SharedSecret(
  privateKey: Buffer,
  peerPublicKey: Buffer,
): Buffer {
  const ecdh = require('crypto').createECDH('x25519');
  ecdh.setPrivateKey(privateKey);
  return ecdh.computeSecret(peerPublicKey);
}

/**
 * Generate an X25519 key pair.
 * Returns { publicKey: Buffer, privateKey: Buffer }.
 */
export function x25519GenerateKeyPair(): { publicKey: Buffer; privateKey: Buffer } {
  const ecdh = require('crypto').createECDH('x25519');
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey(),
    privateKey: ecdh.getPrivateKey(),
  };
}

/**
 * Encrypt data using AES-256-GCM with a shared secret.
 * Returns { ciphertext, iv, tag } as hex strings.
 */
export function aesGcmEncrypt(
  sharedSecret: Buffer,
  plaintext: string,
): { ciphertext: string; iv: string; tag: string } {
  const crypto = require('crypto');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret.slice(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt data using AES-256-GCM with a shared secret.
 */
export function aesGcmDecrypt(
  sharedSecret: Buffer,
  ciphertext: string,
  iv: string,
  tag: string,
): string {
  const crypto = require('crypto');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    sharedSecret.slice(0, 32),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf-8');
}
