import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, primaryKey, text, timestamp, boolean, uuid, index } from "drizzle-orm/pg-core";
import type { MoveCategory, PokemonDetail, PokemonType, StatChange, StatusCondition } from "@pokedex/shared";

export const pokemon = pgTable("pokemon", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  types: text("types").array().$type<PokemonType[]>().notNull(),
  spriteUrl: text("sprite_url").notNull(),
});

export const pokemonDetails = pgTable("pokemon_details", {
  id: integer("id").primaryKey(),
  // cacheVersion marks rows saved after a change to how details are built; older rows are refetched
  data: jsonb("data").$type<PokemonDetail & { cacheVersion?: number }>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const teams = pgTable(
  "teams",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shareId: uuid("share_id").notNull().unique().defaultRandom(),
    isPublic: boolean("is_public").notNull().default(false),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("teams_user_id_idx").on(table.userId),
    index("teams_public_popular_idx")
      .on(table.likeCount.desc(), table.id.desc())
      .where(sql`${table.isPublic} = true`),
    index("teams_public_name_idx")
      .on(table.name, table.id)
      .where(sql`${table.isPublic} = true`),
  ]
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    moves: text("moves").array().notNull().default(sql`'{}'`),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.slot] }),
    check("team_members_slot_range", sql`${table.slot} BETWEEN 1 AND 6`),
  ]
);

export const moves = pgTable("moves", {
  name: text("name").primaryKey(),
  type: text("type").$type<PokemonType>().notNull(),
  category: text("category").$type<MoveCategory>().notNull(),
  power: integer("power"),
  accuracy: integer("accuracy"),
  ailment: text("ailment").$type<StatusCondition>(),
  ailmentChance: integer("ailment_chance").notNull().default(0),
  critRate: integer("crit_rate").notNull().default(0),
  statChanges: jsonb("stat_changes").$type<StatChange[]>().notNull().default([]),
  statTarget: text("stat_target").$type<"user" | "target">().notNull().default("target"),
  statChance: integer("stat_chance").notNull().default(0),
  healing: integer("healing").notNull().default(0),
  drain: integer("drain").notNull().default(0),
  /** Bumped when we start reading more move data from PokéAPI, so older rows get refetched */
  dataVersion: integer("data_version").notNull().default(0),
});

export const likes = pgTable(
  "likes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.teamId] }),
    index("likes_team_id_idx").on(table.teamId),
  ]
);