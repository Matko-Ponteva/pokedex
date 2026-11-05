import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import { PROTECT_MOVES } from "./specialMoves.ts";
import { FOE_VOLATILES, STATUS_MOVE_NAMES } from "./statusMoves.ts";
import { effectivenessAgainst } from "./typeChart.ts";
import { WEATHER_MOVES } from "./weather.ts";

/** Effects that protect or help one side of the field for a few turns */
export type SideCondition = "reflect" | "light-screen" | "aurora-veil" | "safeguard" | "mist" | "tailwind" | "lucky-chant";
/** Traps set on a side of the field that hurt or hinder each Pokémon switching in there */
export type Hazard = "spikes" | "toxic-spikes" | "stealth-rock" | "sticky-web";
/** Effects on the whole field */
export type FieldEffect = "trick-room" | "gravity" | "mud-sport" | "water-sport" | "wonder-room" | "magic-room" | "fairy-lock";
export type Terrain = "electric" | "grassy" | "misty" | "psychic";

export type SideField = {
  /** Turns left for each condition */
  conditions: Partial<Record<SideCondition, number>>;
  /** Layers of each hazard */
  hazards: Partial<Record<Hazard, number>>;
};

export type FieldState = {
  /** In the same order as the battle's sides */
  sides: [SideField, SideField];
  /** Turns left for each effect */
  effects: Partial<Record<FieldEffect, number>>;
  terrain: { kind: Terrain; turnsLeft: number } | null;
};

export function emptyField(): FieldState {
  return {
    sides: [
      { conditions: {}, hazards: {} },
      { conditions: {}, hazards: {} },
    ],
    effects: {},
    terrain: null,
  };
}

export const SIDE_CONDITION_MOVES: Readonly<Record<string, { condition: SideCondition; turns: number }>> = {
  reflect: { condition: "reflect", turns: 5 },
  "light-screen": { condition: "light-screen", turns: 5 },
  "aurora-veil": { condition: "aurora-veil", turns: 5 },
  safeguard: { condition: "safeguard", turns: 5 },
  mist: { condition: "mist", turns: 5 },
  tailwind: { condition: "tailwind", turns: 4 },
  "lucky-chant": { condition: "lucky-chant", turns: 5 },
};

export const HAZARD_MOVES: Readonly<Record<string, { hazard: Hazard; maxLayers: number }>> = {
  spikes: { hazard: "spikes", maxLayers: 3 },
  "toxic-spikes": { hazard: "toxic-spikes", maxLayers: 2 },
  "stealth-rock": { hazard: "stealth-rock", maxLayers: 1 },
  "sticky-web": { hazard: "sticky-web", maxLayers: 1 },
};

/** Whole-field moves. Toggling ones end the effect when used while it's active. */
export const FIELD_EFFECT_MOVES: Readonly<Record<string, { effect: FieldEffect; turns: number; toggles: boolean }>> = {
  "trick-room": { effect: "trick-room", turns: 5, toggles: true },
  gravity: { effect: "gravity", turns: 5, toggles: false },
  "mud-sport": { effect: "mud-sport", turns: 5, toggles: false },
  "water-sport": { effect: "water-sport", turns: 5, toggles: false },
  "wonder-room": { effect: "wonder-room", turns: 5, toggles: true },
  "magic-room": { effect: "magic-room", turns: 5, toggles: true },
  // Counts the turn it's used, so it blocks switching during the next one
  "fairy-lock": { effect: "fairy-lock", turns: 2, toggles: false },
};

export const TERRAIN_MOVES: Readonly<Record<string, Terrain>> = {
  "electric-terrain": "electric",
  "grassy-terrain": "grassy",
  "misty-terrain": "misty",
  "psychic-terrain": "psychic",
};
export const TERRAIN_TURNS = 5;

/** Moves that shield the user's side from some moves for the rest of the turn */
export const GUARD_MOVES: Readonly<Record<string, string>> = {
  "quick-guard": "Quick Guard",
  "crafty-shield": "Crafty Shield",
  "mat-block": "Mat Block",
};

/** Damaging moves that clear hazards and Leech Seed from the user's side */
export const SPINNING_MOVES: ReadonlySet<string> = new Set(["rapid-spin", "mortal-spin"]);
/** Damaging moves that break Reflect, Light Screen and Aurora Veil before they hit */
export const SCREEN_BREAKERS: ReadonlySet<string> = new Set(["brick-break", "psychic-fangs", "raging-bull"]);
/** Status moves with a field effect handled by the battle, besides the tables above */
const OTHER_FIELD_MOVES = new Set(["haze", "ion-deluge", "court-change", "defog", "tidy-up", "substitute", "leech-seed"]);
/** Status moves that work through their own rules elsewhere */
const OTHER_STATUS_MOVES = new Set(["stockpile", "swallow", "splash"]);

