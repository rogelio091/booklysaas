import { describe, it, expect } from 'vitest';
import {
  CURRENT_VERSION,
  decryptSecret,
  encryptSecret,
  generateDataKey,
} from './crypto';

describe('Symmetric encryption (AES-GCM + HKDF)', () => {
  const masterSecret = 'test-master-secret-256-bit';

  it('round-trips a plaintext through encrypt -> decrypt', async () => {
    const key = await generateDataKey(masterSecret);
    const ciphertext = await encryptSecret('recurrente-live-key-123', key);

    expect(ciphertext).not.toContain('recurrente-live-key-123');
    expect(await decryptSecret(ciphertext, key)).toBe('recurrente-live-key-123');
  });

  it('prefixes the payload with the current key version', async () => {
    const key = await generateDataKey(masterSecret);
    const ciphertext = await encryptSecret('secret', key);

    expect(ciphertext.startsWith(`v${CURRENT_VERSION}:`)).toBe(true);
  });

  it('fails to decrypt a corrupted payload', async () => {
    const key = await generateDataKey(masterSecret);
    const ciphertext = await encryptSecret('top-secret', key);

    // Flip the last character of the ciphertext blob (tampering).
    const tampered = ciphertext.slice(0, -1) + (ciphertext.endsWith('A') ? 'B' : 'A');

    await expect(decryptSecret(tampered, key)).rejects.toThrow();
  });

  it('fails to decrypt with the wrong key', async () => {
    const key = await generateDataKey(masterSecret);
    const otherKey = await generateDataKey('a-different-master-secret');

    const ciphertext = await encryptSecret('top-secret', key);

    await expect(decryptSecret(ciphertext, otherKey)).rejects.toThrow();
  });

  it('derives different keys for different versions', async () => {
    const v1 = await generateDataKey(masterSecret, 1);
    const v2 = await generateDataKey(masterSecret, 2);

    const ciphertext = await encryptSecret('versioned', v1, 1);

    // Same master secret, different version -> cannot cross-decrypt.
    await expect(decryptSecret(ciphertext, v2)).rejects.toThrow();
    expect(await decryptSecret(ciphertext, v1)).toBe('versioned');
  });

  it('produces unique payloads for the same plaintext (unique IV)', async () => {
    const key = await generateDataKey(masterSecret);
    const a = await encryptSecret('same', key);
    const b = await encryptSecret('same', key);

    expect(a).not.toBe(b);
    expect(await decryptSecret(a, key)).toBe('same');
    expect(await decryptSecret(b, key)).toBe('same');
  });

  it('round-trips unicode text', async () => {
    const key = await generateDataKey(masterSecret);
    const plaintext = 'cóctel-ñandú-🍕 🔐';

    const ciphertext = await encryptSecret(plaintext, key);
    expect(await decryptSecret(ciphertext, key)).toBe(plaintext);
  });

  it('rejects a malformed payload', async () => {
    const key = await generateDataKey(masterSecret);

    await expect(decryptSecret('not-a-valid-payload', key)).rejects.toThrow(
      /malformed payload/,
    );
  });

  it('rejects an empty master secret', async () => {
    await expect(generateDataKey('')).rejects.toThrow();
  });
});
