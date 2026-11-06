import type { MoveInfo } from "./offense.ts";
import { FIELD_EFFECT_MOVES, HAZARD_MOVES, SIDE_CONDITION_MOVES, TERRAIN_MOVES } from "./field.ts";
import { WEATHER_MOVES } from "./weather.ts";

/** PokéAPI's move targets */
export type MoveTarget =
  | "selected-pokemon"
  | "selected-pokemon-me-first"
  | "random-opponent"
  | "all-opponents"
  | "all-other-pokemon"
  | "ally"
  | "user-or-ally"
  | "user"
  | "user-and-allies"
  | "all-allies"
  | "users-field"
  | "opponents-field"
  | "entire-field"
  | "all-pokemon"
  | "specific-move"
  | "fainting-pokemon";

const MOVE_TARGETS: ReadonlySet<string> = new Set<MoveTarget>([
  "selected-pokemon", "selected-pokemon-me-first", "random-opponent", "all-opponents", "all-other-pokemon", "ally",
  "user-or-ally", "user", "user-and-allies", "all-allies", "users-field", "opponents-field", "entire-field", "all-pokemon",
  "specific-move", "fainting-pokemon",
]);

/** Moves that hit several Pokémon at once, so each target takes 75% damage in a double battle */
export const SPREAD_TARGETS: ReadonlySet<MoveTarget> = new Set(["all-opponents", "all-other-pokemon"]);

/** Moves that work through their own targeting, used when a move's target isn't known */
const FALLBACK_TARGETS: Readonly<Record<string, MoveTarget>> = {
  "helping-hand": "ally",
  "aromatic-mist": "ally",
  "ally-switch": "user",
  "follow-me": "user",
  "rage-powder": "user",
  spotlight: "selected-pokemon",
  "after-you": "selected-pokemon",
  quash: "selected-pokemon",
  "wide-guard": "users-field",
  "quick-guard": "users-field",
  "crafty-shield": "users-field",
  "mat-block": "users-field",
  coaching: "all-allies",
  "dragon-cheer": "all-allies",
  howl: "user-and-allies",
  "life-dew": "user-and-allies",
  "jungle-healing": "user-and-allies",
  "gear-up": "user-and-allies",
  "magnetic-flux": "user-and-allies",
  acupressure: "user-or-ally",
  "heal-pulse": "selected-pokemon",
  "floral-healing": "selected-pokemon",
  "perish-song": "all-pokemon",
  haze: "all-pokemon",
  "teeter-dance": "all-other-pokemon",
  earthquake: "all-other-pokemon",
  surf: "all-other-pokemon",
  discharge: "all-other-pokemon",
  explosion: "all-other-pokemon",
  "self-destruct": "all-other-pokemon",
  "lava-plume": "all-other-pokemon",
  "parabolic-charge": "all-other-pokemon",
  bulldoze: "all-other-pokemon",
  "sludge-wave": "all-other-pokemon",
  "rock-slide": "all-opponents",
  "heat-wave": "all-opponents",
  "dazzling-gleam": "all-opponents",
  blizzard: "all-opponents",
  "hyper-voice": "all-opponents",
  "muddy-water": "all-opponents",
  "icy-wind": "all-opponents",
  electroweb: "all-opponents",
  snarl: "all-opponents",
  "air-cutter": "all-opponents",
  "eruption": "all-opponents",
  "water-spout": "all-opponents",
  "origin-pulse": "all-opponents",
  "precipice-blades": "all-opponents",
  "make-it-rain": "all-opponents",
  "bleakwind-storm": "all-opponents",
  "breaking-swipe": "all-opponents",
  "glacial-lance": "all-opponents",
  "astral-barrage": "all-opponents",
  "struggle-bug": "all-opponents",
  "mortal-spin": "all-opponents",
  growl: "all-opponents",
  leer: "all-opponents",
  "tail-whip": "all-opponents",
  "string-shot": "all-opponents",
  "sweet-scent": "all-opponents",
  "cotton-spore": "all-opponents",
  "poison-gas": "all-opponents",
  captivate: "all-opponents",
  "venom-drench": "all-opponents",
  "tearful-look": "selected-pokemon",
};

/** Who a move aims at: PokéAPI's target when known, otherwise a guess from what the move does */
export function moveTargetOf(move: MoveInfo, targetsFoe: boolean): MoveTarget {
  if (move.target && MOVE_TARGETS.has(move.target)) return move.target as MoveTarget;
  const known = FALLBACK_TARGETS[move.name];
  if (known) return known;
  if (move.name in HAZARD_MOVES) return "opponents-field";
  if (move.name in SIDE_CONDITION_MOVES) return "users-field";
  if (move.name in FIELD_EFFECT_MOVES || move.name in TERRAIN_MOVES || move.name in WEATHER_MOVES) return "entire-field";
  return targetsFoe ? "selected-pokemon" : "user";
}

export function isSpreadTarget(target: MoveTarget): boolean {
  return SPREAD_TARGETS.has(target);
}

/** What the player must pick for a move in a double battle: any other Pokémon, the user or its ally, or nothing */
export type TargetChoice = "other" | "user-or-ally" | null;

export function targetChoiceOf(move: MoveInfo, targetsFoe: boolean): TargetChoice {
  const target = moveTargetOf(move, targetsFoe);
  if (target === "selected-pokemon" || target === "selected-pokemon-me-first") return "other";
  if (target === "user-or-ally") return "user-or-ally";
  return null;
}

/** A short note on who a move hits in a double battle, for move buttons */
export function targetNote(move: MoveInfo, targetsFoe: boolean): string | null {
  switch (moveTargetOf(move, targetsFoe)) {
    case "all-opponents":
      return "Hits both foes";
    case "all-other-pokemon":
      return "Hits everyone else, ally too";
    case "random-opponent":
      return "Hits a random foe";
    case "ally":
      return "Targets your ally";
    case "all-allies":
      return "Affects your ally";
    case "user-and-allies":
      return "Affects you and your ally";
    case "user-or-ally":
      return "Targets you or your ally";
    default:
      return null;
  }
}

/** Doubles moves that the battle handles by name */
export const DOUBLES_MOVES: ReadonlySet<string> = new Set([
  "helping-hand", "follow-me", "rage-powder", "spotlight", "ally-switch", "after-you", "quash", "wide-guard",
  "dragon-cheer", "happy-hour", "aromatic-mist", "coaching", "heal-pulse", "floral-healing", "life-dew", "jungle-healing",
  "gear-up", "magnetic-flux", "decorate", "hold-hands",
]);

/** Abilities that pull in single-target moves of a type, and absorb them */
export const REDIRECT_ABILITIES: Readonly<Record<string, string>> = {
  "lightning-rod": "electric",
  "storm-drain": "water",
};

/** Abilities that keep the user's moves from being drawn away */
export const UNREDIRECTABLE_ABILITIES: ReadonlySet<string> = new Set(["stalwart", "propeller-tail"]);

/** Status moves aimed at one Pokémon (often an ally) that aren't blocked like moves on a foe */
export const TARGETED_SUPPORT_MOVES: ReadonlySet<string> = new Set([
  "heal-pulse", "floral-healing", "decorate", "after-you", "quash", "spotlight",
]);
