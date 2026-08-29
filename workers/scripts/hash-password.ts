// ============================================
// CLI helper para generar hashes PBKDF2 de contraseñas.
//
// Uso (Node 22.6+ / 24, con type stripping habilitado por defecto):
//   node workers/scripts/hash-password.ts 'mi-contraseña'
//   PASSWORD='mi-contraseña' node workers/scripts/hash-password.ts
//
// Imprime el hash en formato pbkdf2$<iterations>$<saltHex>$<hashHex>
// para pegarlo en un INSERT de users (password_hash).
// ============================================
import { hashPassword } from '../src/utils/password.ts';

async function main(): Promise<void> {
  const password = process.argv[2] ?? process.env.PASSWORD;

  if (!password) {
    console.error('Uso: node workers/scripts/hash-password.ts <password>');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  console.log(hash);
}

void main();
