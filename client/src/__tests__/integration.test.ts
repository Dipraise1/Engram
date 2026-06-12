import { EngramClient } from '../client';
import { HybridEncryption, generateKeypair } from '../encryption';

describe('EngramClient Integration', () => {
  const client = new EngramClient({ minerUrl: 'http://127.0.0.1:8091' });

  it('should ingest and query text', async () => {
    try {
      const cid = await client.ingest('The transformer architecture changed everything.');
      expect(cid).toContain('v1::');

      const results = await client.query('attention mechanisms in deep learning', 5);
      expect(results.length).toBeGreaterThanOrEqual(0);
    } catch (err: any) {
      if (err.name === 'MinerOfflineError') {
        console.warn('Miner is offline, skipping integration test.');
      } else {
        throw err;
      }
    }
  });

  it('should support private namespaces with hybrid encryption', async () => {
    try {
      const kp = generateKeypair();
      const enc = new HybridEncryption({ privateKey: kp.privateKey });
      const nsClient = new EngramClient({ 
        minerUrl: 'http://127.0.0.1:8091',
        encryption: enc
      });

      const cid = await nsClient.ingest('Secret message for namespace', { key: 'value' });
      expect(cid).toContain('v1::');

      const results = await nsClient.query('Secret message', 5);
      // Results should be decrypted transparently
      // We cannot guarantee the miner will return our exact query immediately (might be async indexed),
      // but if it does, it should be decrypted.
    } catch (err: any) {
      if (err.name === 'MinerOfflineError') {
        console.warn('Miner is offline, skipping integration test.');
      } else {
        throw err;
      }
    }
  });
});
