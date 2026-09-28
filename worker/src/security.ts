// Credential hashing, admin password check, and stateless session tokens.
// Uses Web Crypto (available in the Workers runtime) — no extra dependency.

import { ADMIN_SESSION_TTL_SECONDS, CREDENTIAL_CODE_ALPHABET, CREDENTIAL_CODE_GROUP_SIZE, CREDENTIAL_CODE_LENGTH } from './constants';

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bufferToHex(digest);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bufferToHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  // Constant-time compare: a plain `a === b` would let an attacker learn how
  // many leading characters matched by measuring response time.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Credentials are never stored in plaintext — only this hash is persisted. */
export async function hashCredential(code: string, pepper: string): Promise<string> {
  return hmacHex(pepper, code.trim().toUpperCase());
}

const CODE_ALPHABET = CREDENTIAL_CODE_ALPHABET;

export function generateCredentialCode(): string {
  const bytes = new Uint8Array(CREDENTIAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${code.slice(0, CREDENTIAL_CODE_GROUP_SIZE)}-${code.slice(CREDENTIAL_CODE_GROUP_SIZE)}`;
}

export async function verifyAdminPassword(password: string, expectedHashHex: string): Promise<boolean> {
  return timingSafeEqual(await sha256Hex(password), expectedHashHex);
}

// Stateless session token: base64url JSON payload (just an expiry) + an HMAC
// signature over that payload, so there's no server-side session store to
// manage — anyone holding a valid, unexpired token is treated as admin.
export async function createAdminSession(secret: string, ttlSeconds = ADMIN_SESSION_TTL_SECONDS): Promise<string> {
  const payloadB64 = btoa(JSON.stringify({ exp: Date.now() + ttlSeconds * 1000 }));
  return `${payloadB64}.${await hmacHex(secret, payloadB64)}`;
}

export async function verifyAdminSession(secret: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  if (!timingSafeEqual(sig, await hmacHex(secret, payloadB64))) return false;
  try {
    const payload = JSON.parse(atob(payloadB64)) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
