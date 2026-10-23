import type { User } from "@pokedex/shared";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export {};