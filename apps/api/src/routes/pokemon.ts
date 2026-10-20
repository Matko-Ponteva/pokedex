import { Router } from "express";
import { z } from "zod";
import { getPokemonDetail, getPokemonIndex } from "../lib/pokeapi.ts";
import { POKEMON_TYPES } from "../lib/pokemonTypes.ts";

export const pokemonRouter = Router();

const listQuery = z.object({
  search: z.string().trim().toLowerCase().max(50).optional(),
  type: z.enum(POKEMON_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

pokemonRouter.get("/", async (req, res) => {
  const { search, type, page, pageSize } = listQuery.parse(req.query);
  const index = await getPokemonIndex();

  const filtered = index.filter(
    (p) => (!search || p.name.includes(search)) && (!type || p.types.includes(type))
  );
  const start = (page - 1) * pageSize;

  res.json({
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
    hasMore: start + pageSize < filtered.length,
  });
});

const detailParams = z.object({
  id: z.coerce.number().int().positive(),
});

pokemonRouter.get("/:id", async (req, res) => {
  const { id } = detailParams.parse(req.params);
  res.json(await getPokemonDetail(id));
});