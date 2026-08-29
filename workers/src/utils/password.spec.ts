import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('PBKDF2 password hashing', () => {
  it('hash → verify ok', async () => {
    const hash = await hashPassword('password123');

    await expect(verifyPassword('password123', hash)).resolves.toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('password123');

    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('devuelve false ante un hash malformado', async () => {
    await expect(verifyPassword('password123', '')).resolves.toBe(false);
    await expect(verifyPassword('password123', 'not-a-hash')).resolves.toBe(false);
    await expect(
      verifyPassword('password123', 'pbkdf2$100000$abc$def'),
    ).resolves.toBe(false);
    await expect(
      verifyPassword('password123', 'pbkdf2$100000$zz$yy'),
    ).resolves.toBe(false);
    await expect(
      verifyPassword('password123', 'pbkdf2$notanumber$00$00'),
    ).resolves.toBe(false);
  });

  it('genera el formato pbkdf2$<iterations>$<saltHex>$<hashHex>', async () => {
    const hash = await hashPassword('password123');
    const parts = hash.split('$');

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('pbkdf2');
    expect(parts[1]).toBe('100000');
    expect(parts[2]).toHaveLength(32); // 16 bytes salt en hex
    expect(parts[3]).toHaveLength(64); // 32 bytes hash en hex
  });

  it('usa un salt único por hash', async () => {
    const a = await hashPassword('password123');
    const b = await hashPassword('password123');

    expect(a).not.toBe(b);
    await expect(verifyPassword('password123', a)).resolves.toBe(true);
    await expect(verifyPassword('password123', b)).resolves.toBe(true);
  });

  it('verifica el hash seedeado en la BD para password123', async () => {
    const seedHash =
      'pbkdf2$100000$84199cf99c6f2949b5ec1c1c0f36aae2$f95371ca6d27db9f31df2ebb77c9ce0e3667670db5bfa4901f67ce631e27013b';

    await expect(verifyPassword('password123', seedHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', seedHash)).resolves.toBe(false);
  });
});
