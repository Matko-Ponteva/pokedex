import type { PokemonSummary, Team, TeamInput } from "@pokedex/shared";

export type DraftMember = {
  key: string;
  pokemon: PokemonSummary;
  moves: string[];
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
    })),
  };
}

export function draftToInput(draft: TeamDraft): TeamInput {
  return {
    name: draft.name,
    members: draft.members.map((m) => ({ pokemonId: m.pokemon.id, moves: m.moves })),
    isPublic: draft.isPublic,
  };
}