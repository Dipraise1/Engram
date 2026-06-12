import * as crypto from 'crypto';
import nacl from 'tweetnacl';

const _KEY_LEN = 32;
const _IV_LEN = 12;
const _X25519_LEN = 32;
const _HKDF_INFO = Buffer.from("engram-hybrid-v1");

function _aesgcm_encrypt(key: Buffer, plaintext: Buffer): Buffer {
  const iv = crypto.randomBytes(_IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]);
}

function _aesgcm_decrypt(key: Buffer, blob: Buffer): Buffer {
  const iv = blob.subarray(0, _IV_LEN);
  const ct = blob.subarray(_IV_LEN, blob.length - 16);
  const tag = blob.subarray(blob.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (err) {
    throw new Error("Decryption failed — data may be tampered or the key is wrong.");
  }
}

function _hkdf(sharedSecret: Buffer, salt: Buffer): Buffer {
  if (crypto.hkdfSync) {
    return Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, _HKDF_INFO, _KEY_LEN));
  } else {
    // Polyfill or fallback if old node
    throw new Error('crypto.hkdfSync not available');
  }
}

function _serialize_payload(text: string | null, metadata: Record<string, any>): Buffer {
  return Buffer.from(JSON.stringify({ text: text || "", metadata: metadata }), "utf-8");
}

function _deserialize_payload(data: Buffer): { text: string, metadata: Record<string, any> } {
  const payload = JSON.parse(data.toString("utf-8"));
  return { text: payload.text || "", metadata: payload.metadata || {} };
}

export function generateKeypair(): { privateKey: Buffer, publicKey: Buffer } {
  const kp = nacl.box.keyPair();
  return {
    privateKey: Buffer.from(kp.secretKey),
    publicKey: Buffer.from(kp.publicKey)
  };
}

export function publicKeyFromPrivate(privateKeyBytes: Buffer): Buffer {
  const pub = nacl.scalarMult.base(new Uint8Array(privateKeyBytes));
  return Buffer.from(pub);
}

function _derive_key_pbkdf2(namespace: string, namespaceKey: string): Buffer {
  return crypto.pbkdf2Sync(namespaceKey, namespace, 100000, 32, 'sha256');
}

export class NamespaceEncryption {
  private _key: Buffer;

  constructor(namespace: string, namespaceKey: string) {
    this._key = _derive_key_pbkdf2(namespace, namespaceKey);
  }

  encryptPayload(text: string | null, metadata: Record<string, any>): string {
    const blob = _aesgcm_encrypt(this._key, _serialize_payload(text, metadata));
    return blob.toString('base64url');
  }

  decryptPayload(blob: string): { text: string, metadata: Record<string, any> } {
    const raw = Buffer.from(blob, 'base64url');
    return _deserialize_payload(_aesgcm_decrypt(this._key, raw));
  }

  decryptResults(results: any[]): any[] {
    const out: any[] = [];
    for (const r of results) {
      const copy = { ...r };
      const metadata = copy.metadata || {};
      const encBlob = metadata['_enc'];
      if (encBlob) {
        try {
          const decrypted = this.decryptPayload(encBlob);
          delete metadata['_enc'];
          copy.metadata = { ...metadata, ...decrypted.metadata };
          copy.text = decrypted.text;
        } catch (e) {
          copy.text = "<decryption failed>";
        }
      }
      out.push(copy);
    }
    return out;
  }
}

export class HybridEncryption {
  private _privateKey?: Buffer;
  private _publicKey: Buffer;

  constructor({ privateKey, publicKey }: { privateKey?: Buffer, publicKey?: Buffer }) {
    if (privateKey) {
      if (privateKey.length !== _X25519_LEN) throw new Error("Private key must be 32 bytes");
      this._privateKey = privateKey;
      this._publicKey = publicKey || publicKeyFromPrivate(privateKey);
    } else if (publicKey) {
      if (publicKey.length !== _X25519_LEN) throw new Error("Public key must be 32 bytes");
      this._publicKey = publicKey;
    } else {
      throw new Error("Must provide privateKey or publicKey");
    }
  }

  encryptPayload(text: string | null, metadata: Record<string, any>): string {
    const ephemeral = generateKeypair();
    const sharedSecret = Buffer.from(nacl.scalarMult(new Uint8Array(ephemeral.privateKey), new Uint8Array(this._publicKey)));
    const key = _hkdf(sharedSecret, ephemeral.publicKey);
    const aesBlob = _aesgcm_encrypt(key, _serialize_payload(text, metadata));
    const finalBlob = Buffer.concat([ephemeral.publicKey, aesBlob]);
    return finalBlob.toString('base64url');
  }

  decryptPayload(blob: string): { text: string, metadata: Record<string, any> } {
    if (!this._privateKey) throw new Error("Cannot decrypt without private key");
    const raw = Buffer.from(blob, 'base64url');
    if (raw.length < _X25519_LEN + _IV_LEN + 16) throw new Error("Payload too short");
    
    const ephemeralPublic = raw.subarray(0, _X25519_LEN);
    const aesBlob = raw.subarray(_X25519_LEN);
    
    const sharedSecret = Buffer.from(nacl.scalarMult(new Uint8Array(this._privateKey), new Uint8Array(ephemeralPublic)));
    const key = _hkdf(sharedSecret, ephemeralPublic);
    
    return _deserialize_payload(_aesgcm_decrypt(key, aesBlob));
  }

  decryptResults(results: any[]): any[] {
    const out: any[] = [];
    for (const r of results) {
      const copy = { ...r };
      const metadata = copy.metadata || {};
      const encBlob = metadata['_enc'];
      if (encBlob) {
        try {
          const decrypted = this.decryptPayload(encBlob);
          delete metadata['_enc'];
          copy.metadata = { ...metadata, ...decrypted.metadata };
          copy.text = decrypted.text;
        } catch (e) {
          copy.text = "<decryption failed>";
        }
      }
      out.push(copy);
    }
    return out;
  }
}