export const SIDE_CONDITION_NAMES: Record<SideCondition, string> = {
  reflect: "Reflect",
  "light-screen": "Light Screen",
  "aurora-veil": "Aurora Veil",
  safeguard: "Safeguard",
  mist: "Mist",
  tailwind: "Tailwind",
  "lucky-chant": "Lucky Chant",
};

export const HAZARD_NAMES: Record<Hazard, string> = {
  spikes: "Spikes",
  "toxic-spikes": "Toxic Spikes",
  "stealth-rock": "Stealth Rock",
  "sticky-web": "Sticky Web",
};

export const FIELD_EFFECT_NAMES: Record<FieldEffect, string> = {
  "trick-room": "Trick Room",
  gravity: "Gravity",
  "mud-sport": "Mud Sport",
  "water-sport": "Water Sport",
  "wonder-room": "Wonder Room",
  "magic-room": "Magic Room",
  "fairy-lock": "Fairy Lock",
};

export const TERRAIN_NAMES: Record<Terrain, string> = {
  electric: "Electric Terrain",
  grassy: "Grassy Terrain",
  misty: "Misty Terrain",
  psychic: "Psychic Terrain",
};

/** What happens when a side condition starts, for the team of the trainer named */
export const SIDE_CONDITION_STARTED: Record<SideCondition, (team: string) => string> = {
  reflect: (team) => `Reflect made ${team} stronger against physical moves!`,
  "light-screen": (team) => `Light Screen made ${team} stronger against special moves!`,
  "aurora-veil": (team) => `Aurora Veil made ${team} stronger against physical and special moves!`,
  safeguard: (team) => `${team} cloaked itself in a mystical veil!`,
  mist: (team) => `${team} became shrouded in mist!`,
  tailwind: (team) => `The Tailwind blew from behind ${team}!`,
  "lucky-chant": (team) => `Lucky Chant shielded ${team} from critical hits!`,
};

export const HAZARD_SET: Record<Hazard, (team: string) => string> = {
  spikes: (team) => `Spikes were scattered on the ground all around ${team}!`,
  "toxic-spikes": (team) => `Poison spikes were scattered on the ground all around ${team}!`,
  "stealth-rock": (team) => `Pointed stones float in the air around ${team}!`,
  "sticky-web": (team) => `A sticky web has been laid out on the ground around ${team}!`,
};

export const FIELD_EFFECT_STARTED: Record<FieldEffect, (user: string) => string> = {
  "trick-room": (user) => `${user} twisted the dimensions!`,
  gravity: () => "Gravity intensified!",
  "mud-sport": () => "Electricity's power was weakened!",
  "water-sport": () => "Fire's power was weakened!",
  "wonder-room": () => "It created a bizarre area in which Defense and Sp. Def stats are swapped!",
  "magic-room": () => "It created a bizarre area in which Pokémon's held items lose their effects!",
  "fairy-lock": () => "No one will be able to run away during the next turn!",
};

export const FIELD_EFFECT_ENDED: Record<FieldEffect, string> = {
  "trick-room": "The twisted dimensions returned to normal!",
  gravity: "Gravity returned to normal!",
  "mud-sport": "The effects of Mud Sport have faded.",
  "water-sport": "The effects of Water Sport have faded.",
  "wonder-room": "Wonder Room wore off, and Defense and Sp. Def stats returned to normal!",
  "magic-room": "Magic Room wore off, and held items' effects returned to normal!",
  "fairy-lock": "",
};

export const TERRAIN_STARTED: Record<Terrain, string> = {
  electric: "An electric current ran across the battlefield!",
  grassy: "Grass grew to cover the battlefield!",
  misty: "Mist swirled around the battlefield!",
  psychic: "The battlefield got weird!",
};

export const TERRAIN_ENDED: Record<Terrain, string> = {
  electric: "The electricity disappeared from the battlefield.",
  grassy: "The grass disappeared from the battlefield.",
  misty: "The mist disappeared from the battlefield.",
  psychic: "The weirdness disappeared from the battlefield!",
};

/** Whether a Pokémon touches the ground: Flying types don't, unless Gravity pulls them down */
export function isGrounded(types: readonly PokemonType[], gravity: boolean): boolean {
  return gravity || !types.includes("flying");
}

/** Type effectiveness, with Gravity letting Ground moves hit Flying types */
export function moveEffectiveness(moveType: PokemonType, defenderTypes: readonly PokemonType[], gravity: boolean): number {
  const types = gravity && moveType === "ground" ? defenderTypes.filter((type) => type !== "flying") : defenderTypes;
  return types.length > 0 ? effectivenessAgainst(moveType, [...types]) : 1;
}

