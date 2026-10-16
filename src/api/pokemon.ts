export type PokemonListItem = { name: string; url: string };

export type PokemonListResponse = {
    count: number;
    next: string | null;
    previous: string | null;
    results: PokemonListItem[];
};

const BASE_URL = "https://pokeapi.co/api/v2";

export async function fetchPokemonList(limit = 1025): Promise<PokemonListResponse> {
    const res = await fetch(`${BASE_URL}/pokemon?limit=${limit}`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
}

export function getIdFromUrl(url: string): number {
    const parts = url.split("/").filter(Boolean);
    return Number(parts[parts.length - 1]);
}

export function getSpriteUrl(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}