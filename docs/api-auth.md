# Authentication: sr25519 Signed Challenge

Engram Miners use the Bittensor standard for authenticated communication. Every request must be signed using the requester's (Validator or Client) Coldkey/Hotkey.

## Required Headers

| Header | Description |
|--------|-------------|
| `B-Signature` | The sr25519 signature of the payload. |
| `B-Hotkey` | The SS58 address of the hotkey that signed the request. |
| `B-Nonce` | A monotonically increasing integer or timestamp to prevent replay attacks. |
| `B-Signature-V2` | (Optional) Versioning for the signature scheme. |

## Signature Process

1. Construct the message by concatenating `nonce`, `hotkey`, and `data_hash`.
2. Sign the message using the `sr25519` private key.
3. Include the resulting hex/base64 signature in the `B-Signature` header.

Third-party clients (TypeScript/Rust) should use the `polkadot-js` or `subxt` libraries to generate compatible signatures.
