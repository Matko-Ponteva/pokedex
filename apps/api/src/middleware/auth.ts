import type { Request, RequestHandler } from "express";
import type { User } from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";
import {
  clearSessionCookie, SESSION_COOKIE, setSessionCookie, validateSession,
} from "../lib/sessions.ts";


export const loadSession: RequestHandler = async (req, res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") return next();

  const session = await validateSession(token);
  if (!session) {
    clearSessionCookie(res);
    return next();
  }

  req.user = session.user;
  req.sessionId = session.sessionId;
  if (session.renewed) setSessionCookie(res, token, session.expiresAt);
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, "You need to be logged in");
  next();
};

export function currentUser(req: Request): User {
  if (!req.user) throw new HttpError(401, "You need to be logged in");
  return req.user;
}