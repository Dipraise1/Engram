import { splitSecret, reconstructSecret } from "../shamir.js";

describe("ShamirSecretSharing", () => {
  it("should split and reconstruct a simple secret with 2-of-3", () => {
    const secret = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const shares = splitSecret(secret, 2, 3);
    expect(shares).toHaveLength(3);

    // Reconstruct with first 2 shares
    const recovered = reconstructSecret(shares.slice(0, 2));
    expect(recovered).toEqual(secret);
  });

  it("should reconstruct with 3-of-5", () => {
    const secret = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    const shares = splitSecret(secret, 3, 5);
    expect(shares).toHaveLength(5);

    const recovered = reconstructSecret(shares.slice(0, 3));
    expect(recovered).toEqual(secret);
  });

  it("should reconstruct with any subset of shares (any k of n)", () => {
    const secret = new Uint8Array([0xca, 0xfe]);
    const shares = splitSecret(secret, 2, 5);

    // Try different combinations
    const r1 = reconstructSecret([shares[0], shares[4]]);
    expect(r1).toEqual(secret);

    const r2 = reconstructSecret([shares[2], shares[3]]);
    expect(r2).toEqual(secret);
  });

  it("should throw with insufficient shares", () => {
    const secret = new Uint8Array([0x12, 0x34]);
    const shares = splitSecret(secret, 3, 5);

    expect(() => reconstructSecret(shares.slice(0, 2))).toThrow();
  });

  it("should throw with empty secret", () => {
    expect(() => splitSecret(new Uint8Array(0), 2, 3)).toThrow();
  });

  it("should throw when threshold > total", () => {
    expect(() => splitSecret(new Uint8Array([0x01]), 4, 3)).toThrow();
  });

  it("should handle single-byte secret", () => {
    const secret = new Uint8Array([0xff]);
    const shares = splitSecret(secret, 2, 3);
    const recovered = reconstructSecret(shares.slice(0, 2));
    expect(recovered).toEqual(secret);
  });

  it("should handle 32-byte secret (e.g., AES key)", () => {
    const secret = new Uint8Array(32);
    for (let i = 0; i < 32; i++) secret[i] = i;

    const shares = splitSecret(secret, 2, 3);
    const recovered = reconstructSecret(shares.slice(0, 2));
    expect(recovered).toEqual(secret);
  });
});