/** Ground moves that lose half their power on Grassy Terrain */
const QUAKE_MOVES = new Set(["earthquake", "bulldoze", "magnitude"]);

/** Terrain boosts grounded users' moves of its type, and weakens some moves against grounded targets */
export function terrainPowerMultiplier(
  terrain: Terrain | null,
  move: MoveInfo,
  attackerGrounded: boolean,
  defenderGrounded: boolean
): number {
  if (!terrain) return 1;
  const boosted: Partial<Record<Terrain, PokemonType>> = { electric: "electric", grassy: "grass", psychic: "psychic" };
  if (attackerGrounded && boosted[terrain] === move.type) return 1.3;
  if (terrain === "misty" && defenderGrounded && move.type === "dragon") return 0.5;
  if (terrain === "grassy" && defenderGrounded && QUAKE_MOVES.has(move.name)) return 0.5;
  return 1;
}

/** Mud Sport and Water Sport cut Electric and Fire moves to a third */
export function sportMultiplier(effects: FieldState["effects"] | undefined, moveType: PokemonType): number {
  if (moveType === "electric" && effects?.["mud-sport"]) return 1 / 3;
  if (moveType === "fire" && effects?.["water-sport"]) return 1 / 3;
  return 1;
}

/** Whether a status move does something in battle here */
export function hasStatusEffect(move: MoveInfo): boolean {
  return (
    (move.statChanges ?? []).length > 0 ||
    Boolean(move.ailment) ||
    (move.healing ?? 0) > 0 ||
    PROTECT_MOVES.has(move.name) ||
    move.name in WEATHER_MOVES ||
    move.name in SIDE_CONDITION_MOVES ||
    move.name in HAZARD_MOVES ||
    move.name in FIELD_EFFECT_MOVES ||
    move.name in TERRAIN_MOVES ||
    move.name in GUARD_MOVES ||
    OTHER_FIELD_MOVES.has(move.name) ||
    OTHER_STATUS_MOVES.has(move.name) ||
    STATUS_MOVE_NAMES.has(move.name) ||
    Boolean(move.volatile && FOE_VOLATILES.has(move.volatile))
  );
}

/** A short description of a field move, for move buttons */
export function fieldMoveNote(move: MoveInfo): string | null {
  const side = SIDE_CONDITION_MOVES[move.name];
  if (side) {
    const what: Record<SideCondition, string> = {
      reflect: "Halves physical damage",
      "light-screen": "Halves special damage",
      "aurora-veil": "Halves all damage; needs hail or snow",
      safeguard: "Blocks status conditions",
      mist: "Blocks stat drops",
      tailwind: "Doubles your team's Speed",
      "lucky-chant": "Blocks critical hits",
    };
    return `${what[side.condition]} for ${side.turns} turns`;
  }
  const hazard = HAZARD_MOVES[move.name];
  if (hazard) {
    const what: Record<Hazard, string> = {
      spikes: "Hurts foes switching in (up to 3 layers)",
      "toxic-spikes": "Poisons foes switching in",
      "stealth-rock": "Hurts foes switching in, by type",
      "sticky-web": "Lowers Speed of foes switching in",
    };
    return what[hazard.hazard];
  }
  const effect = FIELD_EFFECT_MOVES[move.name];
  if (effect) {
    const what: Record<FieldEffect, string> = {
      "trick-room": "Slower Pokémon move first for 5 turns",
      gravity: "Grounds everyone, raises accuracy for 5 turns",
      "mud-sport": "Weakens Electric moves for 5 turns",
      "water-sport": "Weakens Fire moves for 5 turns",
      "wonder-room": "Swaps Defense and Sp. Def for 5 turns",
      "magic-room": "Disables held items for 5 turns",
      "fairy-lock": "No switching next turn",
    };
    return what[effect.effect];
  }
  const terrain = TERRAIN_MOVES[move.name];
  if (terrain) return `Sets ${TERRAIN_NAMES[terrain]} for ${TERRAIN_TURNS} turns`;
  const notes: Record<string, string> = {
    "quick-guard": "Blocks priority moves this turn",
    "crafty-shield": "Blocks status moves this turn",
    "mat-block": "Blocks attacks; first turn out only",
    haze: "Resets all stat changes",
    "ion-deluge": "Normal moves become Electric this turn",
    "court-change": "Swaps field effects between sides",
    defog: "Clears screens and hazards",
    "tidy-up": "Clears hazards and substitutes",
    substitute: "Uses 1/4 HP to make a decoy",
    "leech-seed": "Drains 1/8 HP each turn",
    "rapid-spin": "Clears hazards on your side",
    "mortal-spin": "Clears hazards on your side",
    "brick-break": "Breaks screens",
    "psychic-fangs": "Breaks screens",
    "raging-bull": "Breaks screens",
  };
  return notes[move.name] ?? null;
}
