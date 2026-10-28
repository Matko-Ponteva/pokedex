import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, primaryKey, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import type { MoveCategory, PokemonDetail, PokemonType } from "@pokedex/shared";

export const pokemon = pgTable("pokemon", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  types: text("types").array().$type<PokemonType[]>().notNull(),
  spriteUrl: text("sprite_url").notNull(),
});

export const pokemonDetails = pgTable("pokemon_details", {
  id: integer("id").primaryKey(),
  data: jsonb("data").$type<PokemonDetail>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const teams = pgTable("teams", {
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
});

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
  (table) => [primaryKey({ columns: [table.userId, table.teamId] })]
);