import { z } from "zod";

export type FieldErrors = Partial<Record<string, string>>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const { fieldErrors } = z.flattenError(error);
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) result[field] = messages[0];
  }
  return result;
}