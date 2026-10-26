import { and, asc, eq, inArray } from "drizzle-orm";
import type { Team, TeamInput } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { pokemon, teamMembers, teams } from "../db/schema.ts";
import { HttpError } from "../lib/errors.ts";
import { ensureIndex } from "./pokemonService.ts";

type TeamRow = typeof teams.$inferSelect;

async function withMembers(teamRows: TeamRow[]): Promise<Team[]> {
  if (teamRows.length === 0) return [];

  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      slot: teamMembers.slot,
      moves: teamMembers.moves,
      pokemon,
    })
    .from(teamMembers)
    .innerJoin(pokemon, eq(teamMembers.pokemonId, pokemon.id))
    .where(inArray(teamMembers.teamId, teamRows.map((t) => t.id)))
    .orderBy(asc(teamMembers.slot));

  return teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    members: memberRows
      .filter((m) => m.teamId === team.id)
      .map((m) => ({ slot: m.slot, pokemon: m.pokemon, moves: m.moves })),
  }));
}

async function findOwnedTeam(userId: number, teamId: number): Promise<TeamRow> {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)));
  if (!team) throw new HttpError(404, "Team not found");
  return team;
}

async function assertPokemonExist(input: TeamInput) {
  const ids = [...new Set(input.members.map((m) => m.pokemonId))];
  if (ids.length === 0) return;

  await ensureIndex();
  const found = await db.select({ id: pokemon.id }).from(pokemon).where(inArray(pokemon.id, ids));
  if (found.length !== ids.length) throw new HttpError(400, "The team contains an unknown Pokémon");
}

function memberRows(teamId: number, input: TeamInput) {
  return input.members.map((m, index) => ({
    teamId,
    slot: index + 1,
    pokemonId: m.pokemonId,
    moves: m.moves,
  }));
}

export async function listTeams(userId: number): Promise<Team[]> {
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.userId, userId))
    .orderBy(asc(teams.createdAt));
  return withMembers(rows);
}

export async function getTeam(userId: number, teamId: number): Promise<Team> {
  const team = await findOwnedTeam(userId, teamId);
  const [result] = await withMembers([team]);
  return result;
}

export async function createTeam(userId: number, input: TeamInput): Promise<Team> {
  await assertPokemonExist(input);

  const teamId = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ userId, name: input.name })
      .returning({ id: teams.id });
    if (input.members.length > 0) {
      await tx.insert(teamMembers).values(memberRows(team.id, input));
    }
    return team.id;
  });

  return getTeam(userId, teamId);
}

export async function updateTeam(userId: number, teamId: number, input: TeamInput): Promise<Team> {
  await findOwnedTeam(userId, teamId);
  await assertPokemonExist(input);

  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(teams.id, teamId));
    await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
    if (input.members.length > 0) {
      await tx.insert(teamMembers).values(memberRows(teamId, input));
    }
  });

  return getTeam(userId, teamId);
}

export async function deleteTeam(userId: number, teamId: number) {
  const deleted = await db
    .delete(teams)
    .where(and(eq(teams.id, teamId), eq(teams.userId, userId)))
    .returning({ id: teams.id });
  if (deleted.length === 0) throw new HttpError(404, "Team not found");
}