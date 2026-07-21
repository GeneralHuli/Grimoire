import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * AES-256-GCM at-rest encryption for secrets we have to keep around (OAuth refresh
 * tokens, retail account credentials, etc). Key is derived from GRIMOIRE_ENCRYPTION_KEY
 * so the raw env var can be any length/format (a k8s Secret value).
 */
function getKey(): Buffer {
  const secret = process.env.GRIMOIRE_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("GRIMOIRE_ENCRYPTION_KEY env var is required to store secrets at rest");
  }
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}
