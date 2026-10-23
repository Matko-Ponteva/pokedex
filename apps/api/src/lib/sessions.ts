import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Response } from "express";
import type { User } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { sessions, users } from "../db/schema.ts";

export const SESSION_COOKIE = "session";
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_DURATION_MS = 30 * DAY_MS;
const RENEW_THRESHOLD_MS = 15 * DAY_MS;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

type ValidSession = {
  user: User;
  sessionId: string;
  expiresAt: Date;
  renewed: boolean;
};

export async function validateSession(token: string): Promise<ValidSession | null> {
  const sessionId = hashToken(token);
  const [row] = await db
    .select({
      user: { id: users.id, email: users.email, displayName: users.displayName },
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Sliding expiration: extend sessions that are still in active use
  if (row.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    return { user: row.user, sessionId, expiresAt, renewed: true };
  }

  return { user: row.user, sessionId, expiresAt: row.expiresAt, renewed: false };
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}