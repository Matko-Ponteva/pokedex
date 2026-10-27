import { Router } from "express";
import { z } from "zod";
import { moveNameSchema } from "@pokedex/shared";
import { getMoves } from "../services/moveService.ts";

export const movesRouter = Router();

const movesQuery = z.object({
  names: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(moveNameSchema).min(1).max(24)),
});

movesRouter.get("/", async (req, res) => {
  const { names } = movesQuery.parse(req.query);
  res.json(await getMoves(names));
});