import {
  DEFAULT_PAGE_SIZE,
  type ApiError,
  type PokemonDetail,
  type PokemonListResponse,
  type PokemonType,
} from "@pokedex/shared";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new HttpError(res.status, body?.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

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
  return fetchJson<PokemonListResponse>(`/pokemon?${params}`);
}

export function fetchPokemon(id: string) {
  return fetchJson<PokemonDetail>(`/pokemon/${id}`);
}