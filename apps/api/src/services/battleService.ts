import { abilitySlug, createCombatant, type Combatant, type PokemonDetail, type Ruleset } from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";
import { getMetronomePool, getMoves } from "./moveService.ts";
import { getPokemon } from "./pokemonService.ts";
import { assertLearnableMoves, getTeam } from "./teamService.ts";

export async function loadCombatants(userId: number, teamId: number, ruleset: Ruleset): Promise<Combatant[]> {
  const team = await getTeam(userId, teamId);
  if (team.members.length === 0) throw new HttpError(400, "Choose a team with at least one Pokémon");

  const moveNames = team.members.flatMap((member) => member.moves);
  const [details, moves] = await Promise.all([
    Promise.all(team.members.map((member) => getPokemon(member.pokemon.id))),
    moveNames.length > 0 ? getMoves(moveNames) : Promise.resolve([]),
  ]);
  team.members.forEach((member, index) =>
    assertLearnableMoves(details[index], member.moves, `. Fix the moves in "${team.name}" before battling.`)
  );
  const movesByName = new Map(moves.map((move) => [move.name, move]));
  const metronomePool = moveNames.includes("metronome") ? await getMetronomePool() : undefined;

  return team.members.map((member, index) => {
    const detail = details[index];
    const combatant = createCombatant({
      name: member.pokemon.name,
      spriteUrl: member.pokemon.spriteUrl,
      types: member.pokemon.types,
      level: ruleset.level,
      baseStats: details[index].stats,
      weightKg: details[index].weightKg,
      genderRate: detail.genderRate,
      ability: member.ability ?? defaultAbility(detail),
      item: member.item,
      nature: member.nature,
      canEvolve: canEvolve(detail),
      moves: member.moves.flatMap((name) => {
        const move = movesByName.get(name);
        return move ? [move] : [];
      }),
    });
    if (member.moves.includes("metronome")) combatant.metronomePool = metronomePool;
    return combatant;
  });
}
/** A team member without a chosen ability uses its first regular one */
function defaultAbility(detail: PokemonDetail): string | null {
  const ability = detail.abilities.find((each) => !each.hidden) ?? detail.abilities[0];
  return ability ? abilitySlug(ability.name) : null;
}

/** Whether the Pokémon has a later evolution stage, for Eviolite */
function canEvolve(detail: PokemonDetail): boolean {
  const stage = detail.evolution.findIndex((stage) => stage.some((each) => each.id === detail.id || each.name === detail.name));
  return stage !== -1 && stage < detail.evolution.length - 1;
}
