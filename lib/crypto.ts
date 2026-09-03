/**
 * Cryptography, built entirely on WebCrypto.
 *
 * WebCrypto is available in Node, Cloudflare Workers, Deno and browsers alike,
 * so nothing here ties Auralis to a runtime. The previous implementation used
 * Node's scrypt and createCipheriv, which do not exist on Workers — a host
 * migration would have meant rewriting password hashing, which is the last
 * thing anyone wants to touch under time pressure.
 *
 * Everything is async because WebCrypto is; that is the only visible cost.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ------------------------------------------------------------- base64url */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

/* ------------------------------------------------- envelope encryption */

/**
 * AES-256-GCM with a random 12-byte IV per record. The auth tag is appended to
 * the ciphertext by WebCrypto, so tampering fails closed at decrypt time rather
 * than yielding garbage that later code might treat as a valid token.
 *
 * The key comes from AURALIS_ENCRYPTION_KEY (base64, 32 bytes). In production
 * it should be supplied by a secret manager, never committed.
 */

const KEY_VERSION = 1;

async function getKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = process.env.AURALIS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "AURALIS_ENCRYPTION_KEY is not set. Auralis refuses to store third-party " +
        "credentials without an encryption key.",
    );
  }
  const bytes = fromBase64(raw);
  if (bytes.length !== 32) {
    throw new Error(
      `AURALIS_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${bytes.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [usage]);
}

/** Returns "v1.<iv>.<ciphertext+tag>", each segment base64url. */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getKey("encrypt");
  const iv = randomBytes(12);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext)),
  ) as Uint8Array<ArrayBuffer>;
  return [`v${KEY_VERSION}`, toBase64Url(iv), toBase64Url(sealed)].join(".");
}

export async function decryptSecret(payload: string): Promise<string> {
  const parts = payload.split(".");

  // v1 written by the previous Node implementation kept the GCM tag in its own
  // segment; WebCrypto expects it appended to the ciphertext. Accept both so
  // credentials stored before the change keep working.
  if (parts.length === 4) {
    const [version, ivB64, tagB64, ctB64] = parts;
    if (version !== `v${KEY_VERSION}`) throw new Error(`Unsupported key version: ${version}`);
    const ct = fromBase64Url(ctB64);
    const tag = fromBase64Url(tagB64);
    const combined = new Uint8Array(new ArrayBuffer(ct.length + tag.length));
    combined.set(ct);
    combined.set(tag, ct.length);
    return decrypt(fromBase64Url(ivB64), combined);
  }

  if (parts.length !== 3) throw new Error("Malformed encrypted payload");
  const [version, ivB64, sealedB64] = parts;
  if (version !== `v${KEY_VERSION}`) throw new Error(`Unsupported key version: ${version}`);
  return decrypt(fromBase64Url(ivB64), fromBase64Url(sealedB64));
}

async function decrypt(
  iv: Uint8Array<ArrayBuffer>,
  sealed: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const key = await getKey("decrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, sealed);
  return decoder.decode(plain);
}

/* --------------------------------------------------------------- passwords */

/**
 * PBKDF2-HMAC-SHA256. Not memory-hard the way scrypt is, but it is the only
 * password KDF WebCrypto exposes, and a high iteration count is the accepted
 * mitigation. OWASP's guidance at time of writing is 600,000 iterations for
 * SHA-256, which is what this uses.
 *
 * The iteration count is stored inside the hash, so it can be raised later
 * without invalidating existing passwords.
 */
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEYLEN_BITS = 256;

async function pbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    PBKDF2_KEYLEN_BITS,
  );
  return new Uint8Array(bits) as Uint8Array<ArrayBuffer>;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");

  if (parts[0] === "pbkdf2") {
    const [, iterations, saltB64, hashB64] = parts;
    if (!iterations || !saltB64 || !hashB64) return false;
    const derived = await pbkdf2(password, fromBase64Url(saltB64), Number(iterations));
    return timingSafeEqual(derived, fromBase64Url(hashB64));
  }

  // Passwords hashed with the previous scheme cannot be verified without Node's
  // scrypt, which does not exist on every runtime. Rather than fail silently,
  // say so: the account needs a password reset.
  if (parts[0] === "scrypt") {
    throw new LegacyPasswordError();
  }

  return false;
}

/** Raised when an account still holds a hash from the pre-WebCrypto scheme. */
export class LegacyPasswordError extends Error {
  constructor() {
    super("Password was stored with a scheme this runtime cannot verify");
    this.name = "LegacyPasswordError";
  }
}

/** Constant-time comparison, so a wrong password cannot be found byte by byte. */
function timingSafeEqual(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ hashes */

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

/**
 * Stable hash for field checkpoints. An absent value and an empty string are
 * genuinely different states during a sync, so they must not collide.
 *
 * The output deliberately matches the previous Node implementation byte for
 * byte — base64url of SHA-256, truncated to 32 characters. Changing it would
 * make every stored checkpoint disagree with its field on the next run, which
 * the engine would correctly read as "both sides changed" and raise a conflict
 * on every field at once.
 */
export async function valueHash(value: string | null | undefined): Promise<string> {
  if (value === null || value === undefined) return "absent";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(digest)).slice(0, 32);
}
