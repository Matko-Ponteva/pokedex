import type { PokemonSummary, Team, TeamInput } from "@pokedex/shared";

export type DraftMember = {
  key: string;
  pokemon: PokemonSummary;
  moves: string[];
  /** Ability slug; null means the Pokémon's first regular ability */
  ability: string | null;
  item: string | null;
  nature: string | null;
};

export type TeamDraft = {
  name: string;
  isPublic: boolean;
  members: DraftMember[];
};

export const emptyDraft: TeamDraft = { name: "", isPublic: false, members: [] };

export function draftFromTeam(team: Team): TeamDraft {
  return {
    name: team.name,
    isPublic: team.isPublic,
    members: team.members.map((m) => ({
      key: crypto.randomUUID(),
      pokemon: m.pokemon,
      moves: m.moves,
      ability: m.ability,
      item: m.item,
      nature: m.nature,
    })),
  };
}

export function draftToInput(draft: TeamDraft): TeamInput {
  return {
    name: draft.name,
    members: draft.members.map((m) => ({
      pokemonId: m.pokemon.id,
      moves: m.moves,
      ability: m.ability,
      item: m.item,
      nature: m.nature,
    })),
    isPublic: draft.isPublic,
  };
}