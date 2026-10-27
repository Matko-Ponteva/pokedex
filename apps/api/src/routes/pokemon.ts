import { Router } from "express";
import { z } from "zod";
import { getPokemon, listPokemon, listTypeCombinations } from "../services/pokemonService.ts";
import { DEFAULT_PAGE_SIZE, POKEMON_TYPES } from "@pokedex/shared";

export const pokemonRouter = Router();

const listQuery = z.object({
  search: z.string().trim().toLowerCase().max(50).regex(/^[a-z0-9-]*$/).optional(),
  type: z.enum(POKEMON_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
});

pokemonRouter.get("/", async (req, res) => {
  const query = listQuery.parse(req.query);
  res.json(await listPokemon(query));
});

const detailParams = z.object({
  id: z.coerce.number().int().positive(),
});

pokemonRouter.get("/type-combinations", async (_req, res) => {
  res.json(await listTypeCombinations());
});

pokemonRouter.get("/:id", async (req, res) => {
  const { id } = detailParams.parse(req.params);
  res.json(await getPokemon(id));
});