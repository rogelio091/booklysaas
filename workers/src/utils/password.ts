// ============================================
// Hashing de contraseñas compatible con Cloudflare Workers.
//
// Importante: el plan Free de Workers limita a ~10ms de CPU por request.
// Argon2id con parámetros OWASP (m=19MiB, t=2) EXCEDE ese límite en JS puro,
// causando "Worker exceeded CPU time limit" en login.
//
// Solución: PBKDF2-SHA256 vía Web Crypto (nativo, rápido, cabe en el budget).
//   - Formato: pbkdf2$<iterations>$<saltHex>$<hashHex>
//   - Iteraciones: 100,000 (máx. soportado por Cloudflare Workers Web Crypto)
//   - Salt: 16 bytes aleatorios por usuario.
//   - Verificación con comparación en tiempo constante (anti timing attack).
// ============================================

const PBKDF2_PREFIX = 'pbkdf2$';
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PBKDF2_ITERATIONS = 100_000;

/**
 * Genera el hash PBKDF2 de una contraseña en el formato
 * `pbkdf2$<iterations>$<saltHex>$<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

/**
 * Verifica una contraseña contra un hash almacenado.
 * Devuelve false si el hash está malformado o no coincide.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored || !stored.startsWith(PBKDF2_PREFIX)) {
    return false;
  }

  const parts = stored.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [, iterationsStr, saltHex, hashHex] = parts;
  const iterations = Number(iterationsStr);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  if (!isValidHex(saltHex) || !isValidHex(hashHex)) {
    return false;
  }

  const salt = hexToBytes(saltHex);
  if (salt.length !== SALT_BYTES) {
    return false;
  }

  const actual = await derivePbkdf2(password, salt, iterations);
  return constantTimeEqualHex(bytesToHex(actual), hashHex);
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    HASH_BYTES * 8,
  );

  return new Uint8Array(bits);
}

function isValidHex(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Comparación en tiempo constante para hashes hex (anti timing attack).
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
