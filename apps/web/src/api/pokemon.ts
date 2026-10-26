import {
  DEFAULT_PAGE_SIZE,
  type PokemonDetail,
  type PokemonListResponse,
  type PokemonType,
} from "@pokedex/shared";

import { apiRequest } from "./client";
export { HttpError } from "./client";

type ListParams = {
  search: string;
  type: PokemonType | null;
  page: number;
};

export function fetchPokemonPage({ search, type, page }: ListParams) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(DEFAULT_PAGE_SIZE),
  });
  if (search) params.set("search", search);
  if (type) params.set("type", type);
  return apiRequest<PokemonListResponse>(`/pokemon?${params}`);
}

export function fetchPokemon(id: string) {
  return apiRequest<PokemonDetail>(`/pokemon/${id}`);
}