import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Envelope encryption for third-party OAuth material.
 *
 * AES-256-GCM with a random 12-byte IV per record. The auth tag is stored
 * alongside the ciphertext, so tampering fails closed at decrypt time rather
 * than yielding garbage that later code might treat as a valid token.
 *
 * The key comes from AURALIS_ENCRYPTION_KEY (base64, 32 bytes). In production
 * this should be supplied by a KMS or secret manager, never committed.
 */

const KEY_VERSION = 1;

function getKey(): Buffer {
  const raw = process.env.AURALIS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "AURALIS_ENCRYPTION_KEY is not set. Auralis refuses to store third-party " +
        "credentials without an encryption key.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `AURALIS_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/** Returns "v1.<iv>.<tag>.<ciphertext>", each segment base64url. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    `v${KEY_VERSION}`,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new Error("Malformed encrypted payload");
  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== `v${KEY_VERSION}`) {
    throw new Error(`Unsupported key version: ${version}`);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/* --------------------------------------------------------------- passwords */

/**
 * scrypt is memory-hard and ships with Node, so there is no native module to
 * compile and no extra dependency in the trust path for password hashing.
 */
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const derived = await scrypt(
    password,
    Buffer.from(saltB64, "base64url"),
    expected.length,
  );
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/* ------------------------------------------------------------------ hashes */

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Stable hash for field checkpoints. An absent value and an empty string are
 * genuinely different states during a sync, so they must not collide.
 */
export function valueHash(value: string | null | undefined): string {
  if (value === null || value === undefined) return "absent";
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}
