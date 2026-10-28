import { z } from "zod";
import { PUBLIC_TEAM_SORTS } from "@pokedex/shared";
import { HttpError } from "./errors.ts";

const cursorSchema = z.object({
  sort: z.enum(PUBLIC_TEAM_SORTS),
  id: z.number().int().positive(),
  name: z.string(),
});

export type TeamCursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: TeamCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string): TeamCursor {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new HttpError(400, "Invalid cursor");
  }
}