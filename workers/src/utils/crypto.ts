/**
 * Symmetric encryption for Cloudflare Workers using Web Crypto (AES-GCM).
 *
 * Purpose: encrypt tenant-owned Recurrente credentials (`recurrente_api_key_enc`,
 * `recurrente_webhook_secret_enc`) at rest. Plaintext must never touch the DB.
 *
 * Key management:
 * - The master secret lives in `env.ENCRYPTION_KEY` (a Cloudflare Secret), never
 *   in source code or config files.
 * - A per-version AES-GCM key is derived from that secret via HKDF-SHA256.
 * - The key version is embedded in the payload prefix so a rotated master key can
 *   still decrypt records written under an older version.
 *
 * Payload format (URL-safe base64url, no padding):
 *   v<version>:<iv>.<ciphertext+tag>
 *
 * - `iv` is a 12-byte random nonce, unique per encryption.
 * - `ciphertext+tag` is the AES-GCM output; Web Crypto appends the 16-byte
 *   authentication tag to the ciphertext, so tampering fails closed on decrypt.
 *
 * Rotation:
 * 1. Bump `CURRENT_VERSION` (and, when rotating the master secret, set a new
 *    `env.ENCRYPTION_KEY`).
 * 2. Old payloads retain their original `v<n>` prefix and can be decrypted by
 *    deriving a key with that same version from the master secret that was active
 *    when they were written.
 * 3. Re-encrypt legacy records with the new version as part of the rotation.
 */

export const CURRENT_VERSION = 1;

const AES_GCM_IV_BYTES = 12;
const HKDF_SALT = new TextEncoder().encode('bookly:encryption-key');
const HKDF_INFO_PREFIX = 'bookly:aes-gcm:v';

/** Derives a versioned AES-GCM key from the master secret using HKDF-SHA256. */
export async function generateDataKey(
  secret: string,
  version: number = CURRENT_VERSION,
): Promise<CryptoKey> {
  if (!secret || secret.length === 0) {
    throw new Error('generateDataKey: secret must be a non-empty string');
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT,
      info: new TextEncoder().encode(`${HKDF_INFO_PREFIX}${version}`),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts a UTF-8 plaintext into a versioned, URL-safe payload. */
export async function encryptSecret(
  plaintext: string,
  key: CryptoKey,
  version: number = CURRENT_VERSION,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  );

  return `v${version}:${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

/** Decrypts a versioned payload. Throws on malformed input or auth failure. */
export async function decryptSecret(
  payload: string,
  key: CryptoKey,
): Promise<string> {
  const { version, ivB64, ciphertextB64 } = parsePayload(payload);

  const iv = base64UrlToBytes(ivB64);
  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error('decryptSecret: invalid IV length');
  }

  const ciphertext = base64UrlToBytes(ciphertextB64);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error(
      `decryptSecret: authentication failed for payload version v${version}`,
    );
  }
}

interface ParsedPayload {
  version: number;
  ivB64: string;
  ciphertextB64: string;
}

function parsePayload(payload: string): ParsedPayload {
  const match = /^v(\d+):([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(payload);
  if (!match) {
    throw new Error('decryptSecret: malformed payload');
  }
  return {
    version: Number(match[1]),
    ivB64: match[2],
    ciphertextB64: match[3],
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
