import { describe, it, expect } from 'vitest';
import { verifyHmacSha256 } from './webhooks';

describe('Webhooks Security & HMAC', () => {
  async function computeHmacHex(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  it('valida una firma HMAC SHA-256 correcta', async () => {
    const payload = JSON.stringify({ event_type: 'invoice.paid', data: { id: 'inv_123' } });
    const secret = 'whsec_test_secret_key_12345';
    const signature = await computeHmacHex(payload, secret);

    const isValid = await verifyHmacSha256(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('rechaza una firma HMAC manipulada o inválida', async () => {
    const payload = JSON.stringify({ event_type: 'invoice.paid' });
    const secret = 'whsec_test_secret_key_12345';
    const tamperedSignature = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    const isValid = await verifyHmacSha256(payload, tamperedSignature, secret);
    expect(isValid).toBe(false);
  });
});
