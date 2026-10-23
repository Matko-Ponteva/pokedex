import { Router } from "express";
import { eq } from "drizzle-orm";
import { logInSchema, signUpSchema } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { HttpError } from "../lib/errors.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import {
  clearSessionCookie, createSession, deleteSession, setSessionCookie,
} from "../lib/sessions.ts";
import { requireAuth } from "../middleware/auth.ts";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { email, displayName, password } = signUpSchema.parse(req.body);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw new HttpError(409, "An account with this email already exists");

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, displayName, passwordHash })
    .returning({ id: users.id, email: users.email, displayName: users.displayName });

  const session = await createSession(user.id);
  setSessionCookie(res, session.token, session.expiresAt);
  res.status(201).json(user);
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = logInSchema.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, email));

  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) throw new HttpError(401, "Incorrect email or password");

  const session = await createSession(user.id);
  setSessionCookie(res, session.token, session.expiresAt);
  res.json({ id: user.id, email: user.email, displayName: user.displayName });
});

authRouter.post("/logout", async (req, res) => {
  if (req.sessionId) await deleteSession(req.sessionId);
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});