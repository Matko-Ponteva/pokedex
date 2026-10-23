import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { PokemonDetail, PokemonType } from "@pokedex/shared";

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