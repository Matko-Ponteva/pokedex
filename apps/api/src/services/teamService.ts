import { and, asc, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import {
  abilitySlug,
  type LikeState, type PokemonDetail,
  type PublicTeam, type PublicTeamListResponse, type PublicTeamSort, type Team, type TeamInput,
} from "@pokedex/shared";
import { encodeCursor, type TeamCursor } from "../lib/cursor.ts";
import { db } from "../db/client.ts";
import { likes, pokemon, teamMembers, teams, users } from "../db/schema.ts";
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
      ability: teamMembers.ability,
      item: teamMembers.item,
      nature: teamMembers.nature,
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
      .map((m) => ({ slot: m.slot, pokemon: m.pokemon, moves: m.moves, ability: m.ability, item: m.item, nature: m.nature })),
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

/** Throws if the Pokémon can't learn one of the moves (by leveling up, from a TM, by breeding or from a tutor) */
export function assertLearnableMoves(detail: PokemonDetail, moves: readonly string[], hint = "") {
  const invalid = moves.find((move) => !detail.moves.includes(move));
  if (invalid) {
    throw new HttpError(400, `${detail.name} can't learn ${invalid.replaceAll("-", " ")}${hint}`);
  }
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
    assertLearnableMoves(detail, member.moves);
    if (member.ability && !detail.abilities.some((ability) => abilitySlug(ability.name) === member.ability)) {
      throw new HttpError(400, `${detail.name} can't have the ability ${member.ability.replaceAll("-", " ")}`);
    }
  }
}

function memberRows(teamId: number, input: TeamInput) {
  return input.members.map((m, index) => ({
    teamId,
    slot: index + 1,
    pokemonId: m.pokemonId,
    moves: m.moves,
    ability: m.ability ?? null,
    item: m.item ?? null,
    nature: m.nature ?? null,
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

function toPublicTeam(
  team: Team,
  ownerName: string,
  likeCount: number,
  likedByMe: boolean
): PublicTeam {
  return {
    shareId: team.shareId,
    name: team.name,
    ownerName,
    members: team.members,
    updatedAt: team.updatedAt,
    likeCount,
    likedByMe,
  };
}

async function likedTeamIds(viewerId: number | undefined, teamIds: number[]): Promise<Set<number>> {
  if (viewerId === undefined || teamIds.length === 0) return new Set();
  const rows = await db
    .select({ teamId: likes.teamId })
    .from(likes)
    .where(and(eq(likes.userId, viewerId), inArray(likes.teamId, teamIds)));
  return new Set(rows.map((row) => row.teamId));
}

export async function getPublicTeam(shareId: string, viewerId?: number): Promise<PublicTeam> {
  const [row] = await db
    .select({ team: teams, ownerName: users.displayName })
    .from(teams)
    .innerJoin(users, eq(teams.userId, users.id))
    .where(and(eq(teams.shareId, shareId), eq(teams.isPublic, true)));
  if (!row) throw new HttpError(404, "Team not found");

  const [team] = await withMembers([row.team]);
  const liked = await likedTeamIds(viewerId, [row.team.id]);
  return toPublicTeam(team, row.ownerName, row.team.likeCount, liked.has(row.team.id));
}

const PUBLIC_PAGE_SIZE = 12;

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function cursorCondition(sort: PublicTeamSort, cursor: TeamCursor): SQL {
  switch (sort) {
    case "name":
      return sql`(${teams.name}, ${teams.id}) > (${cursor.name}, ${cursor.id})`;
    case "popular":
      return sql`(${teams.likeCount}, ${teams.id}) < (${cursor.likeCount}, ${cursor.id})`;
    case "newest":
      return lt(teams.id, cursor.id);
  }
}

function sortOrder(sort: PublicTeamSort) {
  switch (sort) {
    case "name":
      return [asc(teams.name), asc(teams.id)];
    case "popular":
      return [desc(teams.likeCount), desc(teams.id)];
    case "newest":
      return [desc(teams.id)];
  }
}

type ListPublicOptions = {
  search?: string;
  sort: PublicTeamSort;
  cursor?: TeamCursor;
  viewerId?: number;
};

export async function listPublicTeams({
  search, sort, cursor, viewerId,
}: ListPublicOptions): Promise<PublicTeamListResponse> {
  if (cursor && cursor.sort !== sort) throw new HttpError(400, "Invalid cursor");

  const filters: SQL[] = [eq(teams.isPublic, true)];
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    const match = or(ilike(teams.name, pattern), ilike(users.displayName, pattern));
    if (match) filters.push(match);
  }
  if (cursor) filters.push(cursorCondition(sort, cursor));

  const rows = await db
    .select({ team: teams, ownerName: users.displayName })
    .from(teams)
    .innerJoin(users, eq(teams.userId, users.id))
    .where(and(...filters))
    .orderBy(...sortOrder(sort))
    .limit(PUBLIC_PAGE_SIZE + 1);

  const page = rows.slice(0, PUBLIC_PAGE_SIZE);
  const full = await withMembers(page.map((row) => row.team));
  const liked = await likedTeamIds(viewerId, page.map((row) => row.team.id));
  const items = full.map((team, index) =>
    toPublicTeam(team, page[index].ownerName, page[index].team.likeCount, liked.has(team.id))
  );

  const last = page.at(-1);
  const nextCursor =
    rows.length > PUBLIC_PAGE_SIZE && last
      ? encodeCursor({
          sort,
          id: last.team.id,
          name: last.team.name,
          likeCount: last.team.likeCount,
        })
      : null;

  return { items, nextCursor };
}

async function findPublicTeamId(shareId: string): Promise<number> {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.shareId, shareId), eq(teams.isPublic, true)));
  if (!team) throw new HttpError(404, "Team not found");
  return team.id;
}

export async function setLike(userId: number, shareId: string, liked: boolean): Promise<LikeState> {
  const teamId = await findPublicTeamId(shareId);

  return db.transaction(async (tx) => {
    if (liked) {
      const inserted = await tx
        .insert(likes)
        .values({ userId, teamId })
        .onConflictDoNothing()
        .returning({ teamId: likes.teamId });
      if (inserted.length > 0) {
        await tx
          .update(teams)
          .set({ likeCount: sql`${teams.likeCount} + 1` })
          .where(eq(teams.id, teamId));
      }
    } else {
      const deleted = await tx
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.teamId, teamId)))
        .returning({ teamId: likes.teamId });
      if (deleted.length > 0) {
        await tx
          .update(teams)
          .set({ likeCount: sql`${teams.likeCount} - 1` })
          .where(eq(teams.id, teamId));
      }
    }

    const [team] = await tx.select({ likeCount: teams.likeCount }).from(teams).where(eq(teams.id, teamId));
    return { likeCount: team.likeCount, likedByMe: liked };
  });
}