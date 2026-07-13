import { describe, it, expect } from "vitest";
import { EngramClient } from "../src/client";
import { parseCID, isValidCID } from "../src/cid";
import {
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} from "../src/errors";
import { generateX25519Keypair, NamespaceEncryption } from "../src/encryption";
import { buildNamespaceAuth, generateKeypairFromSeed } from "../src/namespace";

describe("CID parsing", () => {
  it("should parse a valid CID", () => {
    const parsed = parseCID("v1::a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0");
    expect(parsed.scheme).toBe("v1");
    expect(parsed.hash).toBe("a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0");
  });

  it("should reject empty CID", () => {
    expect(() => parseCID("")).toThrow();
  });

  it("should reject CID without separator", () => {
    expect(() => parseCID("justahash")).toThrow();
  });

  it("should validate CID format", () => {
    expect(isValidCID("v1::abc123def456")).toBe(true);
    expect(isValidCID("")).toBe(false);
    expect(isValidCID("bad")).toBe(false);
  });
});

describe("Error classes", () => {
  it("should create EngramError with correct message", () => {
    const err = new EngramError("test error");
    expect(err.message).toBe("test error");
    expect(err.name).toBe("EngramError");
  });

  it("should create MinerOfflineError with URL", () => {
    const err = new MinerOfflineError("http://localhost:8091");
    expect(err.url).toBe("http://localhost:8091");
    expect(err.message).toContain("Can't reach the miner");
  });

  it("should create IngestError with context", () => {
    const err = new IngestError("miner rejected");
    expect(err.message).toContain("miner rejected");
  });

  it("should create InvalidCIDError with original CID", () => {
    const err = new InvalidCIDError("bad::cid");
    expect(err.cid).toBe("bad::cid");
  });
});

describe("Encryption", () => {
  it("should generate X25519 keypair", () => {
    const kp = generateX25519Keypair();
    expect(kp.privateKey.length).toBe(32);
    expect(kp.publicKey.length).toBe(32);
  });

  it("NamespaceEncryption should roundtrip", () => {
    const enc = new NamespaceEncryption("test-ns", "test-key");
    const blob = enc.encryptPayload("hello world", { source: "test" });
    const result = enc.decryptPayload(blob);
    expect(result.text).toBe("hello world");
    expect(result.metadata.source).toBe("test");
  });

  it("NamespaceEncryption should produce different ciphertexts each time", () => {
    const enc = new NamespaceEncryption("test-ns", "test-key");
    const blob1 = enc.encryptPayload("same text", {});
    const blob2 = enc.encryptPayload("same text", {});
    expect(blob1).not.toBe(blob2);
  });
});

describe("Namespace auth", () => {
  it("should return empty auth when no namespace", () => {
    const auth = buildNamespaceAuth();
    expect(auth).toEqual({});
  });

  it("should include namespace when provided", () => {
    const auth = buildNamespaceAuth("my-ns", "my-key");
    expect(auth.namespace).toBe("my-ns");
    expect(auth.namespace_key).toBe("my-key");
  });
});

describe("EngramClient", () => {
  it("should strip trailing slash from URL", () => {
    const client = new EngramClient({ minerUrl: "http://localhost:8091/" });
    expect(client.minerUrl).toBe("http://localhost:8091");
  });

  it("should use defaults", () => {
    const client = new EngramClient();
    expect(client.minerUrl).toBe("http://127.0.0.1:8091");
    expect(client.timeout).toBe(30000);
  });

  it("should set namespace", () => {
    const client = new EngramClient({
      minerUrl: "http://localhost:8091",
      namespace: "test-ns",
      namespaceKey: "test-key",
    });
    expect(client.namespace).toBe("test-ns");
  });

  it("should fail health check on unreachable miner", async () => {
    const client = new EngramClient({
      minerUrl: "http://127.0.0.1:1",
      timeout: 1000,
    });
    await expect(client.health()).rejects.toThrow(MinerOfflineError);
  });

  it("isOnline returns false for unreachable miner", async () => {
    const client = new EngramClient({
      minerUrl: "http://127.0.0.1:1",
      timeout: 500,
    });
    const online = await client.isOnline();
    expect(online).toBe(false);
  });
});
