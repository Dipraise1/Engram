import * as SecureStore from 'expo-secure-store';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

const MNEMONIC_KEY = 'engram_mnemonic';
const HOTKEY_KEY   = 'engram_hotkey';

let _cryptoReady = false;

/** Wait for the asm.js backend — 8 s timeout, never throws. */
async function ensureCrypto(): Promise<void> {
  if (_cryptoReady) return;
  try {
    await Promise.race([
      cryptoWaitReady(),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]);
    _cryptoReady = true;
  } catch {
    // asm.js backend may still be functional — proceed anyway
    _cryptoReady = true;
  }
}

export async function initCrypto(): Promise<void> {
  await ensureCrypto();
}

export interface KeyPair {
  ss58:      string;
  publicHex: string;
  mnemonic:  string;
}

export async function generateKeypair(): Promise<KeyPair> {
  await ensureCrypto();
  const mnemonic = mnemonicGenerate(12);
  const keyring  = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const pair     = keyring.addFromMnemonic(mnemonic);

  await SecureStore.setItemAsync(MNEMONIC_KEY, mnemonic);
  await SecureStore.setItemAsync(HOTKEY_KEY,   pair.address);

  return {
    ss58:      pair.address,
    publicHex: u8aToHex(pair.publicKey).slice(2),
    mnemonic,
  };
}

export async function loadKeypair(): Promise<KeyPair | null> {
  const mnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY);
  if (!mnemonic) return null;

  await ensureCrypto();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const pair    = keyring.addFromMnemonic(mnemonic);

  return {
    ss58:      pair.address,
    publicHex: u8aToHex(pair.publicKey).slice(2),
    mnemonic,
  };
}

export async function signGatewayRequest(
  mnemonic: string,
  method: string,
  path: string,
): Promise<{ hotkey: string; timestamp: string; sig: string }> {
  await ensureCrypto();
  const keyring   = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const pair      = keyring.addFromMnemonic(mnemonic);
  const timestamp = Date.now().toString();
  const message   = `engram-cloud:${method}:${path}:${timestamp}`;
  const sig       = u8aToHex(pair.sign(message)).slice(2);
  return { hotkey: pair.address, timestamp, sig };
}

export async function deleteKeypair(): Promise<void> {
  await SecureStore.deleteItemAsync(MNEMONIC_KEY);
  await SecureStore.deleteItemAsync(HOTKEY_KEY);
}
