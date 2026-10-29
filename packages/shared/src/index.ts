import { z } from "zod";
import type { PokemonType } from "./pokemonTypes.ts";

export * from "./pokemonTypes.ts";
export * from "./typeChart.ts";
export * from "./defense.ts";
export * from "./offense.ts";
export * from "./realtime.ts";

export const DEFAULT_PAGE_SIZE = 24;

export type PokemonSummary = {
  id: number;
  name: string;
  types: PokemonType[];
  spriteUrl: string;
};

export type PokemonListResponse = {
  items: PokemonSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type EvolutionStage = { id: number; name: string; spriteUrl: string }[];

export type PokemonDetail = {
  id: number;
  name: string;
  types: PokemonType[];
  heightMeters: number;
  weightKg: number;
  description: string | null;
  artworkUrl: string;
  stats: { name: string; value: number }[];
  abilities: { name: string; hidden: boolean }[];
  evolution: EvolutionStage[];
  moves: string[];
};

export type ApiError = {
  error: string;
  details?: { field: string; message: string }[];
};

export type User = {
  id: number;
  email: string;
  displayName: string;
};

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const signUpSchema = z.object({
  email: emailField,
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(30, "Display name can be at most 30 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password can be at most 128 characters"),
});

export const logInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(128),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LogInInput = z.infer<typeof logInSchema>;

export const moveNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(50)
  .regex(/^[a-z0-9-]+$/, "Move names use lowercase letters, digits and hyphens");

export const teamMemberInputSchema = z.object({
  pokemonId: z.number().int().positive(),
  moves: z
    .array(moveNameSchema)
    .max(4, "A Pokémon can know at most 4 moves")
    .refine((moves) => new Set(moves).size === moves.length, "Each move can only be chosen once"),
});

export const teamInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your team a name")
    .max(40, "Team names can be at most 40 characters"),
  members: z.array(teamMemberInputSchema).max(6, "A team can have at most 6 Pokémon"),
  isPublic: z.boolean().default(false),
});

export type TeamInput = z.infer<typeof teamInputSchema>;

export type TeamMember = {
  slot: number;
  pokemon: PokemonSummary;
  moves: string[];
};

export type Team = {
  id: number;
  shareId: string;
  isPublic: boolean;
  name: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
};

export type PublicTeam = {
  shareId: string;
  name: string;
  ownerName: string;
  members: TeamMember[];
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
};

export const PUBLIC_TEAM_SORTS = ["newest", "name", "popular"] as const;

export type PublicTeamSort = (typeof PUBLIC_TEAM_SORTS)[number];

export function isPublicTeamSort(value: unknown): value is PublicTeamSort {
  return typeof value === "string" && (PUBLIC_TEAM_SORTS as readonly string[]).includes(value);
}

export type PublicTeamListResponse = {
  items: PublicTeam[];
  nextCursor: string | null;
};

export type LikeState = {
  likeCount: number;
  likedByMe: boolean;
};