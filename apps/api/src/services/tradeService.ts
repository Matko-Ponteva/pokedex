import { and, eq, inArray } from "drizzle-orm";
import type { MemberRef, PokemonSummary } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { pokemon, teamMembers, teams } from "../db/schema.ts";
import { HttpError } from "../lib/errors.ts";

export type OwnedMember = MemberRef & { userId: number };

function memberCondition({ userId, teamId, slot }: OwnedMember) {
  return and(eq(teamMembers.teamId, teamId), eq(teamMembers.slot, slot), eq(teams.userId, userId));
}

export async function getOwnedMember(member: OwnedMember) {
  const [row] = await db
    .select({ teamName: teams.name, pokemon })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(pokemon, eq(teamMembers.pokemonId, pokemon.id))
    .where(memberCondition(member));
  if (!row) throw new HttpError(404, "That Pokémon isn't in your team any more");
  return row;
}

export async function swapMembers(
  a: OwnedMember,
  b: OwnedMember
): Promise<{ aGot: PokemonSummary; bGot: PokemonSummary }> {
  return db.transaction(async (tx) => {
    async function lock(member: OwnedMember): Promise<PokemonSummary> {
      const [row] = await tx
        .select({ pokemon })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .innerJoin(pokemon, eq(teamMembers.pokemonId, pokemon.id))
        .where(memberCondition(member))
        .for("update", { of: teamMembers });
      if (!row) throw new HttpError(409, "One of the Pokémon is no longer available");
      return row.pokemon;
    }

    const aPokemon = await lock(a);
    const bPokemon = await lock(b);

    await tx
      .update(teamMembers)
      .set({ pokemonId: bPokemon.id, moves: [] })
      .where(and(eq(teamMembers.teamId, a.teamId), eq(teamMembers.slot, a.slot)));
    await tx
      .update(teamMembers)
      .set({ pokemonId: aPokemon.id, moves: [] })
      .where(and(eq(teamMembers.teamId, b.teamId), eq(teamMembers.slot, b.slot)));
    await tx
      .update(teams)
      .set({ updatedAt: new Date() })
      .where(inArray(teams.id, [a.teamId, b.teamId]));

    return { aGot: bPokemon, bGot: aPokemon };
  });
}