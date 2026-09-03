import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { parse as parseCookie } from "cookie";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const INTERNAL_SESSION_COOKIE = "ferias_internal_session";

function secretKey() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("pt-BR");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [salt, storedHash] = encoded.split(":");
  if (!salt || !storedHash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export function createRawAccountToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccountToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInternalSession(userId: number) {
  return new SignJWT({ userId, kind: "internal" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function readInternalSession(cookieHeader: string | undefined) {
  const token = parseCookie(cookieHeader ?? "")[INTERNAL_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.userId);
    return payload.kind === "internal" && Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

export const internalSessionMaxAgeSeconds = SESSION_MAX_AGE_SECONDS;
