import { ZodError } from "zod";
import type { Ack } from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";

export async function respond<T>(reply: (result: Ack<T>) => void, work: () => Promise<T>) {
  if (typeof reply !== "function") return;
  try {
    reply({ ok: true, data: await work() });
  } catch (error) {
    if (error instanceof HttpError) {
      reply({ ok: false, error: error.message });
    } else if (error instanceof ZodError) {
      reply({ ok: false, error: "Invalid request" });
    } else {
      console.error(error);
      reply({ ok: false, error: "Something went wrong" });
    }
  }
}