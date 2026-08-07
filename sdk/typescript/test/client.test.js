/**
 * Basic tests for @engram/client.
 *
 * These tests verify the client can be constructed and that error classes
 * work correctly.  Live integration tests against a real miner are in
 * a separate file and require a running node.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  EngramClient,
  EngramError,
  MinerOfflineError,
  IngestError,
  QueryError,
  InvalidCIDError,
} = require("../dist/index");

describe("EngramClient", () => {
  it("constructs with defaults", () => {
    const client = new EngramClient();
    assert.equal(client.minerUrl, "http://127.0.0.1:8091");
    assert.equal(client.timeout, 30_000);
    assert.equal(client.namespace, undefined);
  });

  it("accepts custom options", () => {
    const client = new EngramClient({
      minerUrl: "http://remote:9999/",
      timeout: 5000,
      namespace: "test-ns",
      namespaceKey: "secret",
    });
    assert.equal(client.minerUrl, "http://remote:9999"); // trailing slash stripped
    assert.equal(client.timeout, 5000);
    assert.equal(client.namespace, "test-ns");
    assert.equal(client.namespaceKey, "secret");
  });

  it("toString() returns readable representation", () => {
    const client = new EngramClient({ minerUrl: "http://localhost:3000" });
    const str = client.toString();
    assert.ok(str.includes("localhost:3000"));
  });

  it("isOnline returns false when miner is unreachable", async () => {
    const client = new EngramClient({
      minerUrl: "http://127.0.0.1:19999",
      timeout: 1000,
    });
    const online = await client.isOnline();
    assert.equal(online, false);
  });
});

describe("Error classes", () => {
  it("EngramError is an Error", () => {
    const err = new EngramError("test");
    assert.ok(err instanceof Error);
    assert.equal(err.name, "EngramError");
    assert.equal(err.message, "test");
  });

  it("MinerOfflineError includes the URL", () => {
    const err = new MinerOfflineError("http://localhost:8080");
    assert.ok(err.message.includes("localhost:8080"));
    assert.equal(err.url, "http://localhost:8080");
  });

  it("IngestError wraps the message", () => {
    const err = new IngestError("disk full");
    assert.ok(err.message.includes("disk full"));
  });

  it("QueryError wraps the message", () => {
    const err = new QueryError("timeout");
    assert.ok(err.message.includes("timeout"));
  });

  it("InvalidCIDError stores the CID", () => {
    const err = new InvalidCIDError("bad-cid");
    assert.equal(err.cid, "bad-cid");
  });
});
