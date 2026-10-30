import { createCombatant, type Combatant } from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";
import { getMoves } from "./moveService.ts";
import { getPokemon } from "./pokemonService.ts";
import { getTeam } from "./teamService.ts";

export async function loadCombatants(userId: number, teamId: number): Promise<Combatant[]> {
  const team = await getTeam(userId, teamId);
  if (team.members.length === 0) throw new HttpError(400, "Choose a team with at least one Pokémon");

  const moveNames = team.members.flatMap((member) => member.moves);
  const [details, moves] = await Promise.all([
    Promise.all(team.members.map((member) => getPokemon(member.pokemon.id))),
    moveNames.length > 0 ? getMoves(moveNames) : Promise.resolve([]),
  ]);
  const movesByName = new Map(moves.map((move) => [move.name, move]));

  return team.members.map((member, index) =>
    createCombatant({
      name: member.pokemon.name,
      spriteUrl: member.pokemon.spriteUrl,
      types: member.pokemon.types,
      baseStats: details[index].stats,
      moves: member.moves.flatMap((name) => {
        const move = movesByName.get(name);
        return move ? [move] : [];
      }),
    })
  );
}