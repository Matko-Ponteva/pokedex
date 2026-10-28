import { and, asc, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type {
  PublicTeam, PublicTeamListResponse, PublicTeamSort, Team, TeamInput,
} from "@pokedex/shared";
import { encodeCursor, type TeamCursor } from "../lib/cursor.ts";
import { db } from "../db/client.ts";
import { pokemon, teamMembers, teams, users } from "../db/schema.ts";
import { HttpError } from "../lib/errors.ts";
import { ensureIndex, getPokemon } from "./pokemonService.ts";


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
    shareId: team.shareId,
    isPublic: team.isPublic,
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

async function validateMembers(input: TeamInput) {
  const ids = [...new Set(input.members.map((m) => m.pokemonId))];
  if (ids.length === 0) return;

  await ensureIndex();
  const found = await db.select({ id: pokemon.id }).from(pokemon).where(inArray(pokemon.id, ids));
  if (found.length !== ids.length) throw new HttpError(400, "The team contains an unknown Pokémon");

  const details = await Promise.all(ids.map((id) => getPokemon(id)));
  const detailsById = new Map(details.map((detail) => [detail.id, detail]));

  for (const member of input.members) {
    const detail = detailsById.get(member.pokemonId);
    if (!detail) continue;
    const invalid = member.moves.find((move) => !detail.moves.includes(move));
    if (invalid) {
      throw new HttpError(400, `${detail.name} can't learn ${invalid.replaceAll("-", " ")}`);
    }
  }
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
  await validateMembers(input);

  const teamId = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ userId, name: input.name, isPublic: input.isPublic })
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
  await validateMembers(input);

  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({ name: input.name, isPublic: input.isPublic, updatedAt: new Date() })
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

export async function getPublicTeam(shareId: string): Promise<PublicTeam> {
  const [row] = await db
    .select({ team: teams, ownerName: users.displayName })
    .from(teams)
    .innerJoin(users, eq(teams.userId, users.id))
    .where(and(eq(teams.shareId, shareId), eq(teams.isPublic, true)));
  if (!row) throw new HttpError(404, "Team not found");

  const [team] = await withMembers([row.team]);
    return toPublicTeam(team, row.ownerName);
}

function toPublicTeam(team: Team, ownerName: string): PublicTeam {
  return {
    shareId: team.shareId,
    name: team.name,
    ownerName,
    members: team.members,
    updatedAt: team.updatedAt,
  };
}

const PUBLIC_PAGE_SIZE = 12;

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

type ListPublicOptions = {
  search?: string;
  sort: PublicTeamSort;
  cursor?: TeamCursor;
};

export async function listPublicTeams({
  search, sort, cursor,
}: ListPublicOptions): Promise<PublicTeamListResponse> {
  if (cursor && cursor.sort !== sort) throw new HttpError(400, "Invalid cursor");

  const filters: SQL[] = [eq(teams.isPublic, true)];
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    const match = or(ilike(teams.name, pattern), ilike(users.displayName, pattern));
    if (match) filters.push(match);
  }
  if (cursor) {
    filters.push(
      sort === "name"
        ? sql`(${teams.name}, ${teams.id}) > (${cursor.name}, ${cursor.id})`
        : lt(teams.id, cursor.id)
    );
  }

  const rows = await db
    .select({ team: teams, ownerName: users.displayName })
    .from(teams)
    .innerJoin(users, eq(teams.userId, users.id))
    .where(and(...filters))
    .orderBy(...(sort === "name" ? [asc(teams.name), asc(teams.id)] : [desc(teams.id)]))
    .limit(PUBLIC_PAGE_SIZE + 1);

  const page = rows.slice(0, PUBLIC_PAGE_SIZE);
  const full = await withMembers(page.map((row) => row.team));
  const items = full.map((team, index) => toPublicTeam(team, page[index].ownerName));

  const last = page.at(-1);
  const nextCursor =
    rows.length > PUBLIC_PAGE_SIZE && last
      ? encodeCursor({ sort, id: last.team.id, name: last.team.name })
      : null;

  return { items, nextCursor };
}