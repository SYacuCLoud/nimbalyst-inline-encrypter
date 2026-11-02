/**
 * Passphrase-based encryption for inline secrets, using WebCrypto only.
 *
 * Token format: enc:v1:<salt>:<iv>:<ciphertext>  (each part base64url)
 *   - key:    PBKDF2-SHA256, 600k iterations, 16-byte random salt
 *   - cipher: AES-256-GCM, 12-byte random IV (auth tag appended to ciphertext)
 */

const VERSION = 'v1';
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const B64URL = '[A-Za-z0-9_-]+';
export const TOKEN_SOURCE = `enc:${VERSION}:${B64URL}:${B64URL}:${B64URL}`;
const TOKEN_REGEXP = new RegExp(`^enc:${VERSION}:(${B64URL}):(${B64URL}):(${B64URL})$`);

export class WrongPassphraseError extends Error {
  constructor() {
    super('Passphrase is incorrect or the data was modified.');
    this.name = 'WrongPassphraseError';
  }
}

export function isToken(value: string): boolean {
  return TOKEN_REGEXP.test(value);
}

export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `enc:${VERSION}:${toB64Url(salt)}:${toB64Url(iv)}:${toB64Url(new Uint8Array(ciphertext))}`;
}

export async function decrypt(token: string, passphrase: string): Promise<string> {
  const match = token.match(TOKEN_REGEXP);
  if (!match) {
    throw new Error('Not a valid encrypted token.');
  }
  const [, salt, iv, ciphertext] = match;
  const key = await deriveKey(passphrase, fromB64Url(salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64Url(iv) },
      key,
      fromB64Url(ciphertext),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toB64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
