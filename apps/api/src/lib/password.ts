import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
const OPTIONS: ScryptOptions = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, OPTIONS);
  return [
    "scrypt", OPTIONS.N, OPTIONS.r, OPTIONS.p,
    salt.toString("base64"), key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt") return false;

  const expected = Buffer.from(hash, "base64");
  const key = await deriveKey(password, Buffer.from(salt, "base64"), {
    N: Number(n), r: Number(r), p: Number(p), maxmem: OPTIONS.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}