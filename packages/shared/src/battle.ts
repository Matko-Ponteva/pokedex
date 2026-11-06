import { BOOST_STATS, STAB_BONUS, type BoostStat, type MoveInfo, type StatChange, type StatusCondition } from "./offense.ts";
import { POKEMON_TYPES, type PokemonType } from "./pokemonTypes.ts";
import { rulesetOf, type BattleFormat, type Ruleset, type RulesetId } from "./rulesets.ts";
import {
  AFTER_HITS_STAT_CHANGES, PROTECT_MOVES, SPECIAL_DAMAGE, VARIABLE_POWER, hasBattleEffect, multiHitOf, type MultiHit,
  type SpecialDamage,
} from "./specialMoves.ts";
import {
  FIELD_EFFECT_ENDED, FIELD_EFFECT_MOVES, FIELD_EFFECT_STARTED, GUARD_MOVES, HAZARD_MOVES, HAZARD_SET, SCREEN_BREAKERS,
  SIDE_CONDITION_MOVES, SIDE_CONDITION_NAMES, SIDE_CONDITION_STARTED, SPINNING_MOVES, TERRAIN_ENDED, TERRAIN_MOVES,
  TERRAIN_STARTED, TERRAIN_TURNS, emptyField, isGrounded, moveEffectiveness, sportMultiplier, terrainPowerMultiplier,
  type FieldEffect, type FieldState, type Hazard, type SideCondition, type Terrain,
} from "./field.ts";
import {
  BYPASS_SUBSTITUTE, CALLING_MOVES, CAMOUFLAGE_TYPES, CONFUSING_MOVES, DAMAGING_PIVOTS, DRAG_OUT_MOVES, FIRST_TURN_MOVES,
  FOE_STATUS_MOVES, FOE_VOLATILES, NATURE_POWER_MOVES, NO_CALL_MOVES, PURE_TRAP_MOVES, SHIELDS, UNSUPPORTED_REASONS,
  ALLY_MOVES, criticalChanceAt, isHealingMove, isSnatchable, volatileTags, type Gender, type Volatiles,
} from "./statusMoves.ts";
import {
  ABSORB_ABILITIES, ATE_ABILITIES, BALL_MOVES, MOLD_BREAKERS, POWDER_MOVES, SOUND_MOVES, STATUS_IMMUNE_ABILITIES,
  UNCOPYABLE_ABILITIES, abilityAttackMultiplier, abilityDefenseMultiplier, abilityFinalMultiplier, abilityName,
  abilityPowerMultiplier, hasAddedEffects, type AbilityDamageContext,
} from "./abilities.ts";
import {
  BIG_HEAL_BERRIES, CURE_BERRIES, NATURAL_GIFT_TYPES, PINCH_BERRIES, RESIST_BERRIES, WEATHER_ROCKS, isBerry, itemAttackMultiplier,
  itemDefenseMultiplier, itemFinalMultiplier, itemName, itemPowerMultiplier,
} from "./items.ts";
import { natureMultiplier } from "./natures.ts";

/** Moves Aroma Veil keeps off its side */
const AROMA_VEIL_MOVES: ReadonlySet<string> = new Set(["taunt", "torment", "encore", "disable", "heal-block", "attract"]);
import {
  REDIRECT_ABILITIES, TARGETED_SUPPORT_MOVES, UNREDIRECTABLE_ABILITIES, isSpreadTarget, moveTargetOf, type MoveTarget,
} from "./targets.ts";
import { effectivenessAgainst } from "./typeChart.ts";
import {
  WEATHER_ENDED, WEATHER_MOVES, WEATHER_STARTED, WEATHER_TURNS, hurtByWeather, weatherAdjustedMove, weatherChipText,
  weatherDefenseMultiplier, weatherHealing, weatherPowerMultiplier, type Weather, type WeatherState,
} from "./weather.ts";

export const STRUGGLE: MoveInfo = { name: "struggle", type: "normal", category: "physical", power: 50 };
export const CRIT_MULTIPLIER = 1.5;

export type BattleStats = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

export type Combatant = {
  name: string;
  spriteUrl: string;
  types: PokemonType[];
  level: number;
  /** Actual stats at this level, not base stats */
  stats: BattleStats;
  maxHp: number;
  hp: number;
  moves: MoveInfo[];
  status: StatusCondition | null;
  /** Turns left asleep before waking up */
  sleepTurns: number;
  /** Stat stages from -6 to +6; missing means 0. Reset when the Pokémon switches out. */
  boosts: Partial<Record<BoostStat, number>>;
  /** Protect/Detect uses in a row; each one after the first is less likely to work. Reset when switching out. */
  protectStreak?: number;
  /** Used by Low Kick, Heavy Slam and the like */
  weightKg?: number;
  /** Base Attack, which sets the power of this Pokémon's hit in a teammate's Beat Up */
  baseAttack?: number;
  /** Stockpile uses (up to 3) waiting for Spit Up or Swallow. Reset when switching out. */
  stockpile?: number;
  /** Bide in progress: turns left before it hits back, and the damage taken meanwhile */
  bide?: { turns: number; damage: number; from?: Slot } | null;
  /** How many times each move has been used, for moves that run out of PP like Trump Card */
  uses?: Record<string, number>;
  /** HP left in this Pokémon's substitute; 0 or missing means none */
  substituteHp?: number;
  /** Leech Seed drains this Pokémon each turn until it switches out */
  seeded?: boolean;
  /** The slot whose Pokémon Leech Seed heals */
  seededBy?: Slot;
  /** Ends of turn since this Pokémon came in, for Mat Block and Fake Out */
  activeTurns?: number;
  /** PP left for each move; null means it never runs out */
  pp?: (number | null)[];
  gender?: Gender | null;
  volatiles?: Volatiles;
  /** The last move this Pokémon used since it came in, for Encore, Disable, Mirror Move and the like */
  lastMove?: MoveInfo | null;
  /** How it was before Transform, Soak, Mimic or a stat swap changed it; restored when it switches out */
  original?: {
    types: PokemonType[];
    stats: BattleStats;
    moves: MoveInfo[];
    pp?: (number | null)[];
    spriteUrl: string;
    ability?: string | null;
  };
  /** The moves Metronome can pick from */
  metronomePool?: MoveInfo[];
  ability?: string | null;
  item?: string | null;
  /** Stats already include it */
  nature?: string | null;
  /** The last item it used up, for Recycle and Harvest */
  consumedItem?: string | null;
  /** Whether it can still evolve, for Eviolite */
  canEvolve?: boolean;
};

/** What anyone watching the battle can see of a Pokémon */
export type ShownCombatant = Pick<Combatant, "name" | "spriteUrl" | "types" | "level" | "hp" | "maxHp" | "status" | "boosts"> & {
  substitute?: boolean;
  seeded?: boolean;
  gender?: Gender | null;
  /** Labels for its volatile effects: Confused, Taunt 2, Perish 1… */
  tags?: string[];
};

export type BattleSide = {
  userId: number;
  displayName: string;
  team: Combatant[];
  /** The team member in battle (in a double battle, the one on the left) */
  active: number;
  /** In a double battle: the team member in battle at each position. `active` mirrors the first one. */
  actives?: number[];
  /** Wish waiting to heal whoever is in battle at the end of next turn */
  wish?: { turns: number; amount: number; from: string; position?: number } | null;
  /** Healing Wish or Lunar Dance waiting to fully heal the next Pokémon sent in */
  healingWish?: boolean;
};

export type SideIndex = 0 | 1;

/**
 * A place on the field for one Pokémon: slot = position × 2 + side. A single battle has slots 0 and 1 (one per side),
 * a double battle 0–3, so slots 0 and 2 are the first side's left and right Pokémon.
 */
export type Slot = number;

export function slotSide(slot: Slot): SideIndex {
  return (slot % 2) as SideIndex;
}

export function slotPosition(slot: Slot): number {
  return slot >> 1;
}

export function slotOf(side: SideIndex, position: number): Slot {
  return position * 2 + side;
}

/** The team members a side has in battle, one per position */
export function activeIndexes(side: BattleSide): number[] {
  return side.actives ?? [side.active];
}

export function battleFormat(battle: Pick<Battle, "ruleset">): BattleFormat {
  return rulesetOf(battle.ruleset).format;
}

/** Every slot on the field, in order */
export function battleSlots(battle: Pick<Battle, "ruleset">): Slot[] {
  return battleFormat(battle) === "doubles" ? [0, 1, 2, 3] : [0, 1];
}

type EventBody =
  | { kind: "move"; move: string; moveType: PokemonType }
  | { kind: "miss" }
  | { kind: "damage"; amount: number; hp: number; effectiveness: number; critical: boolean }
  | { kind: "immune" }
  | { kind: "status"; status: StatusCondition }
  | { kind: "status-damage"; status: StatusCondition; amount: number; hp: number }
  | { kind: "cant-move"; status: StatusCondition }
  | { kind: "cured"; status: StatusCondition }
  | { kind: "stat"; stat: BoostStat; change: number; attempted: number }
  | { kind: "heal"; amount: number; hp: number }
  | { kind: "recoil"; amount: number; hp: number }
  | { kind: "fail" }
  | { kind: "protect"; blocked: boolean }
  /** A message without an effect of its own: "Magnitude 7!", "Hit 3 times!", Bide storing energy */
  | { kind: "info" }
  /** The weather started, or ended when `weather` is null */
  | { kind: "weather"; weather: Weather | null }
  | { kind: "weather-damage"; weather: Weather; amount: number; hp: number }
  /** A side condition, hazard, terrain or field effect changed; `field` is the field afterwards */
  | { kind: "field"; field: FieldState }
  /** A substitute was put up, took a hit (still `active`), or broke */
  | { kind: "substitute"; active: boolean; hp: number }
  | { kind: "seeded"; seeded: boolean }
  | { kind: "leech"; amount: number; hp: number }
  | { kind: "hazard-damage"; hazard: Hazard; amount: number; hp: number }
  /** Haze reset every Pokémon's stat changes */
  | { kind: "haze" }
  /** A Pokémon's volatile effects, types or stats changed; `combatant` is how it looks now */
  | { kind: "volatile"; combatant: ShownCombatant; float?: string }
  /** HP lost to something other than a hit, like a curse, binding or confusion */
  | { kind: "hurt"; amount: number; hp: number }
  /** An ability took effect */
  | { kind: "ability"; ability: string }
  /** An item took effect, was used up, or changed hands */
  | { kind: "item"; item: string }
  | { kind: "faint" }
  | { kind: "withdraw" }
  | { kind: "switch"; combatant: ShownCombatant }
  | { kind: "win" };

/** One step of a turn. `side` is the battle side the event happens to, `slot` the place on the field. */
export type BattleEvent = { side: SideIndex; slot?: Slot; text: string } & EventBody;

/** What a player does with one of their Pokémon in a turn: use one of its moves, or switch to a team member */
export type BattleChoice =
  /**
   * `target` is who comes in after U-turn or Baton Pass, or who Revival Blessing revives.
   * `targetSlot` is the Pokémon on the field the move aims at, in a double battle.
   */
  | { kind: "move"; index: number; target?: number; targetSlot?: Slot }
  | { kind: "switch"; index: number };

type ExecuteOptions = {
  /** The team member the player chose for a switching move or Revival Blessing */
  target?: number;
  /** The user's move before this one, for Destiny Bond */
  previous?: MoveInfo | null;
  /** Don't announce the move again (bounced by Magic Coat, snatched) */
  silent?: boolean;
  bounced?: boolean;
  /** The slot the player aimed the move at, in a double battle */
  targetSlot?: Slot;
};

export type TurnRecord = {
  /** Increases with every resolved step (a turn, or sending in replacements) */
  seq: number;
  turn: number;
  /** The Pokémon in each slot when the turn began */
  start: ShownCombatant[];
  events: BattleEvent[];
  /** The weather when the turn began */
  weather?: Weather | null;
  /** The field when the turn began */
  field?: FieldState | null;
};

export type Battle = {
  id: string;
  sides: [BattleSide, BattleSide];
  ruleset: RulesetId;
  turn: number;
  log: string[];
  winner: number | null;
  lastTurn?: TurnRecord | null;
  seq?: number;
  /** Slots whose Pokémon fainted, whose player must choose the next one before the battle goes on */
  replacing?: boolean[];
  weather?: WeatherState | null;
  field?: FieldState | null;
  /** The last move used by anyone, for Copycat */
  lastMove?: MoveInfo | null;
};

export type RandomSource = () => number;

export type PublicSide = {
  userId: number;
  displayName: string;
  /** The Pokémon in battle (in a double battle, the one on the left) */
  active: ShownCombatant;
  /** The Pokémon in battle at each position */
  actives: ShownCombatant[];
  remaining: number;
  teamSize: number;
};

export type OpponentView = PublicSide;

export type ChatMode = "public" | "private";

export type BattleView = {
  id: string;
  ruleset: Ruleset;
  turn: number;
  log: string[];
  winner: number | null;
  mySide: SideIndex;
  me: BattleSide;
  opponent: OpponentView;
  lastTurn: TurnRecord | null;
  hasChosen: boolean;
  opponentHasChosen: boolean;
  /** Your Pokémon fainted: choose which one to send in next */
  mustReplace: boolean;
  /** Your positions waiting for a replacement */
  replacePositions: number[];
  /** Your positions whose Pokémon need a choice this turn (not fainted, not hiding with Commander) */
  actingPositions: number[];
  /** The opponent is choosing their next Pokémon */
  opponentMustReplace: boolean;
  turnEndsAt: string | null;
  opponentAwayUntil: string | null;
  chatMode: ChatMode;
  spectators: number;
  weather: WeatherState | null;
  field: FieldState | null;
  /** For each of your positions, why each move can't be chosen now (no PP, Taunt, Disable…), or null */
  moveLocks: (string | null)[][];
  /** For each of your positions, why that Pokémon can't switch out now, or null */
  switchLocks: (string | null)[];
};

export type SpectatorView = {
  id: string;
  ruleset: Ruleset;
  turn: number;
  log: string[];
  winner: number | null;
  sides: [PublicSide, PublicSide];
  lastTurn: TurnRecord | null;
  chosen: [boolean, boolean];
  /** Sides choosing a replacement for a fainted Pokémon */
  replacing: [boolean, boolean];
  turnEndsAt: string | null;
  awayUntil: [string | null, string | null];
  chatModes: [ChatMode, ChatMode];
  spectators: number;
  weather: WeatherState | null;
  field: FieldState | null;
};

function title(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Perfect IVs, no EVs and a neutral nature, like the games' battle facilities */
const IV = 31;

export function statAtLevel(base: number, level: number, isHp = false): number {
  const scaled = Math.floor(((2 * base + IV) * level) / 100);
  return isHp ? scaled + level + 10 : scaled + 5;
}

/** Moves that work in battle: all but damaging moves without a power and without handling here (Fling, Z-Moves) */
export function isUsableMove(move: MoveInfo): boolean {
  return move.category === "status" || move.power !== null || hasBattleEffect(move);
}

const MAX_STOCKPILE = 3;
/** Percent of max HP Swallow restores for 1, 2 or 3 Stockpiles */
const SWALLOW_HEALING = [25, 50, 100];
/** For Beat Up when a Pokémon's base Attack isn't known (battles started before it was tracked) */
const DEFAULT_BASE_ATTACK = 50;

export function createCombatant(input: {
  name: string;
  spriteUrl: string;
  types: PokemonType[];
  baseStats: { name: string; value: number }[];
  moves: MoveInfo[];
  level: number;
  weightKg?: number;
  /** Chance of being female in eighths, or -1 for genderless */
  genderRate?: number;
  random?: RandomSource;
  ability?: string | null;
  item?: string | null;
  nature?: string | null;
  canEvolve?: boolean;
}): Combatant {
  const { level } = input;
  const base = (name: string) => input.baseStats.find((s) => s.name === name)?.value ?? 50;
  const stats: BattleStats = {
    hp: statAtLevel(base("hp"), level, true),
    attack: Math.floor(statAtLevel(base("attack"), level) * natureMultiplier(input.nature, "attack")),
    defense: Math.floor(statAtLevel(base("defense"), level) * natureMultiplier(input.nature, "defense")),
    specialAttack: Math.floor(statAtLevel(base("special-attack"), level) * natureMultiplier(input.nature, "specialAttack")),
    specialDefense: Math.floor(statAtLevel(base("special-defense"), level) * natureMultiplier(input.nature, "specialDefense")),
    speed: Math.floor(statAtLevel(base("speed"), level) * natureMultiplier(input.nature, "speed")),
  };
  const usable = input.moves.filter(isUsableMove);
  const maxHp = stats.hp;

  return {
    name: input.name,
    spriteUrl: input.spriteUrl,
    types: input.types,
    level,
    stats,
    maxHp,
    hp: maxHp,
    moves: usable.length > 0 ? usable : [STRUGGLE],
    status: null,
    sleepTurns: 0,
    boosts: {},
    weightKg: input.weightKg,
    baseAttack: base("attack"),
    // Max PP, as with PP Ups
    pp: (usable.length > 0 ? usable : [STRUGGLE]).map((move) => (move.pp ? Math.floor((move.pp * 8) / 5) : null)),
    gender: genderFor(input.genderRate, input.random ?? Math.random),
    ability: input.ability ?? null,
    item: input.item ?? null,
    nature: input.nature ?? null,
    canEvolve: input.canEvolve ?? false,
  };
}

function genderFor(rate: number | undefined, random: RandomSource): Gender | null {
  if (rate === undefined || rate < 0) return null;
  return random() * 8 < rate ? "female" : "male";
}

/** Whether a move acts on the foe, so it needs a target and Protect or a substitute can block it */
export function targetsFoe(move: MoveInfo): boolean {
  if (move.category !== "status") return true;
  if (move.ailment) return true;
  if ((move.statChanges ?? []).length > 0 && move.statTarget !== "user") return true;
  if (move.volatile && FOE_VOLATILES.has(move.volatile)) return true;
  return FOE_STATUS_MOVES.has(move.name) || CONFUSING_MOVES.has(move.name);
}

export function shown(combatant: Combatant): ShownCombatant {
  const { name, spriteUrl, types, level, hp, maxHp, status, boosts } = combatant;
  const shownCombatant: ShownCombatant = { name, spriteUrl, types, level, hp, maxHp, status, boosts: { ...boosts } };
  if ((combatant.substituteHp ?? 0) > 0) shownCombatant.substitute = true;
  if (combatant.seeded) shownCombatant.seeded = true;
  if (combatant.gender) shownCombatant.gender = combatant.gender;
  const tags = volatileTags(combatant);
  if (tags.length > 0) shownCombatant.tags = tags;
  return shownCombatant;
}

export const MAX_STAGE = 6;

/** Multiplier for attack, defense and speed stages: +1 is ×1.5, +2 is ×2, -1 is ×0.67… */
export function stageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Multiplier for accuracy minus evasion stages */
export function accuracyMultiplier(stage: number): number {
  const clamped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
  return clamped >= 0 ? (3 + clamped) / 3 : 3 / (3 - clamped);
}

function stage(combatant: Combatant, stat: BoostStat): number {
  return combatant.boosts[stat] ?? 0;
}

/** What around the two Pokémon changes a hit's damage */
export type DamageContext = {
  weather?: Weather | null;
  field?: FieldState | null;
  /** The defender's side, for its screens */
  defenderSide?: SideIndex;
  /** Type effectiveness when the battle already worked it out (Foresight, Magnet Rise, Tar Shot…) */
  effectiveness?: number;
  /** Abilities and items in effect; when left out, the Pokémon's own are used */
  attackerAbility?: string | null;
  defenderAbility?: string | null;
  attackerItem?: string | null;
  defenderItem?: string | null;
  /** The attacker moves after the target this turn, for Analytic */
  movesLast?: boolean;
  /** The defender ate a berry that halves this hit */
  resistBerry?: boolean;
  /** Extra power, like the Metronome item's or Helping Hand's */
  powerMultiplier?: number;
  /** Extra Attack or Sp. Atk (Plus and Minus, Flower Gift) and Defense or Sp. Def (Flower Gift) from the field */
  attackMultiplier?: number;
  defenseMultiplier?: number;
  /** A last damage modifier, like an ally's Friend Guard */
  finalMultiplier?: number;
  /** The move hits several Pokémon at once, so it deals 75% */
  spread?: boolean;
  /** In a double battle, screens cut damage to about two thirds instead of half */
  doubles?: boolean;
};

export function calculateDamage(
  attacker: Combatant,
  defender: Combatant,
  move: MoveInfo,
  random: RandomSource,
  critical = false,
  context: DamageContext = {}
): { damage: number; effectiveness: number; critical: boolean } {
  const { weather = null, field = null, defenderSide } = context;
  const attackerAbility = context.attackerAbility !== undefined ? context.attackerAbility : (attacker.ability ?? null);
  const defenderAbility = context.defenderAbility !== undefined ? context.defenderAbility : (defender.ability ?? null);
  const attackerItem = context.attackerItem !== undefined ? context.attackerItem : (attacker.item ?? null);
  const defenderItem = context.defenderItem !== undefined ? context.defenderItem : (defender.item ?? null);
  const gravity = Boolean(field?.effects.gravity);
  // Struggle has no type
  const typeless = move.name === "struggle";
  const effectiveness = context.effectiveness ?? (typeless ? 1 : moveEffectiveness(move.type, defender.types, gravity));
  if (effectiveness === 0) return { damage: 0, effectiveness, critical: false };

  const abilities: AbilityDamageContext = {
    attackerAbility,
    defenderAbility,
    weather,
    terrain: field?.terrain?.kind ?? null,
    effectiveness,
    critical,
    movesLast: context.movesLast ?? false,
    flashFire: Boolean(attacker.volatiles?.flashFire),
  };
  const physical = move.category === "physical";
  // Unaware ignores the other Pokémon's stat changes
  let attackStage = defenderAbility === "unaware" ? 0 : stage(attacker, physical ? "attack" : "special-attack");
  let defenseStage = attackerAbility === "unaware" ? 0 : stage(defender, physical ? "defense" : "special-defense");
  // Critical hits ignore the attacker's drops and the defender's boosts
  if (critical) {
    attackStage = Math.max(0, attackStage);
    defenseStage = Math.min(0, defenseStage);
  }
  const hpRatio = attacker.hp / attacker.maxHp;
  const attack = Math.floor(
    (physical ? attacker.stats.attack : attacker.stats.specialAttack) *
      stageMultiplier(attackStage) *
      abilityAttackMultiplier(move, attacker.status, hpRatio, abilities) *
      itemAttackMultiplier(attackerItem, move) *
      (context.attackMultiplier ?? 1)
  );
  // Wonder Room swaps which defense stat each kind of move hits
  const wonderRoom = Boolean(field?.effects["wonder-room"]);
  const defense = Math.max(
    1,
    Math.floor(
      (physical !== wonderRoom ? defender.stats.defense : defender.stats.specialDefense) *
        stageMultiplier(defenseStage) *
        weatherDefenseMultiplier(weather, defender.types, physical) *
        abilityDefenseMultiplier(physical, defender.status, abilities) *
        itemDefenseMultiplier(defenderItem, physical, Boolean(defender.canEvolve)) *
        (context.defenseMultiplier ?? 1)
    )
  );
  const basePower = move.power ?? 0;
  const power = Math.max(
    1,
    Math.floor(
      basePower *
        abilityPowerMultiplier(move, basePower, hpRatio, abilities) *
        itemPowerMultiplier(attackerItem, move) *
        (context.powerMultiplier ?? 1)
    )
  );
  const levelFactor = (2 * attacker.level) / 5 + 2;
  const base = Math.floor((levelFactor * power * attack) / defense / 50) + 2;

  const stab = !typeless && attacker.types.includes(move.type) ? (attackerAbility === "adaptability" ? 2 : STAB_BONUS) : 1;
  const crit = critical ? CRIT_MULTIPLIER : 1;
  // Guts ignores the burn's Attack cut
  const burn = physical && attacker.status === "burn" && attackerAbility !== "guts" ? 0.5 : 1;
  const sky = weatherPowerMultiplier(weather, move.type);
  const ground = terrainPowerMultiplier(
    field?.terrain?.kind ?? null,
    move,
    isGrounded(attacker.types, gravity),
    isGrounded(defender.types, gravity)
  );
  const sport = sportMultiplier(field?.effects, move.type);
  // Screens halve damage, except from critical hits and Infiltrator
  const screens = field && defenderSide !== undefined && attackerAbility !== "infiltrator" ? field.sides[defenderSide].conditions : {};
  const screen = context.doubles ? 2732 / 4096 : 0.5;
  const screened = !critical && (screens["aurora-veil"] || (physical ? screens.reflect : screens["light-screen"])) ? screen : 1;
  const spread = context.spread ? 0.75 : 1;
  const final = context.finalMultiplier ?? 1;
  const abilityFinal = abilityFinalMultiplier(move, defender.hp === defender.maxHp, abilities);
  const itemFinal = itemFinalMultiplier(attackerItem, effectiveness);
  const berry = context.resistBerry ? 0.5 : 1;
  const roll = 0.85 + random() * 0.15;
  return {
    damage: Math.max(
      1,
      Math.floor(base * spread * effectiveness * stab * crit * burn * sky * ground * sport * screened * abilityFinal * itemFinal * berry * final * roll)
    ),
    effectiveness,
    critical,
  };
}

/** Types that can never get a status condition */
const STATUS_IMMUNITIES: Record<StatusCondition, PokemonType[]> = {
  burn: ["fire"],
  poison: ["poison", "steel"],
  paralysis: ["electric"],
  sleep: [],
  freeze: ["ice"],
};

export function canReceiveStatus(combatant: Combatant, status: StatusCondition): boolean {
  return (
    combatant.hp > 0 &&
    combatant.status === null &&
    !combatant.types.some((type) => STATUS_IMMUNITIES[status].includes(type))
  );
}

/** Critical-hit chance from the move's own rate plus extra stages from Focus Energy */
export function criticalChance(move: MoveInfo, extraStages = 0): number {
  return criticalChanceAt((move.critRate ?? 0) + extraStages);
}

export function effectiveSpeed(combatant: Combatant): number {
  const speed = Math.floor(combatant.stats.speed * stageMultiplier(stage(combatant, "speed")));
  return combatant.status === "paralysis" ? Math.floor(speed / 2) : speed;
}

const STATUS_INFLICTED: Record<StatusCondition, string> = {
  burn: "was burned!",
  poison: "was poisoned!",
  paralysis: "is paralyzed! It may be unable to move!",
  sleep: "fell asleep!",
  freeze: "was frozen solid!",
};

const STATUS_ALREADY: Record<StatusCondition, string> = {
  burn: "is already burned",
  poison: "is already poisoned",
  paralysis: "is already paralyzed",
  sleep: "is already asleep",
  freeze: "is already frozen",
};

export const STAT_NAMES: Record<BoostStat, string> = {
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
  accuracy: "accuracy",
  evasion: "evasiveness",
};

function statChangeText(name: string, stat: BoostStat, change: number, attempted: number): string {
  const label = `${name}'s ${STAT_NAMES[stat]}`;
  if (change === 0) return `${label} won't go any ${attempted > 0 ? "higher" : "lower"}!`;
  const size = Math.abs(change);
  if (change > 0) return `${label} ${size === 1 ? "rose" : size === 2 ? "rose sharply" : "rose drastically"}!`;
  return `${label} ${size === 1 ? "fell" : size === 2 ? "harshly fell" : "severely fell"}!`;
}

function effectNote(effectiveness: number): string {
  if (effectiveness > 1) return "It's super effective! ";
  if (effectiveness < 1) return "It's not very effective… ";
  return "";
}

/** The Pokémon in a slot (in a single battle, slot 0 and 1 are the two sides' Pokémon) */
export function activeOf(battle: Battle, slot: Slot): Combatant {
  const battleSide = battle.sides[slotSide(slot)];
  return battleSide.team[activeIndexes(battleSide)[slotPosition(slot)] ?? battleSide.active];
}

/** The other slot on the same side in a double battle, or null in a single battle */
export function allySlot(battle: Pick<Battle, "ruleset">, slot: Slot): Slot | null {
  return battleFormat(battle) === "doubles" ? (slot + 2) % 4 : null;
}

/** The slots of the other side */
export function foeSlots(battle: Pick<Battle, "ruleset">, slot: Slot): Slot[] {
  return battleSlots(battle).filter((each) => slotSide(each) !== slotSide(slot));
}

/** A slot's ability, unless Gastro Acid suppresses it */
export function activeAbility(battle: Battle, slot: Slot): string | null {
  const combatant = activeOf(battle, slot);
  return combatant.volatiles?.abilitySuppressed ? null : (combatant.ability ?? null);
}

/** A slot's item, unless Magic Room, Embargo or Klutz keeps it from working */
export function activeItem(battle: Battle, slot: Slot): string | null {
  const combatant = activeOf(battle, slot);
  if (!combatant.item || battle.field?.effects["magic-room"] || combatant.volatiles?.embargo) return null;
  return activeAbility(battle, slot) === "klutz" ? null : combatant.item;
}

/** The weather in effect: none while a Pokémon with Cloud Nine or Air Lock is in battle */
export function activeWeather(battle: Battle): Weather | null {
  const negated = battleSlots(battle).some((slot) => {
    const ability = activeAbility(battle, slot);
    return activeOf(battle, slot).hp > 0 && (ability === "cloud-nine" || ability === "air-lock");
  });
  return negated ? null : (battle.weather?.kind ?? null);
}

/** Abilities that start the weather or a terrain when their Pokémon comes in */
const ABILITY_WEATHER: Readonly<Record<string, Weather>> = {
  drizzle: "rain",
  drought: "sun",
  "sand-stream": "sand",
  "snow-warning": "snow",
  "orichalcum-pulse": "sun",
};
const ABILITY_TERRAIN: Readonly<Record<string, Terrain>> = {
  "electric-surge": "electric",
  "grassy-surge": "grassy",
  "misty-surge": "misty",
  "psychic-surge": "psychic",
  "hadron-engine": "electric",
};

/** A slot's Speed after stages, paralysis, Tailwind, weather abilities and items */
export function speedOf(battle: Battle, slot: Slot): number {
  const combatant = activeOf(battle, slot);
  const ability = activeAbility(battle, slot);
  const item = activeItem(battle, slot);
  const weather = activeWeather(battle);
  let multiplier = 1;
  if (
    (ability === "swift-swim" && weather === "rain") ||
    (ability === "chlorophyll" && weather === "sun") ||
    (ability === "sand-rush" && weather === "sand") ||
    (ability === "slush-rush" && (weather === "hail" || weather === "snow")) ||
    (ability === "surge-surfer" && battle.field?.terrain?.kind === "electric") ||
    (ability === "unburden" && combatant.volatiles?.unburden)
  ) {
    multiplier *= 2;
  }
  if (ability === "quick-feet" && combatant.status) multiplier *= 1.5;
  if (item === "choice-scarf") multiplier *= 1.5;
  if (item === "iron-ball") multiplier *= 0.5;
  if (battle.field?.sides[slotSide(slot)].conditions.tailwind) multiplier *= 2;
  const speed = Math.floor(combatant.stats.speed * stageMultiplier(stage(combatant, "speed")) * multiplier);
  // Quick Feet ignores paralysis
  return combatant.status === "paralysis" && ability !== "quick-feet" ? Math.floor(speed / 2) : speed;
}

/** A move's priority for a slot, with Prankster, Gale Wings and Triage */
export function effectivePriority(battle: Battle, slot: Slot, move: MoveInfo): number {
  const combatant = activeOf(battle, slot);
  const ability = activeAbility(battle, slot);
  let priority = move.priority ?? 0;
  if (ability === "prankster" && move.category === "status") priority += 1;
  if (ability === "gale-wings" && move.type === "flying" && combatant.hp === combatant.maxHp) priority += 1;
  if (ability === "triage" && (isHealingMove(move) || (move.drain ?? 0) > 0)) priority += 3;
  return priority;
}

/** Faster Pokémon first; a speed tie is a coin flip. Trick Room lets the slower Pokémon go first. */
function speedOrder(battle: Battle, random: RandomSource): Slot[] {
  const trickRoom = Boolean(battle.field?.effects["trick-room"]);
  const slots = battleSlots(battle);
  if (slots.length === 2) {
    const [a, b] = [speedOf(battle, 0), speedOf(battle, 1)];
    if (a !== b) return a > b === !trickRoom ? [0, 1] : [1, 0];
    return random() < 0.5 ? [0, 1] : [1, 0];
  }
  const keyed = slots.map((slot) => ({ slot, speed: speedOf(battle, slot), tie: random() }));
  keyed.sort((x, y) => (x.speed !== y.speed ? (trickRoom ? x.speed - y.speed : y.speed - x.speed) : x.tie - y.tie));
  return keyed.map(({ slot }) => slot);
}

/** Why each move of a slot's Pokémon can't be chosen now, or null when it can */
export function moveLocks(battle: Battle, slot: Slot): (string | null)[] {
  const combatant = activeOf(battle, slot);
  const foes = foeSlots(battle, slot).map((each) => activeOf(battle, each));
  const v = combatant.volatiles ?? {};
  return combatant.moves.map((move, index) => {
    if (combatant.pp?.[index] === 0) return "No PP left";
    if (v.disabled?.move === move.name) return "Disabled";
    if (v.encore && v.encore.move !== move.name && combatant.moves.some((each) => each.name === v.encore!.move)) {
      return `Encore: must use ${title(v.encore.move)}`;
    }
    if (v.taunt && move.category === "status") return "Taunted: attacks only";
    if (v.torment && combatant.lastMove?.name === move.name) return "Torment: not twice in a row";
    if (v.healBlock && isHealingMove(move)) return "Heal Block";
    if (foes.some((foe) => foe.hp > 0 && foe.volatiles?.imprison && foe.moves.some((each) => each.name === move.name))) return "Imprisoned";
    const item = activeItem(battle, slot);
    if (item?.startsWith("choice-") && v.choiceLock && v.choiceLock !== move.name && combatant.moves.some((each) => each.name === v.choiceLock)) {
      return `${itemName(item)}: locked into ${title(v.choiceLock)}`;
    }
    if (item === "assault-vest" && move.category === "status") return "Assault Vest: attacks only";
    return null;
  });
}

/** Why a slot's Pokémon can't switch out now, or null when it can */
export function switchLock(battle: Battle, slot: Slot): string | null {
  if (battle.field?.effects["fairy-lock"]) return "Fairy Lock keeps everyone from switching out this turn";
  const active = activeOf(battle, slot);
  if (active.hp === 0) return null;
  const name = title(active.name);
  if (active.bide) return `${name} is storing energy and can't switch out`;
  const v = active.volatiles;
  if (v?.commanding || v?.commanded) return `${name} is in the middle of a Commander combo and can't switch out`;
  if (v?.ingrain) return `${name} is rooted in place by Ingrain`;
  // Ghost types slip out of any trap
  if ((v?.trapped || v?.bound) && !active.types.includes("ghost")) return `${name} can't escape!`;
  return null;
}

/** Checks a choice for a slot's Pokémon. Returns an error message, or null when it's allowed. */
export function choiceError(battle: Battle, slot: Slot, choice: BattleChoice): string | null {
  const battleSide = battle.sides[slotSide(slot)];
  const active = activeOf(battle, slot);
  if (choice.kind === "move") {
    if (choice.index >= active.moves.length) return "That move doesn't exist";
    if (choice.targetSlot !== undefined && !battleSlots(battle).includes(choice.targetSlot)) return "That target isn't on the field";
    const locks = moveLocks(battle, slot);
    // Bide carries on, and with every move locked the Pokémon struggles
    if (active.bide || locks.every(Boolean)) return null;
    const lock = locks[choice.index];
    return lock ? `${title(active.moves[choice.index].name)} can't be used: ${lock}` : null;
  }
  const lock = switchLock(battle, slot);
  if (lock) return lock;
  const member = battleSide.team[choice.index];
  if (!member) return "That Pokémon isn't on your team";
  if (activeIndexes(battleSide).includes(choice.index)) return `${title(member.name)} is already in battle`;
  if (member.hp === 0) return `${title(member.name)} has fainted`;
  return null;
}

/** Whether a slot's Pokémon gets to choose what to do this turn: not when fainted, or hiding inside its ally with Commander */
export function slotActs(battle: Battle, slot: Slot): boolean {
  const combatant = activeOf(battle, slot);
  return combatant.hp > 0 && !combatant.volatiles?.commanding;
}

/**
 * Checks what a player chose for each of their positions in a turn. Positions whose Pokémon doesn't act are ignored.
 * Returns an error message, or null when it's allowed.
 */
export function sideChoicesError(battle: Battle, side: SideIndex, choices: readonly (BattleChoice | null)[]): string | null {
  const positions = activeIndexes(battle.sides[side]).length;
  const switchingIn = new Set<number>();
  for (let position = 0; position < positions; position++) {
    const slot = slotOf(side, position);
    if (!slotActs(battle, slot)) continue;
    const choice = choices[position];
    if (!choice) return `Choose what ${title(activeOf(battle, slot).name)} will do`;
    const error = choiceError(battle, slot, choice);
    if (error) return error;
    if (choice.kind === "switch") {
      if (switchingIn.has(choice.index)) return `${title(battle.sides[side].team[choice.index].name)} can only come in once`;
      switchingIn.add(choice.index);
    }
  }
  return null;
}

/** What a slot does when its player runs out of time: the first move it can use */
export function defaultChoice(battle: Battle, slot: Slot): BattleChoice {
  const index = moveLocks(battle, slot).findIndex((lock) => lock === null);
  return { kind: "move", index: Math.max(0, index) };
}

/** Damage a Pokémon took from a move this turn, and from which slot, for Counter, Mirror Coat and Bide */
type Hit = { amount: number; category: MoveInfo["category"]; from: Slot };

/** One target's share of a damaging move */
type TargetHit = { target: Slot; defender: Combatant; total: number; hitSub: boolean; flung: string | null };

/** Per-slot flags for one turn; in a single battle only slots 0 and 1 are used */
function perSlot<T>(value: () => T): T[] {
  return [value(), value(), value(), value()];
}

class TurnRunner {
  readonly events: BattleEvent[] = [];
  readonly battle: Battle;
  readonly random: RandomSource;
  /** Every slot on the field */
  readonly slots: Slot[];
  readonly doubles: boolean;
  /** Slots whose Pokémon fainted or was dragged out this turn; whoever is there now doesn't get to act */
  readonly fainted: boolean[] = perSlot(() => false);
  /** The Protect variant shielding each slot for the rest of the turn */
  readonly protecting: (string | null)[] = perSlot(() => null);
  /** Slots whose Pokémon has had its go this turn */
  readonly moved: boolean[] = perSlot(() => false);
  readonly flinched: boolean[] = perSlot(() => false);
  readonly enduring: boolean[] = perSlot(() => false);
  readonly magicCoat: boolean[] = perSlot(() => false);
  readonly snatching: boolean[] = perSlot(() => false);
  readonly electrified: boolean[] = perSlot(() => false);
  readonly powdered: boolean[] = perSlot(() => false);
  /** Helping Hand: how many times each slot's move this turn is powered up */
  readonly helped: number[] = perSlot(() => 0);
  /** Whether the last damaging move hit, and whether it hit a substitute, for U-turn and Dragon Tail */
  landed = false;
  landedOnSub = false;
  /** What each slot chose this turn, for Me First */
  choices: (BattleChoice | null)[] | null = null;
  /** The last damage each slot's Pokémon took from a move this turn, for Counter and Mirror Coat */
  readonly hitBy: (Hit | null)[] = perSlot(() => null);
  /** Quick Guard, Crafty Shield, Mat Block and Wide Guard up on each side this turn */
  readonly guards: [Set<string>, Set<string>] = [new Set(), new Set()];
  /** Follow Me, Rage Powder or Spotlight: the slot drawing the other side's single-target moves this turn, per side */
  readonly attention: ({ slot: Slot; powder: boolean } | null)[] = [null, null];
  /** Ion Deluge turns Normal moves into Electric ones for the rest of the turn */
  ionDeluge = false;
  /** The Pokémon still waiting to move this turn, in order; After You and Quash rearrange it */
  queue: { combatant: Combatant; choice: Extract<BattleChoice, { kind: "move" }> }[] = [];
  /** The slot whose move is running, so effects know who caused them */
  acting: Slot | null = null;
  /** Slots whose Eject Pack went off, to be switched out once the current action is over */
  readonly ejecting: boolean[] = perSlot(() => false);

  constructor(battle: Battle, random: RandomSource) {
    this.battle = battle;
    this.random = random;
    this.slots = battleSlots(battle);
    this.doubles = this.slots.length > 2;
  }

  /** The battle side a slot belongs to */
  sideData(slot: Slot): BattleSide {
    return this.battle.sides[slotSide(slot)];
  }

  /** The other slot on the same side (double battles only) */
  ally(slot: Slot): Slot | null {
    return allySlot(this.battle, slot);
  }

  /** The ally slot when its Pokémon is still standing */
  livingAlly(slot: Slot): Slot | null {
    const ally = this.ally(slot);
    return ally !== null && this.active(ally).hp > 0 ? ally : null;
  }

  foes(slot: Slot): Slot[] {
    return foeSlots(this.battle, slot);
  }

  livingFoes(slot: Slot): Slot[] {
    return this.foes(slot).filter((each) => this.active(each).hp > 0);
  }

  /** The foe across from a slot, or the other foe when that one is down: "the foe" for effects without a target */
  opponent(slot: Slot): Slot {
    const across = slotOf((1 - slotSide(slot)) as SideIndex, slotPosition(slot));
    if (this.active(across).hp > 0) return across;
    return this.livingFoes(slot)[0] ?? across;
  }

  /** The slots of a side, in position order */
  sideSlots(side: SideIndex): Slot[] {
    return this.slots.filter((slot) => slotSide(slot) === side);
  }

  /** Slots whose Pokémon is standing, in slot order */
  living(): Slot[] {
    return this.slots.filter((slot) => this.active(slot).hp > 0);
  }


  get weather(): Weather | null {
    return activeWeather(this.battle);
  }

  /**
   * Status conditions the target can get: nothing freezes in harsh sunlight, Safeguard and Misty Terrain protect,
   * and so do abilities like Immunity (unless a Mold Breaker attacks). `attackerSide` is whoever causes it.
   */
  canInflict(side: Slot, combatant: Combatant, status: StatusCondition, attackerSide?: Slot): boolean {
    if (!canReceiveStatus(combatant, status)) return false;
    if (status === "freeze" && this.weather === "sun") return false;
    const field = this.battle.field;
    // Safeguard doesn't stop a Pokémon's own Toxic Orb or Flame Orb
    if (field?.sides[slotSide(side)].conditions.safeguard && attackerSide !== side) return false;
    const terrain = field?.terrain?.kind;
    if (terrain && this.grounded(side) && (terrain === "misty" || (terrain === "electric" && status === "sleep"))) return false;
    const ability = this.abilityOf(side, attackerSide);
    if (ability && STATUS_IMMUNE_ABILITIES[ability]?.includes(status)) return false;
    if (ability === "leaf-guard" && this.weather === "sun") return false;
    return !this.veiled(side, combatant, status, attackerSide);
  }

  /** Sweet Veil, Pastel Veil and Flower Veil on the ally keep status conditions off */
  veiled(side: Slot, combatant: Combatant, status: StatusCondition, attackerSide?: Slot): boolean {
    const ally = this.livingAlly(side);
    const allyAbility = ally === null ? null : this.abilityOf(ally, attackerSide);
    if (allyAbility === "sweet-veil" && status === "sleep") return true;
    if (allyAbility === "pastel-veil" && status === "poison") return true;
    const byFoe = attackerSide !== undefined && slotSide(attackerSide) !== slotSide(side);
    return byFoe && combatant.types.includes("grass") && (allyAbility === "flower-veil" || this.abilityOf(side, attackerSide) === "flower-veil");
  }

  /** Starts the weather; a matching rock makes it last 8 turns. `quiet` is for abilities, which don't fail out loud. */
  setWeather(side: Slot, weather: Weather, quiet = false) {
    if (this.battle.weather?.kind === weather) {
      if (!quiet) this.emit(side, "But it failed!", { kind: "fail" });
      return;
    }
    const item = this.itemOf(side);
    const turns = item && WEATHER_ROCKS[item]?.includes(weather) ? 8 : WEATHER_TURNS;
    this.battle.weather = { kind: weather, turnsLeft: turns };
    this.emit(side, WEATHER_STARTED[weather], { kind: "weather", weather });
  }

  /** Counts the weather down, and lets sandstorm and hail hurt both Pokémon. Returns true when the battle ended. */
  weatherEndOfTurn(order: Slot[]): boolean {
    const state = this.battle.weather;
    if (!state) return false;
    state.turnsLeft -= 1;
    if (state.turnsLeft <= 0) {
      this.battle.weather = null;
      this.emit(0, WEATHER_ENDED[state.kind], { kind: "weather", weather: null });
      return false;
    }
    for (const side of order) {
      const combatant = this.active(side);
      if (combatant.hp === 0 || !hurtByWeather(state.kind, combatant.types) || this.weatherProof(side, state.kind)) continue;
      const amount = Math.max(1, Math.floor(combatant.maxHp / 16));
      combatant.hp = Math.max(0, combatant.hp - amount);
      this.emit(side, weatherChipText(state.kind, title(combatant.name)), {
        kind: "weather-damage",
        weather: state.kind,
        amount,
        hp: combatant.hp,
      });
      if (combatant.hp === 0 && this.faint(side)) return true;
    }
    return false;
  }

  /** Reports what happened to the Pokémon in a slot (or for effects on a whole side, any slot of it) */
  emit(slot: Slot, text: string, body: EventBody) {
    this.events.push({ side: slotSide(slot), slot, text, ...body } as BattleEvent);
  }

  active(slot: Slot): Combatant {
    return activeOf(this.battle, slot);
  }

  /** Puts a team member in a slot */
  place(slot: Slot, index: number) {
    const battleSide = this.sideData(slot);
    const position = slotPosition(slot);
    // A fresh array, so sides never share one
    if (battleSide.actives) battleSide.actives = battleSide.actives.map((each, at) => (at === position ? index : each));
    if (position === 0) battleSide.active = index;
  }

  /** Returns true when the battle ended (hazards can knock out the incoming Pokémon) */
  switchTo(side: Slot, index: number, opts: { dragged?: boolean; carry?: (incoming: Combatant) => void } = {}): boolean {
    const battleSide = this.sideData(side);
    const outgoing = this.active(side);
    outgoing.boosts = {};
    outgoing.protectStreak = 0;
    outgoing.stockpile = 0;
    outgoing.bide = null;
    outgoing.substituteHp = 0;
    outgoing.seeded = false;
    this.switchOutEffects(side);
    this.leaveField(side);
    this.emit(
      side,
      opts.dragged ? `${title(outgoing.name)} was dragged away!` : `${battleSide.displayName} withdrew ${title(outgoing.name)}!`,
      { kind: "withdraw" }
    );
    this.place(side, index);
    const incoming = this.active(side);
    opts.carry?.(incoming);
    // A Pokémon dragged in doesn't get to use the move its side chose
    if (opts.dragged) this.fainted[side] = true;
    this.emit(side, opts.dragged ? `${title(incoming.name)} was dragged out!` : `${battleSide.displayName} sent out ${title(incoming.name)}!`, {
      kind: "switch",
      combatant: shown(incoming),
    });
    return this.enterField(side);
  }

  /** Handles a faint in a slot. The player picks the replacement once the turn is over. Returns true when that ends the battle. */
  faint(side: Slot): boolean {
    const battleSide = this.sideData(side);
    this.fainted[side] = true;
    const fallen = this.active(side);
    this.emit(side, `${title(fallen.name)} fainted!`, { kind: "faint" });
    this.leaveField(side);

    if (!battleSide.team.some((combatant) => combatant.hp > 0)) {
      const winnerSide = (1 - slotSide(side)) as SideIndex;
      const winner = this.battle.sides[winnerSide];
      this.battle.winner = winner.userId;
      this.emit(winnerSide, `${winner.displayName} wins the battle!`, { kind: "win" });
      return true;
    }
    this.inheritAbility(side, fallen);
    return false;
  }

  /** Receiver and Power of Alchemy take on the ability of an ally that fainted */
  inheritAbility(side: Slot, fallen: Combatant) {
    const ally = this.livingAlly(side);
    const ability = ally === null ? null : this.abilityOf(ally);
    if (ally === null || (ability !== "receiver" && ability !== "power-of-alchemy")) return;
    const inherited = fallen.original?.ability ?? fallen.ability;
    if (!inherited || UNCOPYABLE_ABILITIES.has(inherited) || inherited === "receiver" || inherited === "power-of-alchemy") return;
    const heir = this.active(ally);
    this.backup(heir);
    heir.ability = inherited;
    this.announceAbility(ally, `${title(heir.name)}'s ${abilityName(ability)} took on ${title(fallen.name)}'s ${abilityName(inherited)}!`);
    this.switchInEffects(ally);
  }

  /** Marks the empty slots whose player has someone left to send in */
  markReplacements() {
    if (this.battle.winner !== null) {
      this.battle.replacing = undefined;
      return;
    }
    const replacing = this.slots.map(() => false);
    for (const side of [0, 1] as SideIndex[]) {
      let bench = healthyBench(this.sideData(side)).length;
      for (const slot of this.sideSlots(side)) {
        if (bench > 0 && this.active(slot).hp === 0) {
          replacing[slot] = true;
          bench -= 1;
        }
      }
    }
    this.battle.replacing = replacing.some(Boolean) ? replacing : undefined;
  }

  /** Returns true when the battle ended (hazards can knock out the incoming Pokémon) */
  sendOut(side: Slot, index: number): boolean {
    const battleSide = this.sideData(side);
    this.place(side, index);
    const next = this.active(side);
    this.emit(side, `${battleSide.displayName} sent out ${title(next.name)}!`, {
      kind: "switch",
      combatant: shown(next),
    });
    if (battleSide.healingWish) {
      battleSide.healingWish = false;
      const status = next.status;
      next.status = null;
      next.sleepTurns = 0;
      this.heal(side, next, next.maxHp, `The healing wish came true for ${title(next.name)}!`);
      if (status) this.emit(side, `${title(next.name)}'s status returned to normal!`, { kind: "cured", status });
    }
    return this.enterField(side);
  }

  /** Marks who must be replaced, and sends in the Pokémon left when there's nothing to choose */
  autoReplace() {
    this.markReplacements();
    // Hazards can knock out the Pokémon sent in, so keep going until nothing changes
    let changed = true;
    while (changed && this.battle.winner === null && this.battle.replacing) {
      changed = false;
      for (const side of [0, 1] as SideIndex[]) {
        const slots = this.sideSlots(side).filter((slot) => this.battle.replacing?.[slot]);
        const options = healthyBench(this.sideData(side));
        if (slots.length === 0 || options.length > slots.length) continue;
        changed = true;
        for (const [i, slot] of slots.entries()) {
          this.battle.replacing![slot] = false;
          if (this.sendOut(slot, options[i])) {
            this.battle.replacing = undefined;
            return;
          }
        }
      }
      this.markReplacements();
    }
  }

  /** Sleep, freeze and paralysis checks. Returns false when the Pokémon can't move. */
  canAct(side: Slot, move: MoveInfo): boolean {
    const combatant = this.active(side);
    const name = title(combatant.name);

    switch (combatant.status) {
      case "sleep":
        if (combatant.sleepTurns > 0) {
          combatant.sleepTurns -= 1;
          this.emit(side, `${name} is fast asleep.`, { kind: "cant-move", status: "sleep" });
          return move.name === "sleep-talk" || move.name === "snore";
        }
        combatant.status = null;
        this.emit(side, `${name} woke up!`, { kind: "cured", status: "sleep" });
        return true;
      case "freeze":
        if (move.type === "fire" || this.random() < 0.2) {
          combatant.status = null;
          this.emit(side, `${name} thawed out!`, { kind: "cured", status: "freeze" });
          return true;
        }
        this.emit(side, `${name} is frozen solid!`, { kind: "cant-move", status: "freeze" });
        return false;
      case "paralysis":
        if (this.random() < 0.25) {
          this.emit(side, `${name} is fully paralyzed!`, { kind: "cant-move", status: "paralysis" });
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  hits(attacker: Combatant, defender: Combatant, move: MoveInfo): boolean {
    const accuracy = move.accuracy ?? null;
    if (accuracy === null) return true;
    const side = this.sideOf(attacker);
    const target = this.sideOf(defender);
    const attackerAbility = this.abilityOf(side);
    const defenderAbility = this.abilityOf(target, side);
    if (attackerAbility === "no-guard" || this.abilityOf(target) === "no-guard") return true;
    if (attacker.volatiles?.lockOn || defender.volatiles?.telekinesis) return true;
    const gravity = this.battle.field?.effects.gravity ? 5 / 3 : 1;
    // Foresight, Miracle Eye, Keen Eye and Unaware ignore raised evasion; Unaware on the target ignores raised accuracy
    const ignoreEvasion = defender.volatiles?.identified || attackerAbility === "keen-eye" || attackerAbility === "unaware";
    const evasion = ignoreEvasion ? Math.min(0, stage(defender, "evasion")) : stage(defender, "evasion");
    const accuracyStage = defenderAbility === "unaware" ? 0 : stage(attacker, "accuracy");
    let odds = accuracy * accuracyMultiplier(accuracyStage - evasion) * gravity;
    if (attackerAbility === "compound-eyes") odds *= 1.3;
    if (attackerAbility === "hustle" && move.category === "physical") odds *= 0.8;
    const item = this.itemOf(side);
    if (item === "wide-lens") odds *= 1.1;
    // Victory Star helps the whole side
    const ally = this.livingAlly(side);
    if (attackerAbility === "victory-star" || (ally !== null && this.abilityOf(ally) === "victory-star")) odds *= 1.1;
    if (item === "zoom-lens" && this.moved[target]) odds *= 1.2;
    const defenderItem = this.itemOf(target);
    if (defenderItem === "bright-powder" || defenderItem === "lax-incense") odds *= 0.9;
    const weather = this.weather;
    if ((defenderAbility === "sand-veil" && weather === "sand") || (defenderAbility === "snow-cloak" && (weather === "hail" || weather === "snow"))) {
      odds *= 0.8;
    }
    return this.random() * 100 < odds;
  }

  /** Gives a status condition; Synchronize passes it back to whoever on `sourceSide` caused it */
  inflict(side: Slot, combatant: Combatant, status: StatusCondition, sourceSide?: Slot) {
    combatant.status = status;
    if (status === "sleep") combatant.sleepTurns = 1 + Math.floor(this.random() * 3);
    this.emit(side, `${title(combatant.name)} ${STATUS_INFLICTED[status]}`, { kind: "status", status });
    if (
      sourceSide !== undefined &&
      sourceSide !== side &&
      this.abilityOf(side) === "synchronize" &&
      (status === "burn" || status === "poison" || status === "paralysis")
    ) {
      const source = this.active(sourceSide);
      if (this.canInflict(sourceSide, source, status)) {
        this.announceAbility(side, `${title(combatant.name)}'s Synchronize!`);
        this.inflict(sourceSide, source, status);
      }
    }
    this.checkStatusItems(side);
  }

  /** The foe behind a stat drop or other effect: the one whose move is running, or the foe across */
  culprit(side: Slot): Slot {
    return this.acting !== null && slotSide(this.acting) !== slotSide(side) ? this.acting : this.opponent(side);
  }

  /** `copied` marks a Mirror Herb copying a foe's boosts, which isn't copied back */
  changeStats(side: Slot, combatant: Combatant, changes: readonly StatChange[], fromFoe = false, copied = false) {
    const ability = this.abilityOf(side, fromFoe ? this.culprit(side) : undefined);
    const name = title(combatant.name);
    // Flower Veil keeps foes from lowering the stats of Grass types on its side
    const ally = this.livingAlly(side);
    const flowerVeil = ability === "flower-veil" || (ally !== null && this.abilityOf(ally, this.culprit(side)) === "flower-veil");
    if (fromFoe && flowerVeil && combatant.types.includes("grass") && changes.some(({ change }) => change < 0)) {
      this.announceAbility(ability === "flower-veil" || ally === null ? side : ally, `${name} is protected by Flower Veil!`);
      changes = changes.filter(({ change }) => change > 0);
    }
    if (ability === "contrary") changes = changes.map(({ stat, change }) => ({ stat, change: -change }));
    if (ability === "simple") changes = changes.map(({ stat, change }) => ({ stat, change: change * 2 }));
    if (fromFoe && changes.some(({ change }) => change < 0)) {
      const guarded: Partial<Record<string, BoostStat>> = { "hyper-cutter": "attack", "keen-eye": "accuracy", "big-pecks": "defense" };
      if (ability === "clear-body" || ability === "white-smoke" || ability === "full-metal-body") {
        this.announceAbility(side, `${name}'s ${abilityName(ability)} prevents its stats from being lowered!`);
        changes = changes.filter(({ change }) => change > 0);
      } else if (this.itemOf(side) === "clear-amulet") {
        this.emit(side, `${name}'s Clear Amulet prevents its stats from being lowered!`, { kind: "item", item: "clear-amulet" });
        changes = changes.filter(({ change }) => change > 0);
      } else if (ability && guarded[ability] && changes.some(({ stat, change }) => stat === guarded[ability] && change < 0)) {
        this.announceAbility(side, `${name}'s ${abilityName(ability)} prevents its ${STAT_NAMES[guarded[ability]!]} from being lowered!`);
        changes = changes.filter(({ stat, change }) => stat !== guarded[ability] || change > 0);
      }
    }
    if (fromFoe && this.battle.field?.sides[slotSide(side)].conditions.mist && changes.some(({ change }) => change < 0)) {
      this.emit(side, `${name} is protected by the mist!`, { kind: "fail" });
      changes = changes.filter(({ change }) => change > 0);
    }
    let droppedByFoe = false;
    let dropped = false;
    const raised: StatChange[] = [];
    for (const { stat, change } of changes) {
      const before = stage(combatant, stat);
      const after = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, before + change));
      combatant.boosts[stat] = after;
      if (fromFoe && after < before) droppedByFoe = true;
      if (after < before) dropped = true;
      if (after > before) raised.push({ stat, change: after - before });
      this.emit(side, statChangeText(name, stat, after - before, change), {
        kind: "stat",
        stat,
        change: after - before,
        attempted: change,
      });
    }
    // Defiant and Competitive answer a foe lowering their stats
    if (droppedByFoe && (ability === "defiant" || ability === "competitive")) {
      this.announceAbility(side, `${name}'s ${abilityName(ability)}!`);
      this.changeStats(side, combatant, [{ stat: ability === "defiant" ? "attack" : "special-attack", change: 2 }]);
    }
    if (this.itemOf(side) === "white-herb" && BOOST_STATS.some((stat) => stage(combatant, stat) < 0)) {
      this.consumeItem(side, `${name} returned its stats to normal using its White Herb!`);
      for (const stat of BOOST_STATS) if (stage(combatant, stat) < 0) combatant.boosts[stat] = 0;
      this.emitVolatile(side, `${name}'s lowered stats were restored!`);
    } else if (dropped && combatant.hp > 0 && this.itemOf(side) === "eject-pack" && healthyBench(this.sideData(side)).length > 0) {
      // It switches out once the current move is over
      this.ejecting[side] = true;
    }
    // Mirror Herb copies a foe's stat boosts
    if (raised.length > 0 && !copied) {
      for (const foe of this.livingFoes(side)) {
        if (this.itemOf(foe) !== "mirror-herb") continue;
        const holder = this.active(foe);
        this.consumeItem(foe, `${title(holder.name)} used its Mirror Herb to mirror ${name}'s stat changes!`);
        this.changeStats(foe, holder, raised, false, true);
      }
    }
  }

  /** Switches out the Pokémon whose Eject Pack went off. Returns true when the battle ended. */
  processEjectPacks(): boolean {
    for (const slot of this.slots) {
      if (!this.ejecting[slot]) continue;
      this.ejecting[slot] = false;
      const holder = this.active(slot);
      if (holder.hp === 0 || this.itemOf(slot) !== "eject-pack" || healthyBench(this.sideData(slot)).length === 0) continue;
      this.consumeItem(slot, `${title(holder.name)} is switched out by the Eject Pack!`);
      this.fainted[slot] = true;
      if (this.pivot(slot, undefined, null)) return true;
    }
    return false;
  }

  heal(side: Slot, combatant: Combatant, amount: number, text: string) {
    if (combatant.volatiles?.healBlock) {
      this.emit(side, `${title(combatant.name)} can't heal because of Heal Block!`, { kind: "fail" });
      return;
    }
    const healed = Math.min(amount, combatant.maxHp - combatant.hp);
    combatant.hp += healed;
    this.emit(side, text, { kind: "heal", amount: healed, hp: combatant.hp });
  }

  /** Runs the move a slot chose, after the checks that can stop it. Returns true when the battle ended. */
  useMove(side: Slot, choice: Extract<BattleChoice, { kind: "move" }>): boolean {
    const attacker = this.active(side);
    const name = title(attacker.name);
    this.moved[side] = true;
    const locks = moveLocks(this.battle, side);
    const struggling = !attacker.bide && locks.every(Boolean);
    const move = struggling ? STRUGGLE : chosenMove(attacker, choice.index);
    const index = attacker.moves.indexOf(move);
    if (!PROTECT_MOVES.has(move.name) && move.name !== "endure") attacker.protectStreak = 0;

    if (this.flinched[side]) {
      this.emitVolatile(side, `${name} flinched and couldn't move!`, "Flinched!");
      return false;
    }
    if (!this.canAct(side, move)) {
      attacker.protectStreak = 0;
      attacker.bide = null;
      return false;
    }
    if (attacker.bide) return this.continueBide(side);
    if (this.abilityOf(side) === "truant" && attacker.volatiles?.truantLoaf) {
      attacker.volatiles.truantLoaf = false;
      this.announceAbility(side, `${name} is loafing around!`);
      return false;
    }
    const confused = this.confusionCheck(side);
    if (confused !== null) return confused;
    if (this.infatuationCheck(side)) return false;
    // A lock that started earlier this turn, like a faster foe's Taunt, still stops the move
    const lock = struggling || index === -1 ? null : locks[index];
    if (lock) {
      this.emit(side, `${name} can't use ${title(move.name)}! (${lock})`, { kind: "fail" });
      return false;
    }

    if (index !== -1) {
      this.spendPP(side, index);
      // Pressure makes moves aimed at it use an extra PP
      if (targetsFoe(move) && this.livingFoes(side).some((foe) => this.abilityOf(foe) === "pressure")) this.spendPP(side, index);
    }
    const volatilesNow = this.vol(side);
    if (this.abilityOf(side) === "truant") volatilesNow.truantLoaf = true;
    const heldItem = this.itemOf(side);
    if (heldItem?.startsWith("choice-") && move.name !== "struggle") volatilesNow.choiceLock ??= move.name;
    const streak = volatilesNow.metronomeStreak;
    volatilesNow.metronomeStreak = streak?.move === move.name ? { move: move.name, count: streak.count + 1 } : { move: move.name, count: 0 };
    const previous = attacker.lastMove ?? null;
    const volatiles = attacker.volatiles;
    // Destiny Bond and Grudge last until the user moves again
    if (volatiles) {
      volatiles.destinyBond = false;
      volatiles.grudge = false;
    }
    attacker.lastMove = move;
    if (!CALLING_MOVES.has(move.name) && move.name !== "struggle") this.battle.lastMove = move;
    const over = this.executeMove(side, move, { target: choice.target, previous, targetSlot: choice.targetSlot });
    if (!over) for (const each of this.slots) this.checkStatusItems(each);
    return over;
  }

  /** Uses a move, whether chosen or called by another move. Returns true when the battle ended. */
  executeMove(side: Slot, base: MoveInfo, opts: ExecuteOptions = {}): boolean {
    const outer = this.acting;
    this.acting = side;
    try {
      return this.runMove(side, base, opts);
    } finally {
      this.acting = outer;
    }
  }

  runMove(side: Slot, base: MoveInfo, opts: ExecuteOptions): boolean {
    const attacker = this.active(side);
    let move = weatherAdjustedMove(base, this.weather);
    const ability = this.abilityOf(side);
    const held = this.itemOf(side);
    if (move.name === "natural-gift" && held && isBerry(held)) move = { ...move, type: NATURAL_GIFT_TYPES[held] ?? move.type };
    const boosted = (type: PokemonType) => ({ ...move, type, power: move.power === null ? null : Math.floor(move.power * 1.2) });
    if (ability === "normalize" && move.name !== "struggle") move = boosted("normal");
    else if (ability && ATE_ABILITIES[ability] && move.type === "normal" && move.name !== "struggle") move = boosted(ATE_ABILITIES[ability]);
    const prankster = ability === "prankster" && move.category === "status";
    if (this.electrified[side]) move = { ...move, type: "electric" };
    else if (this.ionDeluge && move.type === "normal") move = { ...move, type: "electric" };

    attacker.uses = { ...attacker.uses, [move.name]: (attacker.uses?.[move.name] ?? 0) + 1 };
    if (!opts.silent) {
      this.emit(side, `${title(attacker.name)} used ${title(move.name)}.`, {
        kind: "move",
        move: move.name,
        moveType: move.type,
      });
    }

    // Powder makes a Fire move blow up in the user's face
    if (this.powdered[side] && move.type === "fire") {
      const amount = Math.max(1, Math.floor(attacker.maxHp / 4));
      this.hurt(side, amount, `When the flame touched the powder on ${title(attacker.name)}, it exploded!`);
      return attacker.hp === 0 && this.faint(side);
    }
    if (CALLING_MOVES.has(move.name)) return this.callMove(side, move);
    const unsupported = UNSUPPORTED_REASONS[move.name];
    if (unsupported) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }

    if (move.name === "bide") {
      attacker.bide = { turns: 2, damage: 0 };
      this.emit(side, `${title(attacker.name)} is storing energy!`, { kind: "info" });
      return false;
    }
    // Moves that need a partner fail without one
    const lonely = move.name === "ally-switch" ? !this.doubles : ALLY_MOVES.has(move.name) && this.livingAlly(side) === null;
    if (lonely) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }

    const needsFoe = targetsFoe(move);
    const kind = moveTargetOf(move, needsFoe);
    if (!needsFoe && !TARGETED_SUPPORT_MOVES.has(move.name)) {
      const foes = this.livingFoes(side);
      // Snatch takes a move that would only help its user
      const thief = foes.find((foe) => this.snatching[foe]);
      if (thief !== undefined && isSnatchable(move)) {
        this.snatching[thief] = false;
        this.emit(thief, `${title(this.active(thief).name)} snatched ${title(attacker.name)}'s move!`, { kind: "info" });
        return this.executeMove(thief, move, { silent: true });
      }
      // Magic Coat and Magic Bounce send hazards back
      const bouncer = foes.find((foe) => this.magicCoat[foe] || this.abilityOf(foe, side) === "magic-bounce");
      if (move.name in HAZARD_MOVES && bouncer !== undefined && !opts.bounced) {
        this.emit(bouncer, `${title(this.active(bouncer).name)} bounced the ${title(move.name)} back!`, { kind: "protect", blocked: true });
        return this.executeMove(bouncer, move, { silent: true, bounced: true });
      }
      return this.moveEffects(side, this.supportTarget(side, kind, opts.targetSlot), move, opts);
    }

    const targets = this.targetsFor(side, move, kind, opts.targetSlot);
    if (targets.length === 0) {
      this.emit(side, "But there was no target!", { kind: "fail" });
      return false;
    }
    // A move that hits several Pokémon deals 75% damage to each
    const spread = targets.length > 1;
    const reached: Slot[] = [];
    for (const target of targets) {
      const screened = needsFoe ? this.screen(side, target, move, prankster, isSpreadTarget(kind), opts) : "hit";
      if (screened === "over") return true;
      if (screened === "hit") reached.push(target);
    }
    if (reached.length === 0) return false;
    if (move.category === "status") {
      for (const target of reached) {
        if (this.moveEffects(side, target, move, opts)) return true;
        if (this.active(side) !== attacker) break;
      }
      return false;
    }

    this.landed = false;
    if (this.attack(side, reached, move, spread)) return true;
    const main = reached[0];
    if (move.name === "spit-up") this.releaseStockpile(side);
    this.clearField(side, main, move);
    if (this.landed && DRAG_OUT_MOVES.has(move.name) && this.active(main).hp > 0 && !this.landedOnSub) {
      if (this.dragOut(side, main, true)) return true;
    }
    // A Red Card may already have sent the user away
    if (this.landed && DAMAGING_PIVOTS.has(move.name) && attacker.hp > 0 && this.active(side) === attacker) {
      return this.pivot(side, opts.target, null);
    }
    return false;
  }

  /**
   * Protect, guards, abilities, Psychic Terrain, Magic Coat and substitutes stopping a move on one target.
   * Returns "hit" when the move goes ahead, "blocked" when it doesn't, "over" when the battle ended.
   */
  screen(side: Slot, target: Slot, move: MoveInfo, prankster: boolean, spreadMove: boolean, opts: ExecuteOptions): "hit" | "blocked" | "over" {
    const foe = this.active(target);
    const shield = this.protecting[target];
    if (shield && (move.category !== "status" || SHIELDS[shield]?.blocksStatus !== false)) {
      this.emit(target, `${title(foe.name)} protected itself!`, { kind: "protect", blocked: true });
      return this.punishContact(side, shield, move) ? "over" : "blocked";
    }
    if (this.blockedByGuard(target, move, spreadMove)) return "blocked";
    if (this.blockedByAbility(side, target, move, prankster)) return "blocked";
    const foeSide = slotSide(target) !== slotSide(side);
    if (foeSide && (move.priority ?? 0) > 0 && this.battle.field?.terrain?.kind === "psychic" && this.grounded(target)) {
      this.emit(target, `${title(foe.name)} is protected by the Psychic Terrain!`, { kind: "protect", blocked: true });
      return "blocked";
    }
    // Magic Coat sends status moves back at their user
    const bounces = this.magicCoat[target] || this.abilityOf(target, side) === "magic-bounce";
    if (move.category === "status" && bounces && !opts.bounced) {
      this.emit(target, `${title(foe.name)} bounced the ${title(move.name)} back!`, { kind: "protect", blocked: true });
      return this.executeMove(target, move, { silent: true, bounced: true, targetSlot: side }) ? "over" : "blocked";
    }
    // A substitute keeps status moves off the Pokémon behind it
    if (move.category === "status" && target !== side && (foe.substituteHp ?? 0) > 0 && !BYPASS_SUBSTITUTE.has(move.name)) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return "blocked";
    }
    return "hit";
  }

  /** What a status move does to its user, its side or one target. Returns true when the battle ended. */
  moveEffects(side: Slot, target: Slot, move: MoveInfo, opts: ExecuteOptions): boolean {
    if (this.fieldMove(side, target, move)) return false;
    const teamwork = this.doublesMove(side, target, move);
    if (teamwork !== null) return teamwork;
    const handled = this.volatileMove(side, target, move, opts);
    if (handled !== null) return handled;
    const swapped = this.itemAbilityMove(side, target, move);
    if (swapped !== null) return swapped;
    if (PROTECT_MOVES.has(move.name) || move.name === "endure") {
      this.protect(side, move.name);
      return false;
    }
    this.statusMove(side, target, move);
    this.clearField(side, target, move);
    if (move.name === "parting-shot") return this.pivot(side, opts.target, null);
    return false;
  }

  /** Who a move that acts on others hits in a double battle, after redirection; empty when there's nobody to hit */
  targetsFor(side: Slot, move: MoveInfo, kind: MoveTarget, chosen?: Slot): Slot[] {
    // Commander keeps Tatsugiri out of reach
    const reachable = (slot: Slot) => this.active(slot).hp > 0 && !this.active(slot).volatiles?.commanding;
    if (!this.doubles) {
      const foe = this.opponent(side);
      return reachable(foe) ? [foe] : [];
    }
    switch (kind) {
      case "all-opponents":
        return this.foes(side).filter(reachable);
      case "all-other-pokemon":
        return this.slots.filter((slot) => slot !== side && reachable(slot));
      case "random-opponent": {
        const foes = this.foes(side).filter(reachable);
        return foes.length > 0 ? [this.redirect(side, foes[this.randomIndex(foes.length)], move)] : [];
      }
      case "ally":
      case "all-allies": {
        const ally = this.livingAlly(side);
        return ally === null ? [] : [ally];
      }
    }
    let target = chosen !== undefined && chosen !== side ? chosen : this.opponent(side);
    // Counter, Mirror Coat and Metal Burst hit back at whoever hit the user
    const taken = this.hitBy[side];
    if (SPECIAL_DAMAGE[move.name]?.kind === "counter" && taken) target = taken.from;
    if (!reachable(target)) {
      // A move aimed at a foe that's gone hits the other foe; one aimed at a missing ally fails
      if (slotSide(target) === slotSide(side)) return [];
      const other = this.foes(side).find(reachable);
      if (other === undefined) return [];
      target = other;
    }
    return [this.redirect(side, target, move)];
  }

  /** The target of a move on the user, its side or the field (the foe for effects that need one) */
  supportTarget(side: Slot, kind: MoveTarget, chosen?: Slot): Slot {
    const ally = this.livingAlly(side);
    if ((kind === "ally" || kind === "all-allies") && ally !== null) return ally;
    if (kind === "user-or-ally") return chosen !== undefined && chosen === ally ? chosen : side;
    return this.opponent(side);
  }

  /** Follow Me, Rage Powder, Spotlight, Lightning Rod and Storm Drain draw single-target moves away from their target */
  redirect(side: Slot, target: Slot, move: MoveInfo): Slot {
    if (UNREDIRECTABLE_ABILITIES.has(this.abilityOf(side) ?? "")) return target;
    if (slotSide(target) !== slotSide(side)) {
      const center = this.attention[slotSide(target)];
      if (center && this.active(center.slot).hp > 0 && !(center.powder && this.powderProof(side))) return center.slot;
    }
    const drawsIn = (slot: Slot) => {
      const ability = this.abilityOf(slot, side);
      return this.active(slot).hp > 0 && ability !== null && REDIRECT_ABILITIES[ability] === move.type;
    };
    if (drawsIn(target)) return target;
    const rod = this.slots.find((slot) => slot !== side && slot !== target && drawsIn(slot));
    return rod ?? target;
  }

  /** Grass types, Overcoat and Safety Goggles keep powder (and Rage Powder's pull) off */
  powderProof(slot: Slot): boolean {
    return this.active(slot).types.includes("grass") || this.abilityOf(slot) === "overcoat" || this.itemOf(slot) === "safety-goggles";
  }

  /** Metronome, Mirror Move, Copycat, Assist, Sleep Talk, Nature Power and Me First. Returns true when the battle ended. */
  callMove(side: Slot, move: MoveInfo): boolean {
    const target = this.opponent(side);
    const user = this.active(side);
    const foe = this.active(target);
    const pick = (moves: MoveInfo[]) => {
      const options = moves.filter((each) => !NO_CALL_MOVES.has(each.name) && isUsableMove(each));
      return options.length > 0 ? options[this.randomIndex(options.length)] : null;
    };
    let called: MoveInfo | null = null;
    switch (move.name) {
      case "metronome":
        called = pick(user.metronomePool ?? []);
        break;
      case "mirror-move":
        called = foe.lastMove && !NO_CALL_MOVES.has(foe.lastMove.name) ? foe.lastMove : null;
        break;
      case "copycat":
        called = this.battle.lastMove && !NO_CALL_MOVES.has(this.battle.lastMove.name) ? this.battle.lastMove : null;
        break;
      case "assist":
        called = pick(this.sideData(side).team.filter((member) => member !== user).flatMap((member) => member.moves));
        break;
      case "sleep-talk":
        called = user.status === "sleep" ? pick(user.moves.filter((each) => each.name !== "sleep-talk")) : null;
        break;
      case "nature-power":
        called = NATURE_POWER_MOVES[this.battle.field?.terrain?.kind ?? "none"];
        break;
      case "me-first": {
        // Uses the foe's chosen attack before it does, 50% stronger
        const choice = this.choices?.[target];
        const foesMove = choice?.kind === "move" && !this.moved[target] ? chosenMove(foe, choice.index) : null;
        if (foesMove && foesMove.category !== "status" && !NO_CALL_MOVES.has(foesMove.name)) {
          called = { ...foesMove, power: foesMove.power === null ? null : Math.floor(foesMove.power * 1.5) };
        }
        break;
      }
    }
    if (!called) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }
    return this.executeMove(side, called);
  }

  /** The spiky Protect variants hit back at a physical attacker. Returns true when the battle ended. */
  punishContact(side: Slot, shield: string, move: MoveInfo): boolean {
    const punish = SHIELDS[shield]?.punish;
    const attacker = this.active(side);
    if (!punish || move.category !== "physical" || attacker.hp === 0 || this.itemOf(side) === "protective-pads") return false;
    const name = title(attacker.name);
    switch (punish) {
      case "attack":
        this.changeStats(side, attacker, [{ stat: "attack", change: -1 }], true);
        return false;
      case "defense":
        this.changeStats(side, attacker, [{ stat: "defense", change: -2 }], true);
        return false;
      case "speed":
        this.changeStats(side, attacker, [{ stat: "speed", change: -1 }], true);
        return false;
      case "spikes":
        if (!this.shieldedFromIndirect(side)) this.hurt(side, Math.max(1, Math.floor(attacker.maxHp / 8)), `${name} was hurt by the Spiky Shield!`);
        return attacker.hp === 0 && this.faint(side);
      case "poison":
      case "burn": {
        const status = punish === "poison" ? "poison" : "burn";
        if (this.canInflict(side, attacker, status)) this.inflict(side, attacker, status);
        return false;
      }
    }
  }

  /** Protect and its variants, and Endure: always work the first time, then a third as likely with each use in a row */
  protect(side: Slot, moveName: string) {
    const user = this.active(side);
    const streak = user.protectStreak ?? 0;
    if (streak > 0 && this.random() >= 1 / 3 ** streak) {
      user.protectStreak = 0;
      this.emit(side, "But it failed!", { kind: "fail" });
      return;
    }
    user.protectStreak = streak + 1;
    if (moveName === "endure") {
      this.enduring[side] = true;
      this.emit(side, `${title(user.name)} braced itself!`, { kind: "protect", blocked: false });
      return;
    }
    this.protecting[side] = moveName;
    this.emit(side, `${title(user.name)} protected itself!`, { kind: "protect", blocked: false });
  }

  /** Bide's later turns: store energy, then hit back for twice the damage taken. Returns true when the battle ended. */
  continueBide(side: Slot): boolean {
    const user = this.active(side);
    const bide = user.bide!;
    // It hits back at whoever hit it last
    const target = bide.from !== undefined && this.active(bide.from).hp > 0 ? bide.from : this.opponent(side);
    bide.turns -= 1;
    if (bide.turns > 0) {
      this.emit(side, `${title(user.name)} is storing energy!`, { kind: "info" });
      return false;
    }
    user.bide = null;
    this.emit(side, `${title(user.name)} unleashed its energy!`, { kind: "info" });
    const foe = this.active(target);
    if (bide.damage === 0 || foe.hp === 0) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }
    if (this.protecting[target]) {
      this.emit(target, `${title(foe.name)} protected itself!`, { kind: "protect", blocked: true });
      return false;
    }
    this.strike(target, bide.damage * 2, "physical", { effectiveness: 1, critical: false, from: side });
    return foe.hp === 0 && this.faint(target);
  }

  /** Spit Up and Swallow give back the defenses Stockpile raised */
  releaseStockpile(side: Slot) {
    const user = this.active(side);
    const stored = user.stockpile ?? 0;
    if (stored === 0) return;
    user.stockpile = 0;
    if (user.hp === 0) return;
    this.changeStats(side, user, [
      { stat: "defense", change: -stored },
      { stat: "special-defense", change: -stored },
    ]);
  }

  statusMove(side: Slot, target: Slot, move: MoveInfo) {
    const user = this.active(side);
    const foe = this.active(target);
    const ailment = move.ailment ?? null;
    const statChanges = move.statChanges ?? [];
    const confuses = move.volatile === "confusion" || CONFUSING_MOVES.has(move.name);
    const tarShot = move.volatile === "tar-shot" || move.name === "tar-shot";
    const hitsFoe = ailment !== null || (statChanges.length > 0 && move.statTarget !== "user") || confuses || tarShot;

    const weather = WEATHER_MOVES[move.name];
    if (weather) {
      this.setWeather(side, weather);
      return;
    }

    if (move.name === "stockpile") {
      const stored = user.stockpile ?? 0;
      if (stored >= MAX_STOCKPILE) {
        this.emit(side, `${title(user.name)} can't stockpile any more!`, { kind: "fail" });
        return;
      }
      user.stockpile = stored + 1;
      this.emit(side, `${title(user.name)} stockpiled ${stored + 1}!`, { kind: "info" });
    }
    if (move.name === "swallow") {
      const stored = user.stockpile ?? 0;
      if (stored === 0) {
        this.emit(side, "But it failed to swallow a thing!", { kind: "fail" });
      } else if (user.hp === user.maxHp) {
        this.emit(side, `${title(user.name)}'s HP is full!`, { kind: "fail" });
      } else {
        const percent = SWALLOW_HEALING[stored - 1];
        this.heal(side, user, Math.max(1, Math.floor((user.maxHp * percent) / 100)), `${title(user.name)} regained health!`);
        this.releaseStockpile(side);
      }
      return;
    }

    if (hitsFoe) {
      if (!this.hits(user, foe, move)) {
        this.emit(target, `${title(foe.name)} avoided the attack!`, { kind: "miss" });
        return;
      }
      // Thunder Wave can't paralyze Ground types
      if (ailment && move.type === "electric" && effectivenessAgainst(move.type, foe.types) === 0) {
        this.emit(target, `It doesn't affect ${title(foe.name)}…`, { kind: "immune" });
        return;
      }
    }

    let didSomething = move.name === "stockpile";
    if (ailment) {
      if (this.canInflict(target, foe, ailment, side)) {
        this.inflict(target, foe, ailment, side);
      } else if (foe.status === ailment) {
        this.emit(target, `${title(foe.name)} ${STATUS_ALREADY[ailment]}!`, { kind: "fail" });
      } else {
        this.emit(target, "But it failed!", { kind: "fail" });
      }
      didSomething = true;
    }
    if (statChanges.length > 0) {
      const recipients = this.statRecipients(side, target, move);
      for (const each of recipients) this.changeStats(each, this.active(each), statChanges, slotSide(each) !== slotSide(side));
      didSomething = recipients.length > 0;
    }
    if (confuses) {
      this.confuse(target, statChanges.length === 0);
      didSomething = true;
    }
    if (tarShot) {
      const v = this.vol(target);
      if (!v.tarShot) {
        v.tarShot = true;
        this.emitVolatile(target, `${title(foe.name)} became weaker to fire!`);
      }
      didSomething = true;
    }
    const healing = weatherHealing(move, this.weather);
    if (healing > 0) {
      if (user.hp === user.maxHp) {
        this.emit(side, `${title(user.name)}'s HP is full!`, { kind: "fail" });
      } else {
        const amount = Math.max(1, Math.floor((user.maxHp * healing) / 100));
        this.heal(side, user, amount, `${title(user.name)} regained health!`);
      }
      didSomething = true;
    }
    if (!didSomething) this.emit(side, "But nothing happened!", { kind: "fail" });
  }

  /** Whose stats a status move changes: the user, the target, or the user's side for moves like Howl and Coaching */
  statRecipients(side: Slot, target: Slot, move: MoveInfo): Slot[] {
    const kind = moveTargetOf(move, targetsFoe(move));
    const ally = this.livingAlly(side);
    let slots: Slot[];
    if (kind === "user-and-allies") slots = ally === null ? [side] : [side, ally];
    else if (kind === "all-allies" || kind === "ally") slots = ally === null ? [] : [ally];
    else if (kind === "user-or-ally") slots = [target];
    else slots = [move.statTarget === "user" ? side : target];
    // Gear Up and Magnetic Flux only help Plus and Minus Pokémon
    if (move.name === "gear-up" || move.name === "magnetic-flux") {
      slots = slots.filter((slot) => ["plus", "minus"].includes(this.abilityOf(slot) ?? ""));
    }
    return slots;
  }

  /** Takes HP off the target of a move from slot `from` and reports it. Returns true when a substitute took the hit. */
  strike(
    target: Slot,
    damage: number,
    category: MoveInfo["category"],
    { effectiveness, critical, prefix = "", from }: { effectiveness: number; critical: boolean; prefix?: string; from: Slot }
  ): boolean {
    const defender = this.active(target);
    const attackerSide = from;
    const name = title(defender.name);
    const substitute = defender.substituteHp ?? 0;
    if (substitute > 0 && this.abilityOf(attackerSide) !== "infiltrator") {
      defender.substituteHp = Math.max(0, substitute - damage);
      this.landed = true;
      this.landedOnSub = true;
      const broke = defender.substituteHp === 0;
      this.emit(
        target,
        `${prefix}${critical ? "A critical hit! " : ""}${effectNote(effectiveness)}The substitute took damage for ${name}!${broke ? ` ${name}'s substitute faded!` : ""}`,
        { kind: "substitute", active: !broke, hp: defender.hp }
      );
      return true;
    }
    // Endure, Sturdy and Focus Sash leave the Pokémon with 1 HP
    let held: "endure" | "sturdy" | "focus-sash" | null = null;
    if (damage >= defender.hp && defender.hp > 0) {
      const full = defender.hp === defender.maxHp;
      if (this.enduring[target]) held = "endure";
      else if (full && this.abilityOf(target, attackerSide) === "sturdy") held = "sturdy";
      else if (full && this.itemOf(target) === "focus-sash") held = "focus-sash";
    }
    if (held) damage = defender.hp - 1;
    defender.hp = Math.max(0, defender.hp - damage);
    this.hitBy[target] = { amount: damage, category, from };
    if (defender.bide) {
      defender.bide.damage += damage;
      defender.bide.from = from;
    }
    this.landed = true;
    this.landedOnSub = false;
    this.emit(
      target,
      `${prefix}${critical ? "A critical hit! " : ""}${effectNote(effectiveness)}${name} lost ${damage} HP.`,
      { kind: "damage", amount: damage, hp: defender.hp, effectiveness, critical }
    );
    if (held === "endure") this.emit(target, `${name} endured the hit!`, { kind: "info" });
    if (held === "sturdy") this.announceAbility(target, `${name} endured the hit with Sturdy!`);
    if (held === "focus-sash") this.consumeItem(target, `${name} hung on using its Focus Sash!`);
    if (damage > 0 && defender.item === "air-balloon") {
      this.emit(target, `${name}'s Air Balloon popped!`, { kind: "item", item: "air-balloon" });
      this.loseItem(target);
    }
    return false;
  }

  get field(): FieldState {
    this.battle.field ??= emptyField();
    return this.battle.field;
  }

  team(side: Slot): string {
    return `${this.sideData(side).displayName}'s team`;
  }

  grounded(side: Slot): boolean {
    const combatant = this.active(side);
    const gravity = Boolean(this.battle.field?.effects.gravity);
    const v = combatant.volatiles;
    if (gravity || v?.ingrain || this.itemOf(side) === "iron-ball") return true;
    if (v?.magnetRise || v?.telekinesis || this.itemOf(side) === "air-balloon" || this.abilityOf(side) === "levitate") return false;
    return isGrounded(combatant.types, false);
  }

  /** Speed after stages, paralysis, Tailwind, abilities and items */
  speed(side: Slot): number {
    return speedOf(this.battle, side);
  }

  damageContext(attackerSide: Slot, defenderSide: Slot, move: MoveInfo, spread = false): DamageContext {
    const streak = this.active(attackerSide).volatiles?.metronomeStreak;
    const metronome = this.itemOf(attackerSide) === "metronome" && streak?.move === move.name ? 1 + 0.2 * Math.min(streak.count, 5) : 1;
    const ability = this.abilityOf(attackerSide);
    const ally = this.livingAlly(attackerSide);
    const allyAbility = ally === null ? null : this.abilityOf(ally);
    // Helping Hand, then Power Spot, Battery and Steely Spirit from the ally
    let power = metronome * 1.5 ** this.helped[attackerSide];
    if (allyAbility === "power-spot") power *= 1.3;
    if (allyAbility === "battery" && move.category === "special") power *= 1.3;
    if (move.type === "steel" && (ability === "steely-spirit" || allyAbility === "steely-spirit")) power *= 1.5;
    let attack = 1;
    // Plus and Minus power each other up
    const plusMinus = (each: string | null) => each === "plus" || each === "minus";
    if (move.category === "special" && plusMinus(ability) && plusMinus(allyAbility)) attack *= 1.5;
    // Flower Gift powers up Attack and Sp. Def of its whole side in harsh sunlight
    const sunny = this.weather === "sun";
    if (sunny && move.category === "physical" && (ability === "flower-gift" || allyAbility === "flower-gift")) attack *= 1.5;
    const defenderAlly = this.livingAlly(defenderSide);
    const defenderAllyAbility = defenderAlly === null ? null : this.abilityOf(defenderAlly, attackerSide);
    const flowerGift = this.abilityOf(defenderSide, attackerSide) === "flower-gift" || defenderAllyAbility === "flower-gift";
    const defense = sunny && move.category === "special" && flowerGift ? 1.5 : 1;
    return {
      weather: this.weather,
      field: this.battle.field ?? null,
      defenderSide: slotSide(defenderSide),
      spread,
      doubles: this.doubles,
      attackMultiplier: attack,
      defenseMultiplier: defense,
      // Friend Guard softens hits on its allies
      finalMultiplier: defenderAllyAbility === "friend-guard" ? 0.75 : 1,
      effectiveness: this.effectiveness(move, this.active(defenderSide), attackerSide),
      attackerAbility: this.abilityOf(attackerSide),
      defenderAbility: this.abilityOf(defenderSide, attackerSide),
      attackerItem: this.itemOf(attackerSide),
      defenderItem: this.itemOf(defenderSide),
      movesLast: this.moved[defenderSide],
      powerMultiplier: power,
    };
  }

  /** Type effectiveness, with Gravity, levitation, Scrappy, Foresight, Miracle Eye and Tar Shot */
  effectiveness(move: MoveInfo, defender: Combatant, attackerSide?: Slot): number {
    if (move.name === "struggle") return 1;
    const defenderSide = this.sideOf(defender);
    const gravity = Boolean(this.battle.field?.effects.gravity);
    const v = defender.volatiles;
    if (move.type === "ground" && !gravity && !v?.ingrain && this.itemOf(defenderSide) !== "iron-ball") {
      const floating =
        v?.magnetRise || v?.telekinesis || this.itemOf(defenderSide) === "air-balloon" || this.abilityOf(defenderSide, attackerSide) === "levitate";
      if (floating) return 0;
    }
    let types = defender.types;
    const scrappy = attackerSide !== undefined && this.abilityOf(attackerSide) === "scrappy";
    if ((v?.identified === "foresight" || scrappy) && (move.type === "normal" || move.type === "fighting")) {
      types = types.filter((type) => type !== "ghost");
    }
    if (v?.identified === "miracle-eye" && move.type === "psychic") types = types.filter((type) => type !== "dark");
    const effectiveness = moveEffectiveness(move.type, types, gravity);
    return v?.tarShot && move.type === "fire" ? effectiveness * 2 : effectiveness;
  }

  /** Critical hit roll: Lucky Chant and Battle Armor rule it out; Laser Focus and Merciless make it sure; Focus Energy, Super Luck and Scope Lens raise it */
  rollCritical(side: Slot, target: Slot, move: MoveInfo): boolean {
    if (this.battle.field?.sides[slotSide(target)].conditions["lucky-chant"]) return false;
    const armor = this.abilityOf(target, side);
    if (armor === "battle-armor" || armor === "shell-armor") return false;
    const v = this.active(side).volatiles;
    if (v?.laserFocus) return true;
    const ability = this.abilityOf(side);
    if (ability === "merciless" && this.active(target).status === "poison") return true;
    const item = this.itemOf(side);
    const extra = (v?.critStage ?? 0) + (ability === "super-luck" ? 1 : 0) + (item === "scope-lens" || item === "razor-claw" ? 1 : 0);
    return this.random() < criticalChance(move, extra);
  }

  /** Reports a change to the field, with the field as it is now so the screen can follow along */
  emitField(side: Slot, text: string) {
    this.emit(side, text, { kind: "field", field: structuredClone(this.field) });
  }

  /** Quick Guard, Crafty Shield and Mat Block on the target's side. Returns true when the move is blocked. */
  blockedByGuard(target: Slot, move: MoveInfo, spreadMove = false): boolean {
    const guards = this.guards[slotSide(target)];
    const guard =
      guards.has("quick-guard") && (move.priority ?? 0) > 0
        ? "quick-guard"
        : guards.has("crafty-shield") && move.category === "status"
          ? "crafty-shield"
          : guards.has("mat-block") && move.category !== "status"
            ? "mat-block"
            : guards.has("wide-guard") && spreadMove && move.category !== "status"
              ? "wide-guard"
              : null;
    if (!guard) return false;
    this.emit(target, `${GUARD_MOVES[guard]} protected ${this.team(target)}!`, { kind: "protect", blocked: true });
    return true;
  }

  /** Status and field moves that change the field, guard the user's side, or set up Substitute or Leech Seed. Returns true when it handled the move. */
  fieldMove(side: Slot, target: Slot, move: MoveInfo): boolean {
    const user = this.active(side);
    const userName = title(user.name);
    const fail = (text = "But it failed!") => this.emit(side, text, { kind: "fail" });

    const sideMove = SIDE_CONDITION_MOVES[move.name];
    if (sideMove) {
      const conditions = this.field.sides[slotSide(side)].conditions;
      const needsSnow = sideMove.condition === "aurora-veil" && this.weather !== "hail" && this.weather !== "snow";
      if (conditions[sideMove.condition] || needsSnow) {
        fail();
      } else {
        const screen = sideMove.condition === "reflect" || sideMove.condition === "light-screen" || sideMove.condition === "aurora-veil";
        conditions[sideMove.condition] = screen && this.itemOf(side) === "light-clay" ? 8 : sideMove.turns;
        this.emitField(side, SIDE_CONDITION_STARTED[sideMove.condition](this.team(side)));
      }
      return true;
    }

    const hazardMove = HAZARD_MOVES[move.name];
    if (hazardMove) {
      const hazards = this.field.sides[slotSide(target)].hazards;
      const layers = hazards[hazardMove.hazard] ?? 0;
      if (layers >= hazardMove.maxLayers) {
        fail();
      } else {
        hazards[hazardMove.hazard] = layers + 1;
        this.emitField(target, HAZARD_SET[hazardMove.hazard](this.team(target)));
      }
      return true;
    }

    const effectMove = FIELD_EFFECT_MOVES[move.name];
    if (effectMove) {
      const effects = this.field.effects;
      if (effects[effectMove.effect] && effectMove.toggles) {
        delete effects[effectMove.effect];
        this.emitField(side, FIELD_EFFECT_ENDED[effectMove.effect]);
      } else if (effects[effectMove.effect]) {
        fail();
      } else {
        effects[effectMove.effect] = effectMove.turns;
        this.emitField(side, FIELD_EFFECT_STARTED[effectMove.effect](userName));
        if (effectMove.effect === "trick-room") {
          for (const each of this.slots) {
            if (this.itemOf(each) !== "room-service" || this.active(each).hp === 0) continue;
            this.consumeItem(each, `${title(this.active(each).name)} used its Room Service!`);
            this.changeStats(each, this.active(each), [{ stat: "speed", change: -1 }]);
          }
        }
      }
      return true;
    }

    const terrain = TERRAIN_MOVES[move.name];
    if (terrain) {
      this.setTerrain(side, terrain);
      return true;
    }

    if (move.name in GUARD_MOVES) {
      // Mat Block only works on the first turn after the user comes out
      if (move.name === "mat-block" && (user.activeTurns ?? 0) > 0) {
        fail();
      } else {
        this.guards[side].add(move.name);
        this.emit(side, `${GUARD_MOVES[move.name]} protected ${this.team(side)}!`, { kind: "protect", blocked: false });
      }
      return true;
    }

    switch (move.name) {
      case "haze":
        for (const each of this.slots) this.active(each).boosts = {};
        this.emit(side, "All stat changes were eliminated!", { kind: "haze" });
        return true;
      case "ion-deluge":
        this.ionDeluge = true;
        this.emit(side, "A deluge of ions showers the battlefield!", { kind: "info" });
        return true;
      case "court-change":
        this.field.sides.reverse();
        this.emitField(side, `${userName} swapped the battle effects affecting each side of the field!`);
        return true;
      case "substitute": {
        const cost = Math.floor(user.maxHp / 4);
        if ((user.substituteHp ?? 0) > 0) fail(`${userName} already has a substitute!`);
        else if (user.hp <= cost) fail("But it does not have enough HP left to make a substitute!");
        else {
          user.hp -= cost;
          user.substituteHp = cost;
          this.emit(side, `${userName} put in a substitute!`, { kind: "substitute", active: true, hp: user.hp });
        }
        return true;
      }
      case "leech-seed": {
        const foe = this.active(target);
        if (!this.hits(user, foe, move)) {
          this.emit(target, `${title(foe.name)} avoided the attack!`, { kind: "miss" });
        } else if (foe.types.includes("grass")) {
          this.emit(target, `It doesn't affect ${title(foe.name)}…`, { kind: "immune" });
        } else if (foe.seeded) {
          fail(`${title(foe.name)} is already seeded!`);
        } else {
          foe.seeded = true;
          foe.seededBy = side;
          this.emit(target, `${title(foe.name)} was seeded!`, { kind: "seeded", seeded: true });
        }
        return true;
      }
      default:
        return false;
    }
  }

  /** Defog, Tidy Up, Rapid Spin and Mortal Spin clearing hazards and more, after they hit */
  clearField(side: Slot, target: Slot, move: MoveInfo) {
    const field = this.battle.field;
    const user = this.active(side);
    if (user.hp === 0) return;
    const clearHazards = (which: Slot) => {
      if (!field || Object.keys(field.sides[slotSide(which)].hazards).length === 0) return false;
      field.sides[slotSide(which)].hazards = {};
      return true;
    };

    if (SPINNING_MOVES.has(move.name)) {
      if (user.volatiles?.bound) {
        const bound = user.volatiles.bound.move;
        user.volatiles.bound = undefined;
        this.emitVolatile(side, `${title(user.name)} was freed from ${title(bound)}!`);
      }
      if (user.seeded) {
        user.seeded = false;
        this.emit(side, `${title(user.name)} was freed from Leech Seed!`, { kind: "seeded", seeded: false });
      }
      if (clearHazards(side)) this.emitField(side, `${title(user.name)} blew away the hazards!`);
    }
    if (move.name === "defog") {
      let cleared = false;
      if (field) {
        const conditions = field.sides[slotSide(target)].conditions;
        for (const condition of ["reflect", "light-screen", "aurora-veil", "safeguard", "mist"] as const) {
          if (conditions[condition]) {
            delete conditions[condition];
            cleared = true;
          }
        }
        if (field.terrain) {
          field.terrain = null;
          cleared = true;
        }
      }
      cleared = clearHazards(0) || cleared;
      cleared = clearHazards(1) || cleared;
      if (cleared) this.emitField(side, "The fog cleared away the barriers and hazards!");
    }
    if (move.name === "tidy-up") {
      let cleared = clearHazards(0);
      cleared = clearHazards(1) || cleared;
      for (const each of this.slots) {
        const combatant = this.active(each);
        if ((combatant.substituteHp ?? 0) > 0) {
          combatant.substituteHp = 0;
          this.emit(each, `${title(combatant.name)}'s substitute faded!`, { kind: "substitute", active: false, hp: combatant.hp });
        }
      }
      if (cleared) this.emitField(side, "Tidying up complete!");
    }
  }

  /** Brick Break and Psychic Fangs shatter Reflect, Light Screen and Aurora Veil */
  breakScreens(target: Slot) {
    const conditions = this.battle.field?.sides[slotSide(target)].conditions;
    if (!conditions) return;
    const screens = (["reflect", "light-screen", "aurora-veil"] as const).filter((screen) => conditions[screen]);
    if (screens.length === 0) return;
    for (const screen of screens) delete conditions[screen];
    this.emitField(target, "It shattered the barrier!");
  }

  /** Hazards hurting or hindering a Pokémon that just came in. Returns true when the battle ended. */
  enterField(side: Slot): boolean {
    const combatant = this.active(side);
    combatant.activeTurns = 0;
    // Heavy-Duty Boots step over hazards
    const hazards = this.itemOf(side) === "heavy-duty-boots" ? undefined : this.battle.field?.sides[slotSide(side)].hazards;
    if (!hazards) {
      this.switchInEffects(side);
      return false;
    }
    const name = title(combatant.name);
    const hurt = (hazard: Hazard, amount: number, text: string) => {
      if (this.shieldedFromIndirect(side)) return;
      combatant.hp = Math.max(0, combatant.hp - amount);
      this.emit(side, text, { kind: "hazard-damage", hazard, amount, hp: combatant.hp });
    };

    if (hazards["stealth-rock"]) {
      const amount = Math.max(1, Math.floor((combatant.maxHp * effectivenessAgainst("rock", combatant.types)) / 8));
      hurt("stealth-rock", amount, `Pointed stones dug into ${name}!`);
    }
    const grounded = this.grounded(side);
    const spikes = hazards.spikes ?? 0;
    if (combatant.hp > 0 && spikes > 0 && grounded) {
      const fraction = [0, 1 / 8, 1 / 6, 1 / 4][Math.min(spikes, 3)];
      hurt("spikes", Math.max(1, Math.floor(combatant.maxHp * fraction)), `${name} is hurt by the spikes!`);
    }
    if (combatant.hp > 0 && hazards["toxic-spikes"] && grounded) {
      if (combatant.types.includes("poison")) {
        delete hazards["toxic-spikes"];
        this.emitField(side, `${name} absorbed the poison spikes!`);
      } else if (this.canInflict(side, combatant, "poison")) {
        this.inflict(side, combatant, "poison");
      }
    }
    if (combatant.hp > 0 && hazards["sticky-web"] && grounded) {
      this.emit(side, `${name} was caught in a sticky web!`, { kind: "info" });
      this.changeStats(side, combatant, [{ stat: "speed", change: -1 }]);
    }
    if (combatant.hp === 0) return this.faint(side);
    this.checkHpItems(side);
    this.switchInEffects(side);
    return false;
  }

  /** Grassy Terrain healing and Leech Seed draining. Returns true when the battle ended. */
  fieldEndOfTurn(order: Slot[]): boolean {
    if (this.battle.field?.terrain?.kind === "grassy") {
      for (const side of order) {
        const combatant = this.active(side);
        if (combatant.hp === 0 || combatant.hp === combatant.maxHp || !this.grounded(side)) continue;
        this.heal(side, combatant, Math.max(1, Math.floor(combatant.maxHp / 16)), `${title(combatant.name)} is healed by the grassy terrain!`);
      }
    }
    for (const side of order) {
      const seeded = this.active(side);
      if (seeded.hp === 0 || !seeded.seeded || this.shieldedFromIndirect(side)) continue;
      const amount = Math.min(seeded.hp, Math.max(1, Math.floor(seeded.maxHp / 8)));
      seeded.hp -= amount;
      this.emit(side, `${title(seeded.name)}'s health is sapped by Leech Seed!`, { kind: "leech", amount, hp: seeded.hp });
      // The Pokémon in the seeder's place gets the HP
      const other = seeded.seededBy ?? this.opponent(side);
      const sapper = this.active(other);
      if (this.abilityOf(side) === "liquid-ooze") {
        if (sapper.hp > 0 && !this.shieldedFromIndirect(other)) this.hurt(other, amount, `${title(sapper.name)} sucked up the liquid ooze!`);
        if (sapper.hp === 0 && this.faint(other)) return true;
      } else if (sapper.hp > 0 && sapper.hp < sapper.maxHp) {
        const healed = this.itemOf(other) === "big-root" ? Math.floor(amount * 1.3) : amount;
        this.heal(other, sapper, healed, `${title(sapper.name)} regained health!`);
      }
      if (seeded.hp === 0 && this.faint(side)) return true;
    }
    return false;
  }

  /** Field effects counting down after the end-of-turn damage */
  fieldCountdown() {
    const field = this.battle.field;
    if (!field) return;
    field.sides.forEach((sideField, index) => {
      const side = index as SideIndex;
      for (const condition of Object.keys(sideField.conditions) as SideCondition[]) {
        const left = (sideField.conditions[condition] ?? 0) - 1;
        if (left > 0) {
          sideField.conditions[condition] = left;
        } else {
          delete sideField.conditions[condition];
          this.emitField(side, `${this.team(side)}'s ${SIDE_CONDITION_NAMES[condition]} wore off!`);
        }
      }
    });
    for (const effect of Object.keys(field.effects) as FieldEffect[]) {
      const left = (field.effects[effect] ?? 0) - 1;
      if (left > 0) {
        field.effects[effect] = left;
      } else {
        delete field.effects[effect];
        if (FIELD_EFFECT_ENDED[effect]) this.emitField(0, FIELD_EFFECT_ENDED[effect]);
      }
    }
    if (field.terrain) {
      field.terrain.turnsLeft -= 1;
      if (field.terrain.turnsLeft <= 0) {
        const ended = field.terrain.kind;
        field.terrain = null;
        this.emitField(0, TERRAIN_ENDED[ended]);
      }
    }
  }

  /** A random index below `count` */
  randomIndex(count: number): number {
    return Math.min(count - 1, Math.floor(this.random() * count));
  }

  /** A Pokémon's volatile effects, created when first needed */
  vol(side: Slot): Volatiles {
    const combatant = this.active(side);
    combatant.volatiles ??= {};
    return combatant.volatiles;
  }

  /** Reports a change to a Pokémon (a volatile effect, its types or stats), with how it looks now */
  emitVolatile(side: Slot, text: string, float?: string) {
    this.emit(side, text, { kind: "volatile", combatant: shown(this.active(side)), ...(float ? { float } : {}) });
  }

  /** HP lost to something other than a hit: curses, binding, confusion and the like */
  hurt(side: Slot, amount: number, text: string) {
    const combatant = this.active(side);
    const lost = Math.min(amount, combatant.hp);
    combatant.hp -= lost;
    this.emit(side, text, { kind: "hurt", amount: lost, hp: combatant.hp });
  }

  /** Remembers a Pokémon's types, stats and moves before Transform, Soak or Mimic change them for this stay in battle */
  backup(combatant: Combatant) {
    combatant.original ??= {
      types: [...combatant.types],
      stats: { ...combatant.stats },
      moves: [...combatant.moves],
      pp: combatant.pp ? [...combatant.pp] : undefined,
      spriteUrl: combatant.spriteUrl,
      ability: combatant.ability ?? null,
    };
  }

  /** A Pokémon leaving the field (switched out or fainted) loses its volatile effects, and frees the foe it trapped */
  leaveField(side: Slot) {
    const leaving = this.active(side);
    const original = leaving.original;
    if (original) {
      leaving.types = original.types;
      leaving.stats = original.stats;
      leaving.moves = original.moves;
      leaving.pp = original.pp;
      leaving.spriteUrl = original.spriteUrl;
      if (original.ability !== undefined) leaving.ability = original.ability;
      leaving.original = undefined;
    }
    // Commander ends when either of the pair leaves
    const ally = this.ally(side);
    const partner = ally === null ? undefined : this.active(ally).volatiles;
    if (partner && (leaving.volatiles?.commanded || leaving.volatiles?.commanding) && (partner.commanding || partner.commanded)) {
      const hiding = partner.commanding;
      partner.commanding = false;
      partner.commanded = false;
      if (hiding && this.active(ally!).hp > 0) this.emitVolatile(ally!, `${title(this.active(ally!).name)} came out of hiding!`);
    }
    leaving.volatiles = {};
    leaving.lastMove = null;
    // Traps, binding and love it caused end
    for (const each of this.foes(side)) {
      const foe = this.active(each).volatiles;
      if (!foe) continue;
      if (foe.trappedBy === undefined || foe.trappedBy === side) {
        foe.trapped = false;
        foe.octolock = false;
        foe.trappedBy = undefined;
      }
      if (foe.bound && (foe.bound.by === undefined || foe.bound.by === side)) foe.bound = undefined;
      if (foe.infatuatedBy === undefined || foe.infatuatedBy === side) {
        foe.infatuated = false;
        foe.infatuatedBy = undefined;
      }
    }
  }

  spendPP(side: Slot, index: number) {
    const pp = this.active(side).pp;
    const left = pp?.[index];
    if (pp && left !== null && left !== undefined) pp[index] = Math.max(0, left - 1);
  }

  /** PP left for a move a Pokémon knows; null when it never runs out, undefined when it doesn't know it */
  ppLeft(side: Slot, moveName: string): number | null | undefined {
    const combatant = this.active(side);
    const index = combatant.moves.findIndex((move) => move.name === moveName);
    if (index === -1) return undefined;
    return combatant.pp?.[index] ?? null;
  }

  /** Confuses the active Pokémon of a side, unless something protects it */
  confuse(side: Slot, fromStatusMove: boolean) {
    const combatant = this.active(side);
    const volatiles = this.vol(side);
    const field = this.battle.field;
    const protectedFrom =
      field?.sides[slotSide(side)].conditions.safeguard || (field?.terrain?.kind === "misty" && this.grounded(side)) || this.abilityOf(side) === "own-tempo";
    if (volatiles.confusion || protectedFrom || combatant.hp === 0) {
      if (fromStatusMove) {
        this.emit(side, volatiles.confusion ? `${title(combatant.name)} is already confused!` : "But it failed!", { kind: "fail" });
      }
      return;
    }
    volatiles.confusion = 2 + Math.floor(this.random() * 4);
    this.emitVolatile(side, `${title(combatant.name)} became confused!`, "Confused!");
    this.checkStatusItems(side);
  }

  /** Confusion before a move: may snap out of it, or hurt itself instead. Returns null when the move goes ahead. */
  confusionCheck(side: Slot): boolean | null {
    const combatant = this.active(side);
    const volatiles = combatant.volatiles;
    if (!volatiles?.confusion) return null;
    const name = title(combatant.name);
    volatiles.confusion -= 1;
    if (volatiles.confusion === 0) {
      this.emitVolatile(side, `${name} snapped out of its confusion!`);
      return null;
    }
    this.emitVolatile(side, `${name} is confused!`, "Confused!");
    if (this.random() >= 1 / 3) return null;
    // A 40-power typeless physical hit on itself
    const attack = Math.floor(combatant.stats.attack * stageMultiplier(stage(combatant, "attack")));
    const defense = Math.floor(combatant.stats.defense * stageMultiplier(stage(combatant, "defense")));
    const base = Math.floor((((2 * combatant.level) / 5 + 2) * 40 * attack) / defense / 50) + 2;
    const damage = Math.max(1, Math.floor(base * (0.85 + this.random() * 0.15)));
    this.hurt(side, damage, "It hurt itself in its confusion!");
    return combatant.hp === 0 ? this.faint(side) : false;
  }

  /** Infatuation before a move. Returns true when love keeps the Pokémon from moving. */
  infatuationCheck(side: Slot): boolean {
    const combatant = this.active(side);
    if (!combatant.volatiles?.infatuated) return false;
    const foe = this.active(combatant.volatiles.infatuatedBy ?? this.opponent(side));
    this.emitVolatile(side, `${title(combatant.name)} is in love with ${title(foe.name)}!`, "In love!");
    if (this.random() >= 0.5) return false;
    this.emit(side, `${title(combatant.name)} is immobilized by love!`, { kind: "info" });
    return true;
  }

  /** Switches a side's Pokémon out mid-turn for U-turn, Baton Pass and the like. Returns true when the battle ended. */
  pivot(side: Slot, chosen: number | undefined, pass: "baton-pass" | "shed-tail" | null): boolean {
    const battleSide = this.sideData(side);
    const bench = healthyBench(battleSide);
    if (bench.length === 0 || this.active(side).hp === 0) return false;
    const index = chosen !== undefined && bench.includes(chosen) ? chosen : bench[0];
    const outgoing = this.active(side);
    let carry: ((incoming: Combatant) => void) | undefined;
    if (pass === "baton-pass") {
      const boosts = { ...outgoing.boosts };
      const substituteHp = outgoing.substituteHp ?? 0;
      const seeded = outgoing.seeded;
      const v = outgoing.volatiles ?? {};
      const passed: Volatiles = {
        confusion: v.confusion, critStage: v.critStage, ingrain: v.ingrain, aquaRing: v.aquaRing, cursed: v.cursed,
        perish: v.perish, magnetRise: v.magnetRise, lockOn: v.lockOn, healBlock: v.healBlock, trapped: v.trapped,
        trappedBy: v.trappedBy,
      };
      const seededBy = outgoing.seededBy;
      carry = (incoming) => {
        incoming.boosts = boosts;
        incoming.substituteHp = substituteHp;
        incoming.seeded = seeded;
        incoming.seededBy = seededBy;
        incoming.volatiles = passed;
      };
    } else if (pass === "shed-tail") {
      const substituteHp = Math.floor(outgoing.maxHp / 4);
      carry = (incoming) => {
        incoming.substituteHp = substituteHp;
      };
    }
    return this.switchTo(side, index, { carry });
  }

  /** Roar, Whirlwind, Dragon Tail: the target is swapped for a random teammate. Returns true when the battle ended. */
  dragOut(side: Slot, target: Slot, afterHit: boolean): boolean {
    const bench = healthyBench(this.sideData(target));
    const foe = this.active(target);
    // Ingrain roots it in place, and Commander keeps Dondozo on the field
    if (bench.length === 0 || foe.volatiles?.ingrain || foe.volatiles?.commanded) {
      if (!afterHit) this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }
    const index = bench[this.randomIndex(bench.length)];
    return this.switchTo(target, index, { dragged: true });
  }

  /** Status moves with volatile effects. Returns null when the move isn't one of them, else whether the battle ended. */
  volatileMove(side: Slot, target: Slot, move: MoveInfo, opts: ExecuteOptions): boolean | null {
    const user = this.active(side);
    const foe = this.active(target);
    const userName = title(user.name);
    const foeName = title(foe.name);
    const battleSide = this.sideData(side);
    const gravity = Boolean(this.battle.field?.effects.gravity);
    const fail = (text = "But it failed!") => {
      this.emit(side, text, { kind: "fail" });
      return false;
    };
    const lands = () => {
      if (this.hits(user, foe, move)) return true;
      this.emit(target, `${foeName} avoided the attack!`, { kind: "miss" });
      return false;
    };
    const boostsChanged = (each: Slot) => this.emitVolatile(each, `${title(this.active(each).name)}'s stats changed!`);
    // Aroma Veil keeps mind games off its whole side
    if (AROMA_VEIL_MOVES.has(move.name) && this.aromaVeiled(target, side)) return fail(`${foeName} is protected by an aromatic veil!`);

    switch (move.name) {
      // Effects on the foe
      case "taunt": {
        if (!lands()) return false;
        const v = this.vol(target);
        if (v.taunt || this.abilityOf(target, side) === "oblivious") return fail();
        v.taunt = 3;
        this.emitVolatile(target, `${foeName} fell for the taunt!`, "Taunted!");
        return false;
      }
      case "encore": {
        const last = foe.lastMove;
        const v = this.vol(target);
        const pp = last ? this.ppLeft(target, last.name) : undefined;
        if (!last || v.encore || NO_CALL_MOVES.has(last.name) || CALLING_MOVES.has(last.name) || pp === undefined || pp === 0) return fail();
        v.encore = { move: last.name, turns: 3 };
        this.emitVolatile(target, `${foeName} must do an encore!`, "Encore!");
        return false;
      }
      case "torment": {
        const v = this.vol(target);
        if (v.torment) return fail();
        v.torment = true;
        this.emitVolatile(target, `${foeName} was subjected to torment!`);
        return false;
      }
      case "disable": {
        const last = foe.lastMove;
        const v = this.vol(target);
        if (!last || v.disabled || last.name === "struggle" || this.ppLeft(target, last.name) === undefined) return fail();
        if (!lands()) return false;
        v.disabled = { move: last.name, turns: 4 };
        this.emitVolatile(target, `${foeName}'s ${title(last.name)} was disabled!`, "Disabled!");
        return false;
      }
      case "heal-block": {
        const v = this.vol(target);
        if (v.healBlock) return fail();
        v.healBlock = 5;
        this.emitVolatile(target, `${foeName} was prevented from healing!`);
        return false;
      }
      case "attract": {
        if (!lands()) return false;
        const v = this.vol(target);
        if (!user.gender || !foe.gender || user.gender === foe.gender || v.infatuated || this.abilityOf(target, side) === "oblivious") return fail();
        v.infatuated = true;
        v.infatuatedBy = side;
        this.emitVolatile(target, `${foeName} fell in love!`, "In love!");
        return false;
      }
      case "yawn": {
        const v = this.vol(target);
        if (v.yawn || !this.canInflict(target, foe, "sleep")) return fail();
        v.yawn = 2;
        this.emitVolatile(target, `${userName} made ${foeName} drowsy!`, "Drowsy");
        return false;
      }
      case "nightmare": {
        const v = this.vol(target);
        if (foe.status !== "sleep" || v.nightmare) return fail();
        v.nightmare = true;
        this.emitVolatile(target, `${foeName} began having a nightmare!`);
        return false;
      }
      case "curse": {
        if (!user.types.includes("ghost")) {
          this.changeStats(side, user, [
            { stat: "speed", change: -1 },
            { stat: "attack", change: 1 },
            { stat: "defense", change: 1 },
          ]);
          return false;
        }
        const v = this.vol(target);
        if (foe.hp === 0 || v.cursed) return fail();
        this.hurt(side, Math.max(1, Math.floor(user.maxHp / 2)), `${userName} cut its own HP and put a curse on ${foeName}!`);
        v.cursed = true;
        this.emitVolatile(target, `${foeName} was cursed!`, "Cursed!");
        return user.hp === 0 && this.faint(side);
      }
      case "perish-song": {
        const hearing = this.slots.filter((each) => this.active(each).hp > 0 && !this.active(each).volatiles?.perish);
        if (hearing.length === 0) return fail();
        this.emit(side, "All Pokémon that heard the song will faint in three turns!", { kind: "info" });
        for (const each of hearing) {
          this.vol(each).perish = 4;
          this.emitVolatile(each, `${title(this.active(each).name)} heard the song.`);
        }
        return false;
      }
      case "spite": {
        const last = foe.lastMove;
        const index = last ? foe.moves.findIndex((each) => each.name === last.name) : -1;
        const left = index === -1 ? undefined : foe.pp?.[index];
        if (!last || index === -1 || left === null || left === undefined || left === 0) return fail();
        const cut = Math.min(4, left);
        foe.pp![index] = left - cut;
        this.emit(target, `It reduced the PP of ${foeName}'s ${title(last.name)} by ${cut}!`, { kind: "info" });
        return false;
      }
      case "mean-look":
      case "block":
      case "spider-web":
      case "octolock": {
        const v = this.vol(target);
        if (v.trapped) return fail();
        v.trapped = true;
        v.trappedBy = side;
        if (move.name === "octolock") v.octolock = true;
        this.emitVolatile(target, `${foeName} can no longer escape!`, "Trapped!");
        return false;
      }
      case "telekinesis": {
        const v = this.vol(target);
        if (v.telekinesis || v.ingrain || gravity) return fail();
        v.telekinesis = 3;
        this.emitVolatile(target, `${foeName} was hurled into the air!`);
        return false;
      }
      case "foresight":
      case "odor-sleuth":
      case "miracle-eye":
        this.vol(target).identified = move.name === "miracle-eye" ? "miracle-eye" : "foresight";
        this.emitVolatile(target, `${foeName} was identified!`);
        return false;
      case "electrify":
      case "powder": {
        if (this.moved[target]) return fail();
        if (move.name === "electrify") this.electrified[target] = true;
        else this.powdered[target] = true;
        this.emitVolatile(
          target,
          move.name === "electrify" ? `${foeName}'s moves have been electrified!` : `${foeName} is covered in powder!`
        );
        return false;
      }
      case "instruct": {
        const last = foe.lastMove;
        const pp = last ? this.ppLeft(target, last.name) : undefined;
        if (!last || NO_CALL_MOVES.has(last.name) || pp === undefined || pp === 0) return fail();
        this.emit(target, `${foeName} followed ${userName}'s instructions!`, { kind: "info" });
        const index = foe.moves.findIndex((each) => each.name === last.name);
        this.spendPP(target, index);
        return this.executeMove(target, last);
      }

      // Effects on the user
      case "ingrain":
      case "aqua-ring": {
        const v = this.vol(side);
        const key = move.name === "ingrain" ? "ingrain" : "aquaRing";
        if (v[key]) return fail();
        v[key] = true;
        if (key === "ingrain") v.magnetRise = undefined;
        this.emitVolatile(side, key === "ingrain" ? `${userName} planted its roots!` : `${userName} surrounded itself with a veil of water!`);
        return false;
      }
      case "destiny-bond": {
        if (opts.previous?.name === "destiny-bond") return fail();
        this.vol(side).destinyBond = true;
        this.emitVolatile(side, `${userName} is hoping to take its attacker down with it!`);
        return false;
      }
      case "grudge":
        this.vol(side).grudge = true;
        this.emitVolatile(side, `${userName} wants its target to bear a grudge!`);
        return false;
      case "magnet-rise": {
        const v = this.vol(side);
        if (v.magnetRise || v.ingrain || gravity) return fail();
        v.magnetRise = 5;
        this.emitVolatile(side, `${userName} levitated with electromagnetism!`);
        return false;
      }
      case "lock-on":
      case "mind-reader":
        this.vol(side).lockOn = 2;
        this.emitVolatile(side, `${userName} took aim at ${foeName}!`);
        return false;
      case "laser-focus":
        this.vol(side).laserFocus = 2;
        this.emitVolatile(side, `${userName} concentrated intensely!`);
        return false;
      case "focus-energy": {
        const v = this.vol(side);
        if ((v.critStage ?? 0) >= 2) return fail();
        v.critStage = 2;
        this.emitVolatile(side, `${userName} is getting pumped!`);
        return false;
      }
      case "imprison": {
        const v = this.vol(side);
        if (v.imprison) return fail();
        v.imprison = true;
        this.emitVolatile(side, `${userName} sealed any moves its target shares with it!`);
        return false;
      }
      case "magic-coat":
        this.magicCoat[side] = true;
        this.emit(side, `${userName} shrouded itself with Magic Coat!`, { kind: "protect", blocked: false });
        return false;
      case "snatch":
        this.snatching[side] = true;
        this.emit(side, `${userName} waits for a target to make a move!`, { kind: "info" });
        return false;

      // Healing and curing
      case "rest": {
        const terrain = this.battle.field?.terrain?.kind;
        const terrainBlocks = (terrain === "electric" || terrain === "misty") && this.grounded(side);
        if (user.status === "sleep" || user.hp === user.maxHp || terrainBlocks) return fail();
        user.status = "sleep";
        user.sleepTurns = 2;
        this.emit(side, `${userName} slept and became healthy!`, { kind: "status", status: "sleep" });
        this.heal(side, user, user.maxHp, `${userName} regained health!`);
        return false;
      }
      case "refresh": {
        const status = user.status;
        if (status !== "burn" && status !== "poison" && status !== "paralysis") return fail();
        user.status = null;
        this.emit(side, `${userName}'s status returned to normal!`, { kind: "cured", status });
        return false;
      }
      case "heal-bell":
      case "aromatherapy": {
        const sick = battleSide.team.filter((member) => member.hp > 0 && member.status);
        if (sick.length === 0) return fail();
        this.emit(side, move.name === "heal-bell" ? "A bell chimed!" : "A soothing aroma wafted through the area!", { kind: "info" });
        for (const member of sick) {
          const status = member.status!;
          member.status = null;
          if (member === user) this.emit(side, `${userName}'s status returned to normal!`, { kind: "cured", status });
        }
        return false;
      }
      case "psycho-shift": {
        const status = user.status;
        if (!status || !this.canInflict(target, foe, status, side)) return fail();
        this.inflict(target, foe, status, side);
        user.status = null;
        this.emit(side, `${userName}'s status returned to normal!`, { kind: "cured", status });
        return false;
      }
      case "lunar-blessing":
      case "take-heart": {
        const status = user.status;
        const heals = move.name === "lunar-blessing" && user.hp < user.maxHp;
        if (!status && !heals && move.name === "lunar-blessing") return fail();
        if (heals) this.heal(side, user, Math.max(1, Math.floor(user.maxHp / 4)), `${userName} regained health!`);
        if (status) {
          user.status = null;
          this.emit(side, `${userName}'s status returned to normal!`, { kind: "cured", status });
        }
        if (move.name === "take-heart") {
          this.changeStats(side, user, [
            { stat: "special-attack", change: 1 },
            { stat: "special-defense", change: 1 },
          ]);
        }
        return false;
      }
      case "wish": {
        if (battleSide.wish) return fail();
        battleSide.wish = { turns: 2, amount: Math.max(1, Math.floor(user.maxHp / 2)), from: userName, position: slotPosition(side) };
        this.emit(side, `${userName} made a wish!`, { kind: "info" });
        return false;
      }
      case "healing-wish":
      case "lunar-dance": {
        if (healthyBench(battleSide).length === 0) return fail();
        battleSide.healingWish = true;
        this.hurt(side, user.hp, `${userName} gave its life for its team!`);
        return this.faint(side);
      }
      case "revival-blessing": {
        const fainted = battleSide.team.flatMap((member, index) => (member.hp === 0 && member !== user ? [index] : []));
        if (fainted.length === 0) return fail();
        const index = opts.target !== undefined && fainted.includes(opts.target) ? opts.target : fainted[0];
        const revived = battleSide.team[index];
        revived.hp = Math.max(1, Math.floor(revived.maxHp / 2));
        revived.status = null;
        this.emit(side, `${title(revived.name)} was revived and is ready to fight again!`, { kind: "info" });
        return false;
      }

      // Stat moves the data doesn't describe
      case "victory-dance":
        this.changeStats(side, user, [
          { stat: "attack", change: 1 },
          { stat: "defense", change: 1 },
          { stat: "speed", change: 1 },
        ]);
        return false;
      case "shelter":
        this.changeStats(side, user, [{ stat: "defense", change: 2 }]);
        return false;
      case "belly-drum": {
        const cost = Math.floor(user.maxHp / 2);
        if (user.hp <= cost || stage(user, "attack") >= MAX_STAGE) return fail();
        this.hurt(side, cost, `${userName} cut its own HP and maximized its Attack!`);
        this.changeStats(side, user, [{ stat: "attack", change: MAX_STAGE * 2 }]);
        return false;
      }
      case "acupressure": {
        // It can be used on the ally in a double battle
        const who = slotSide(target) === slotSide(side) && this.active(target).hp > 0 ? target : side;
        const pressed = this.active(who);
        const room = BOOST_STATS.filter((stat) => stage(pressed, stat) < MAX_STAGE);
        if (room.length === 0) return fail();
        this.changeStats(who, pressed, [{ stat: room[this.randomIndex(room.length)], change: 2 }]);
        return false;
      }

      // Swapping and copying stats
      case "psych-up":
        user.boosts = { ...foe.boosts };
        this.vol(side).critStage = foe.volatiles?.critStage;
        this.emitVolatile(side, `${userName} copied ${foeName}'s stat changes!`);
        return false;
      case "heart-swap":
      case "power-swap":
      case "guard-swap": {
        const stats: BoostStat[] =
          move.name === "heart-swap" ? [...BOOST_STATS] : move.name === "power-swap" ? ["attack", "special-attack"] : ["defense", "special-defense"];
        for (const stat of stats) {
          const mine = user.boosts[stat];
          user.boosts[stat] = foe.boosts[stat] ?? 0;
          foe.boosts[stat] = mine ?? 0;
        }
        boostsChanged(side);
        boostsChanged(target);
        return false;
      }
      case "topsy-turvy": {
        const changed = BOOST_STATS.filter((stat) => (foe.boosts[stat] ?? 0) !== 0);
        if (changed.length === 0) return fail();
        for (const stat of changed) foe.boosts[stat] = -(foe.boosts[stat] ?? 0);
        this.emitVolatile(target, `All stat changes on ${foeName} were inverted!`);
        return false;
      }
      case "guard-split":
      case "power-split": {
        const [first, second]: (keyof BattleStats)[] = move.name === "guard-split" ? ["defense", "specialDefense"] : ["attack", "specialAttack"];
        this.backup(user);
        this.backup(foe);
        for (const stat of [first, second]) {
          const average = Math.floor((user.stats[stat] + foe.stats[stat]) / 2);
          user.stats[stat] = average;
          foe.stats[stat] = average;
        }
        this.emit(side, `${userName} shared its ${move.name === "guard-split" ? "guard" : "power"} with the target!`, { kind: "info" });
        return false;
      }
      case "speed-swap": {
        this.backup(user);
        this.backup(foe);
        [user.stats.speed, foe.stats.speed] = [foe.stats.speed, user.stats.speed];
        this.emit(side, `${userName} switched Speed with its target!`, { kind: "info" });
        return false;
      }
      case "power-trick":
      case "power-shift": {
        this.backup(user);
        [user.stats.attack, user.stats.defense] = [user.stats.defense, user.stats.attack];
        if (move.name === "power-shift") {
          [user.stats.specialAttack, user.stats.specialDefense] = [user.stats.specialDefense, user.stats.specialAttack];
        }
        this.emit(side, `${userName} switched its attacking and defending stats!`, { kind: "info" });
        return false;
      }
      case "pain-split": {
        if (!lands()) return false;
        const average = Math.floor((user.hp + foe.hp) / 2);
        for (const each of [side, target] as Slot[]) {
          const combatant = this.active(each);
          const next = Math.min(average, combatant.maxHp);
          if (next > combatant.hp) this.heal(each, combatant, next - combatant.hp, "The battlers shared their pain!");
          else if (next < combatant.hp) this.hurt(each, combatant.hp - next, "The battlers shared their pain!");
        }
        return false;
      }

      // Changing types
      case "conversion":
      case "conversion-2":
      case "reflect-type":
      case "camouflage":
      case "soak":
      case "magic-powder":
      case "trick-or-treat":
      case "forests-curse": {
        const onFoe = ["soak", "magic-powder", "trick-or-treat", "forests-curse"].includes(move.name);
        const changed = onFoe ? foe : user;
        let types: PokemonType[] | null = null;
        switch (move.name) {
          case "conversion":
            types = [user.moves[0].type];
            break;
          case "conversion-2": {
            const last = foe.lastMove;
            const resisting = last ? POKEMON_TYPES.filter((type) => effectivenessAgainst(last.type, [type]) < 1 && !user.types.includes(type)) : [];
            types = resisting.length > 0 ? [resisting[this.randomIndex(resisting.length)]] : null;
            break;
          }
          case "reflect-type":
            types = [...foe.types];
            break;
          case "camouflage":
            types = [CAMOUFLAGE_TYPES[this.battle.field?.terrain?.kind ?? "none"]];
            break;
          case "soak":
            types = ["water"];
            break;
          case "magic-powder":
            types = ["psychic"];
            break;
          case "trick-or-treat":
            types = foe.types.includes("ghost") ? null : [...foe.types, "ghost"];
            break;
          case "forests-curse":
            types = foe.types.includes("grass") ? null : [...foe.types, "grass"];
            break;
        }
        if (!types || types.join() === changed.types.join()) return fail();
        if (onFoe && !lands()) return false;
        this.backup(changed);
        changed.types = types;
        const changedSide = onFoe ? target : side;
        this.emitVolatile(changedSide, `${title(changed.name)}'s type changed to ${types.map((type) => title(type)).join("/")}!`);
        return false;
      }

      // Copying the foe
      case "transform":
        return this.transformInto(side, target) ? false : fail();
      case "mimic":
      case "sketch": {
        const last = foe.lastMove;
        const slot = user.moves.findIndex((each) => each.name === move.name);
        if (!last || slot === -1 || NO_CALL_MOVES.has(last.name) || user.moves.some((each) => each.name === last.name)) return fail();
        if (move.name === "mimic") this.backup(user);
        user.moves = user.moves.map((each, index) => (index === slot ? last : each));
        const pp = last.pp ? Math.floor((last.pp * 8) / 5) : null;
        if (user.pp) user.pp[slot] = pp;
        // Sketch is for keeps, even after switching out
        if (move.name === "sketch" && user.original) {
          user.original.moves = user.original.moves.map((each, index) => (index === slot ? last : each));
          if (user.original.pp) user.original.pp[slot] = pp;
        }
        this.emitVolatile(side, `${userName} learned ${title(last.name)}!`);
        return false;
      }

      // Switching out
      case "baton-pass":
      case "teleport":
      case "shed-tail":
      case "chilly-reception": {
        if (move.name === "chilly-reception") this.setWeather(side, "snow", true);
        if (healthyBench(battleSide).length === 0) return move.name === "chilly-reception" ? false : fail();
        if (move.name === "shed-tail") {
          const cost = Math.ceil(user.maxHp / 2);
          if (user.hp <= cost) return fail("But it does not have enough HP left to make a substitute!");
          this.hurt(side, cost, `${userName} shed its tail to create a decoy!`);
        }
        const pass = move.name === "baton-pass" ? "baton-pass" : move.name === "shed-tail" ? "shed-tail" : null;
        return this.pivot(side, opts.target, pass);
      }
      case "roar":
      case "whirlwind":
        return this.dragOut(side, target, false);
      default:
        return null;
    }
  }

  /** Wish, Aqua Ring, Ingrain, curses, binding, Octolock, countdowns, Yawn and Perish Song. Returns true when the battle ended. */
  volatileEndOfTurn(order: Slot[]): boolean {
    for (const side of order) {
      const battleSide = this.sideData(side);
      const wish = battleSide.wish;
      // A wish heals whoever is in the wisher's place
      if (!wish || (wish.position ?? 0) !== slotPosition(side)) continue;
      wish.turns -= 1;
      if (wish.turns > 0) continue;
      battleSide.wish = null;
      const combatant = this.active(side);
      if (combatant.hp > 0 && combatant.hp < combatant.maxHp) this.heal(side, combatant, wish.amount, `${wish.from}'s wish came true!`);
    }
    for (const side of order) {
      const combatant = this.active(side);
      const v = combatant.volatiles;
      if (!v || combatant.hp === 0) continue;
      const name = title(combatant.name);
      const sixteenth = Math.max(1, Math.floor(combatant.maxHp / 16));
      if (v.aquaRing && combatant.hp < combatant.maxHp) this.heal(side, combatant, sixteenth, `A veil of water restored ${name}'s HP!`);
      if (v.ingrain && combatant.hp < combatant.maxHp) this.heal(side, combatant, sixteenth, `${name} absorbed nutrients with its roots!`);
    }
    for (const side of order) {
      const combatant = this.active(side);
      const v = combatant.volatiles;
      if (!v || combatant.hp === 0) continue;
      const name = title(combatant.name);
      const quarter = Math.max(1, Math.floor(combatant.maxHp / 4));
      if (v.nightmare && combatant.status !== "sleep") v.nightmare = false;
      const guarded = this.shieldedFromIndirect(side);
      if (v.nightmare && !guarded) this.hurt(side, quarter, `${name} is locked in a nightmare!`);
      if (combatant.hp > 0 && v.cursed && !guarded) this.hurt(side, quarter, `${name} is afflicted by the curse!`);
      if (combatant.hp > 0 && v.bound) {
        const band = this.itemOf(v.bound.by ?? this.opponent(side)) === "binding-band" ? 6 : 8;
        if (!guarded) this.hurt(side, Math.max(1, Math.floor(combatant.maxHp / band)), `${name} is hurt by ${title(v.bound.move)}!`);
        v.bound.turns -= 1;
        if (v.bound.turns <= 0 && combatant.hp > 0) {
          const move = v.bound.move;
          v.bound = undefined;
          this.emitVolatile(side, `${name} was freed from ${title(move)}!`);
        }
      }
      if (combatant.hp > 0 && v.octolock) {
        this.changeStats(side, combatant, [
          { stat: "defense", change: -1 },
          { stat: "special-defense", change: -1 },
        ], true);
      }
      if (combatant.hp === 0 && this.faint(side)) return true;
    }
    for (const side of order) {
      const combatant = this.active(side);
      const v = combatant.volatiles;
      if (!v || combatant.hp === 0) continue;
      const name = title(combatant.name);
      const countDown = (key: "taunt" | "healBlock" | "magnetRise" | "telekinesis" | "lockOn" | "laserFocus" | "embargo", ended?: string) => {
        if (!v[key]) return;
        v[key] = v[key]! - 1;
        if (v[key]! > 0) return;
        v[key] = undefined;
        if (ended) this.emitVolatile(side, ended);
      };
      countDown("taunt", `${name} shook off the taunt!`);
      countDown("healBlock", `${name}'s Heal Block wore off!`);
      countDown("magnetRise", `${name}'s electromagnetism wore off!`);
      countDown("telekinesis", `${name} was freed from the telekinesis!`);
      countDown("lockOn");
      countDown("laserFocus");
      countDown("embargo", `${name} can use items again!`);
      if (v.encore) {
        v.encore.turns -= 1;
        if (v.encore.turns <= 0) {
          v.encore = undefined;
          this.emitVolatile(side, `${name}'s encore ended!`);
        }
      }
      if (v.disabled) {
        v.disabled.turns -= 1;
        if (v.disabled.turns <= 0) {
          const move = v.disabled.move;
          v.disabled = undefined;
          this.emitVolatile(side, `${name}'s ${title(move)} is no longer disabled!`);
        }
      }
      if (v.yawn) {
        v.yawn -= 1;
        if (v.yawn === 0) {
          v.yawn = undefined;
          if (this.canInflict(side, combatant, "sleep")) this.inflict(side, combatant, "sleep");
        }
      }
      if (v.perish) {
        v.perish -= 1;
        this.emitVolatile(side, `${name}'s perish count fell to ${v.perish}.`);
        if (v.perish === 0) {
          this.hurt(side, combatant.hp, `${name} fainted from Perish Song!`);
          if (this.faint(side)) return true;
        }
      }
    }
    return false;
  }

  /** The side a Pokémon in battle is on */
  /** The slot a Pokémon in battle is in (the first slot when it isn't in battle) */
  sideOf(combatant: Combatant): Slot {
    return this.slotOfCombatant(combatant) ?? 0;
  }

  slotOfCombatant(combatant: Combatant): Slot | null {
    return this.slots.find((slot) => this.active(slot) === combatant) ?? null;
  }

  /**
   * A side's working ability: none while Gastro Acid suppresses it, or while a Mold Breaker
   * on `attackerSide` uses a move against it
   */
  abilityOf(side: Slot, attackerSide?: Slot): string | null {
    const ability = activeAbility(this.battle, side);
    if (ability && attackerSide !== undefined && attackerSide !== side) {
      const attacker = activeAbility(this.battle, attackerSide);
      if (attacker && MOLD_BREAKERS.has(attacker)) return null;
    }
    return ability;
  }

  /** A side's working item: none under Magic Room, Embargo or Klutz */
  itemOf(side: Slot): string | null {
    return activeItem(this.battle, side);
  }

  /** Shows an ability taking effect, like the games' ability banner */
  announceAbility(side: Slot, text: string) {
    const ability = this.active(side).ability ?? "";
    this.emit(side, text, { kind: "ability", ability });
  }

  /** Uses up a side's item (eaten berry, popped balloon), so Recycle and Harvest can bring it back */
  consumeItem(side: Slot, text: string) {
    const combatant = this.active(side);
    const item = combatant.item;
    if (!item) return;
    this.emit(side, text, { kind: "item", item });
    combatant.consumedItem = item;
    this.loseItem(side);
    this.symbiosis(side);
  }

  /** Symbiosis hands the ally its item when the ally uses up its own */
  symbiosis(side: Slot) {
    const ally = this.livingAlly(side);
    if (ally === null || this.abilityOf(ally) !== "symbiosis") return;
    const giver = this.active(ally);
    const taker = this.active(side);
    if (!giver.item || taker.item || taker.hp === 0) return;
    const item = giver.item;
    taker.item = item;
    this.loseItem(ally);
    this.announceAbility(ally, `${title(giver.name)} shared its ${itemName(item)} with ${title(taker.name)}!`);
  }

  /** Aroma Veil on the target or its ally blocks Taunt, Torment, Encore, Disable, Heal Block and love */
  aromaVeiled(target: Slot, attackerSide: Slot): boolean {
    const ally = this.livingAlly(target);
    return [target, ...(ally === null ? [] : [ally])].some((each) => this.abilityOf(each, attackerSide) === "aroma-veil");
  }

  /** Takes a side's item away (knocked off, stolen, used up) */
  loseItem(side: Slot) {
    const combatant = this.active(side);
    combatant.item = null;
    if (this.abilityOf(side) === "unburden") this.vol(side).unburden = true;
  }

  /** Whether a side's item can be taken or swapped: Sticky Hold keeps it */
  itemRemovable(side: Slot, attackerSide: Slot): boolean {
    return Boolean(this.active(side).item) && this.abilityOf(side, attackerSide) !== "sticky-hold";
  }

  /** Abilities and items that keep off sandstorm and hail damage */
  weatherProof(side: Slot, weather: Weather): boolean {
    const ability = this.abilityOf(side);
    if (ability === "magic-guard" || ability === "overcoat" || this.itemOf(side) === "safety-goggles") return true;
    if (weather === "sand") return ability === "sand-veil" || ability === "sand-rush" || ability === "sand-force";
    return ability === "ice-body" || ability === "snow-cloak";
  }

  /** Magic Guard stops damage that doesn't come from attacks */
  shieldedFromIndirect(side: Slot): boolean {
    return this.abilityOf(side) === "magic-guard";
  }

  /** The foe's Unnerve keeps berries from being eaten */
  canEatBerries(side: Slot): boolean {
    return !this.livingFoes(side).some((foe) => this.abilityOf(foe) === "unnerve");
  }

  /** Effects of a berry eaten by a side's Pokémon. Returns whether it did anything. */
  eatBerry(side: Slot, berry: string): boolean {
    const combatant = this.active(side);
    const name = title(combatant.name);
    if (berry === "sitrus-berry") {
      this.heal(side, combatant, Math.max(1, Math.floor(combatant.maxHp / 4)), `${name} restored HP with its Sitrus Berry!`);
      return true;
    }
    if (berry === "oran-berry") {
      this.heal(side, combatant, 10, `${name} restored HP with its Oran Berry!`);
      return true;
    }
    if (BIG_HEAL_BERRIES.has(berry)) {
      this.heal(side, combatant, Math.max(1, Math.floor(combatant.maxHp / 3)), `${name} restored HP with its ${itemName(berry)}!`);
      return true;
    }
    const pinch = PINCH_BERRIES[berry];
    if (pinch) {
      this.changeStats(side, combatant, [{ stat: pinch, change: 1 }]);
      return true;
    }
    const cures = CURE_BERRIES[berry];
    if (cures) {
      let cured = false;
      if (combatant.status && (cures === "any" || cures === combatant.status)) {
        const status = combatant.status;
        combatant.status = null;
        this.emit(side, `${name}'s ${itemName(berry)} cured its ${status}!`, { kind: "cured", status });
        cured = true;
      }
      if (combatant.volatiles?.confusion && (cures === "any" || cures === "confusion")) {
        combatant.volatiles.confusion = undefined;
        this.emitVolatile(side, `${name}'s ${itemName(berry)} snapped it out of confusion!`);
        cured = true;
      }
      return cured;
    }
    return false;
  }

  /** Berries that trigger at low HP. Call after a side loses HP. */
  checkHpItems(side: Slot) {
    const combatant = this.active(side);
    const item = this.itemOf(side);
    if (!item || combatant.hp === 0 || !isBerry(item) || !this.canEatBerries(side)) return;
    const ratio = combatant.hp / combatant.maxHp;
    const half = (item === "sitrus-berry" || item === "oran-berry") && ratio <= 0.5;
    const quarter = (BIG_HEAL_BERRIES.has(item) || item in PINCH_BERRIES) && ratio <= 0.25;
    if (!half && !quarter) return;
    this.consumeItem(side, `${title(combatant.name)} ate its ${itemName(item)}!`);
    this.eatBerry(side, item);
  }

  /** Status-curing berries and Mental Herb. Call after a side gets a status condition or volatile effect. */
  checkStatusItems(side: Slot) {
    const combatant = this.active(side);
    const item = this.itemOf(side);
    if (!item || combatant.hp === 0) return;
    const cures = CURE_BERRIES[item];
    if (cures && this.canEatBerries(side)) {
      const statusMatch = combatant.status && (cures === "any" || cures === combatant.status);
      const confusionMatch = combatant.volatiles?.confusion && (cures === "any" || cures === "confusion");
      if (statusMatch || confusionMatch) {
        this.consumeItem(side, `${title(combatant.name)} ate its ${itemName(item)}!`);
        this.eatBerry(side, item);
      }
      return;
    }
    const v = combatant.volatiles;
    if (item === "mental-herb" && v && (v.infatuated || v.taunt || v.encore || v.torment || v.disabled || v.healBlock)) {
      this.consumeItem(side, `${title(combatant.name)} used its Mental Herb to come back to its senses!`);
      v.infatuated = false;
      v.taunt = undefined;
      v.encore = undefined;
      v.torment = false;
      v.disabled = undefined;
      v.healBlock = undefined;
      this.emitVolatile(side, `${title(combatant.name)} is back to normal!`);
    }
  }

  setTerrain(side: Slot, terrain: Terrain, quiet = false) {
    if (this.field.terrain?.kind === terrain) {
      if (!quiet) this.emit(side, "But it failed!", { kind: "fail" });
      return;
    }
    const turns = this.itemOf(side) === "terrain-extender" ? 8 : TERRAIN_TURNS;
    this.field.terrain = { kind: terrain, turnsLeft: turns };
    this.emitField(side, TERRAIN_STARTED[terrain]);
  }

  /** Transform: copy the foe's types, stats, stat changes, moves, ability and look */
  transformInto(side: Slot, target: Slot): boolean {
    const user = this.active(side);
    const foe = this.active(target);
    if ((foe.substituteHp ?? 0) > 0 || user.volatiles?.transformed || foe.volatiles?.transformed || foe.hp === 0) return false;
    this.backup(user);
    user.types = [...foe.types];
    user.stats = { ...foe.stats, hp: user.stats.hp };
    user.boosts = { ...foe.boosts };
    user.moves = foe.moves.map((each) => ({ ...each }));
    user.pp = foe.moves.map((each) => (each.pp ? 5 : null));
    user.spriteUrl = foe.spriteUrl;
    user.ability = foe.ability;
    this.vol(side).transformed = true;
    this.emitVolatile(side, `${title(user.name)} transformed into ${title(foe.name)}!`);
    return true;
  }

  /** Abilities and items that act when a Pokémon comes into battle */
  switchInEffects(side: Slot) {
    const combatant = this.active(side);
    if (combatant.hp === 0) return;
    const name = title(combatant.name);
    const foes = this.livingFoes(side);
    if (this.itemOf(side) === "air-balloon") {
      this.emit(side, `${name} floats in the air with its Air Balloon!`, { kind: "item", item: "air-balloon" });
    }
    this.checkCommander(side);
    const ability = this.abilityOf(side);
    if (!ability) return;
    const weather = ABILITY_WEATHER[ability];
    if (weather) {
      this.announceAbility(side, `${name}'s ${abilityName(ability)}!`);
      this.setWeather(side, weather, true);
      return;
    }
    const terrain = ABILITY_TERRAIN[ability];
    if (terrain) {
      this.announceAbility(side, `${name}'s ${abilityName(ability)}!`);
      this.setTerrain(side, terrain, true);
      return;
    }
    const ally = this.livingAlly(side);
    switch (ability) {
      case "intimidate": {
        if (foes.length === 0) return;
        this.announceAbility(side, `${name}'s Intimidate!`);
        for (const foeSide of foes) {
          const foe = this.active(foeSide);
          const foeAbility = this.abilityOf(foeSide);
          if (foeAbility && ["own-tempo", "oblivious", "inner-focus", "scrappy"].includes(foeAbility)) {
            this.announceAbility(foeSide, `${title(foe.name)}'s ${abilityName(foeAbility)} kept its Attack from dropping!`);
          } else {
            this.changeStats(foeSide, foe, [{ stat: "attack", change: -1 }], true);
            if (foeAbility === "rattled") this.changeStats(foeSide, foe, [{ stat: "speed", change: 1 }]);
          }
          if (this.itemOf(foeSide) === "adrenaline-orb" && stage(foe, "speed") < MAX_STAGE) {
            this.consumeItem(foeSide, `${title(foe.name)}'s Adrenaline Orb activated!`);
            this.changeStats(foeSide, foe, [{ stat: "speed", change: 1 }]);
          }
        }
        return;
      }
      case "download": {
        if (foes.length === 0) return;
        // Against two foes it compares their combined defenses
        let defense = 0;
        let specialDefense = 0;
        for (const foeSide of foes) {
          const foe = this.active(foeSide);
          defense += foe.stats.defense * stageMultiplier(stage(foe, "defense"));
          specialDefense += foe.stats.specialDefense * stageMultiplier(stage(foe, "special-defense"));
        }
        this.announceAbility(side, `${name}'s Download!`);
        this.changeStats(side, combatant, [{ stat: defense < specialDefense ? "attack" : "special-attack", change: 1 }]);
        return;
      }
      case "intrepid-sword":
      case "dauntless-shield":
        this.announceAbility(side, `${name}'s ${abilityName(ability)}!`);
        this.changeStats(side, combatant, [{ stat: ability === "intrepid-sword" ? "attack" : "defense", change: 1 }]);
        return;
      case "pressure":
        this.announceAbility(side, `${name} is exerting its pressure!`);
        return;
      case "mold-breaker":
      case "teravolt":
      case "turboblaze":
        this.announceAbility(side, `${name} breaks the mold!`);
        return;
      case "unnerve":
        this.announceAbility(side, `${this.team(this.opponent(side))} is too nervous to eat Berries!`);
        return;
      case "cloud-nine":
      case "air-lock":
        this.announceAbility(side, "The effects of the weather disappeared.");
        return;
      case "frisk":
        for (const foeSide of foes) {
          const foe = this.active(foeSide);
          if (foe.item) this.announceAbility(side, `${name} frisked ${title(foe.name)} and found its ${itemName(foe.item)}!`);
        }
        return;
      case "trace": {
        // Copies a random foe's ability it can copy
        const options = foes.map((each) => ({ each, traced: this.abilityOf(each) })).filter(({ traced }) => traced && !UNCOPYABLE_ABILITIES.has(traced));
        if (options.length === 0) return;
        const { each, traced } = options[this.randomIndex(options.length)];
        this.backup(combatant);
        combatant.ability = traced;
        this.announceAbility(side, `${name} traced ${title(this.active(each).name)}'s ${abilityName(traced!)}!`);
        this.switchInEffects(side);
        return;
      }
      case "imposter":
        if (this.transformInto(side, this.opponent(side))) this.announceAbility(side, `${name}'s Imposter!`);
        return;
      // Abilities that work with the ally
      case "curious-medicine": {
        if (ally === null || Object.values(this.active(ally).boosts).every((each) => !each)) return;
        this.active(ally).boosts = {};
        this.announceAbility(side, `${name}'s Curious Medicine!`);
        this.emitVolatile(ally, `${title(this.active(ally).name)}'s stat changes were removed!`);
        return;
      }
      case "costar": {
        if (ally === null) return;
        const partner = this.active(ally);
        combatant.boosts = { ...partner.boosts };
        if (partner.volatiles?.critStage) this.vol(side).critStage = partner.volatiles.critStage;
        this.announceAbility(side, `${name}'s Costar!`);
        this.emitVolatile(side, `${name} copied ${title(partner.name)}'s stat changes!`);
        return;
      }
      case "hospitality": {
        const partner = ally === null ? null : this.active(ally);
        if (ally === null || !partner || partner.hp === partner.maxHp) return;
        this.announceAbility(side, `${name}'s Hospitality!`);
        this.heal(ally, partner, Math.max(1, Math.floor(partner.maxHp / 4)), `${title(partner.name)} drank down all the matcha that ${name} made!`);
        return;
      }
      case "pastel-veil": {
        for (const each of ally === null ? [side] : [side, ally]) {
          const member = this.active(each);
          if (member.status !== "poison") continue;
          member.status = null;
          this.announceAbility(side, `${name}'s Pastel Veil!`);
          this.emit(each, `${title(member.name)} was cured of its poisoning!`, { kind: "cured", status: "poison" });
        }
        return;
      }
    }
  }

  /** Commander: a Tatsugiri hides inside its Dondozo ally, which gets much stronger */
  checkCommander(side: Slot) {
    const ally = this.livingAlly(side);
    if (ally === null) return;
    const pair = [side, ally];
    const tatsugiri = pair.find((each) => this.active(each).name.startsWith("tatsugiri") && this.abilityOf(each) === "commander");
    const dondozo = pair.find((each) => this.active(each).name.startsWith("dondozo"));
    if (tatsugiri === undefined || dondozo === undefined) return;
    const hiding = this.active(tatsugiri);
    const host = this.active(dondozo);
    if (hiding.volatiles?.commanding || host.volatiles?.commanded) return;
    this.vol(tatsugiri).commanding = true;
    this.vol(dondozo).commanded = true;
    this.announceAbility(tatsugiri, `${title(hiding.name)}'s Commander!`);
    this.emitVolatile(tatsugiri, `${title(hiding.name)} went inside ${title(host.name)}'s mouth!`);
    this.changeStats(dondozo, host, ["attack", "defense", "special-attack", "special-defense", "speed"].map((stat) => ({ stat: stat as BoostStat, change: 2 })));
  }

  /** The leads' abilities and items take effect before the first turn */
  battleStart(order: Slot[]) {
    for (const side of order) this.switchInEffects(side);
    this.processEjectPacks();
  }

  /** Regenerator and Natural Cure as a Pokémon switches out */
  switchOutEffects(side: Slot) {
    const combatant = this.active(side);
    if (combatant.hp === 0) return;
    const ability = this.abilityOf(side);
    if (ability === "regenerator" && combatant.hp < combatant.maxHp && !combatant.volatiles?.healBlock) {
      this.heal(side, combatant, Math.floor(combatant.maxHp / 3), `${title(combatant.name)} regenerated some HP!`);
    }
    if (ability === "natural-cure" && combatant.status) {
      const status = combatant.status;
      combatant.status = null;
      this.emit(side, `${title(combatant.name)}'s status was cured as it switched out!`, { kind: "cured", status });
    }
  }

  /**
   * Abilities and Pokémon traits that stop a move aimed at them: absorbing it, being immune to it, or
   * blocking priority. Returns true when the move is stopped.
   */
  blockedByAbility(side: Slot, target: Slot, move: MoveInfo, prankster: boolean): boolean {
    const foe = this.active(target);
    const foeName = title(foe.name);
    // Prankster status moves don't work on Dark types
    if (prankster && move.category === "status" && foe.types.includes("dark") && slotSide(side) !== slotSide(target)) {
      this.emit(target, `It doesn't affect ${foeName}…`, { kind: "immune" });
      return true;
    }
    if (POWDER_MOVES.has(move.name) && (foe.types.includes("grass") || this.itemOf(target) === "safety-goggles")) {
      this.emit(target, `It doesn't affect ${foeName}…`, { kind: "immune" });
      return true;
    }
    // Queenly Majesty, Dazzling and Armor Tail also guard the ally from foes' priority moves
    const fromFoe = slotSide(side) !== slotSide(target);
    const ally = this.livingAlly(target);
    const guards = [target, ...(ally === null ? [] : [ally])].find((each) =>
      ["queenly-majesty", "dazzling", "armor-tail"].includes(this.abilityOf(each, side) ?? "")
    );
    if (fromFoe && guards !== undefined && this.priorityOf(side, move) > 0) {
      const guardAbility = this.abilityOf(guards, side)!;
      this.announceAbility(guards, `${title(this.active(guards).name)}'s ${abilityName(guardAbility)} blocks the priority move!`);
      return true;
    }
    const ability = this.abilityOf(target, side);
    if (!ability) return false;
    const announce = (text: string) => {
      this.announceAbility(target, text);
      return true;
    };
    const absorbs = ABSORB_ABILITIES[ability];
    if (absorbs && move.type === absorbs) {
      const heal = (fraction: number) => {
        if (foe.hp === foe.maxHp) this.announceAbility(target, `${foeName}'s ${abilityName(ability)} made the move useless!`);
        else this.heal(target, foe, Math.max(1, Math.floor(foe.maxHp * fraction)), `${foeName}'s ${abilityName(ability)} restored its HP!`);
      };
      switch (ability) {
        case "volt-absorb":
        case "water-absorb":
        case "dry-skin":
        case "earth-eater":
          heal(1 / 4);
          return true;
        case "storm-drain":
        case "lightning-rod":
          this.announceAbility(target, `${foeName}'s ${abilityName(ability)} took the attack!`);
          this.changeStats(target, foe, [{ stat: "special-attack", change: 1 }]);
          return true;
        case "motor-drive":
          this.announceAbility(target, `${foeName}'s Motor Drive took the attack!`);
          this.changeStats(target, foe, [{ stat: "speed", change: 1 }]);
          return true;
        case "sap-sipper":
          this.announceAbility(target, `${foeName}'s Sap Sipper took the attack!`);
          this.changeStats(target, foe, [{ stat: "attack", change: 1 }]);
          return true;
        case "well-baked-body":
          this.announceAbility(target, `${foeName}'s Well-Baked Body took the attack!`);
          this.changeStats(target, foe, [{ stat: "defense", change: 2 }]);
          return true;
        case "flash-fire":
          this.vol(target).flashFire = true;
          return announce(`${foeName}'s Flash Fire raised the power of its Fire moves!`);
      }
    }
    if (ability === "soundproof" && SOUND_MOVES.has(move.name)) return announce(`${foeName}'s Soundproof blocks the move!`);
    if (ability === "bulletproof" && BALL_MOVES.has(move.name)) return announce(`${foeName}'s Bulletproof blocks the move!`);
    if (ability === "overcoat" && POWDER_MOVES.has(move.name)) return announce(`${foeName}'s Overcoat blocks the move!`);
    if (ability === "good-as-gold" && move.category === "status") return announce(`${foeName}'s Good as Gold blocks the move!`);
    // Telepathy dodges its ally's attacks
    if (ability === "telepathy" && !fromFoe && move.category !== "status") return announce(`${foeName} avoids attacks by its ally Pokémon!`);
    if (ability === "sturdy" && SPECIAL_DAMAGE[move.name]?.kind === "ohko") return announce(`${foeName} held its ground with Sturdy!`);
    if (ability === "wonder-guard" && move.category !== "status" && move.name !== "struggle" && this.effectiveness(move, foe, side) <= 1) {
      return announce(`${foeName}'s Wonder Guard blocks the move!`);
    }
    return false;
  }

  /** A move's priority, with Prankster, Gale Wings and Triage */
  priorityOf(side: Slot, move: MoveInfo): number {
    return effectivePriority(this.battle, side, move);
  }

  /** Added-effect chance after Serene Grace, Sheer Force, Shield Dust and Covert Cloak (0 means none) */
  secondaryChance(side: Slot, target: Slot, percent: number, onTarget: boolean): number {
    if (this.abilityOf(side) === "sheer-force") return 0;
    if (onTarget && (this.abilityOf(target, side) === "shield-dust" || this.itemOf(target) === "covert-cloak")) return 0;
    return this.abilityOf(side) === "serene-grace" ? percent * 2 : percent;
  }

  /** Reactions to a hit: contact abilities, Rocky Helmet, Weakness Policy, Stamina and the like */
  afterHit(side: Slot, target: Slot, move: MoveInfo, hit: { critical: boolean; effectiveness: number; hpBefore: number }) {
    const attacker = this.active(side);
    const defender = this.active(target);
    const attackerName = title(attacker.name);
    const defenderName = title(defender.name);
    const ability = this.abilityOf(target);
    const raise = (changes: StatChange[]) => this.changeStats(target, defender, changes);

    if (defender.hp > 0) {
      if (hit.critical && ability === "anger-point") {
        this.announceAbility(target, `${defenderName}'s Anger Point maxed its Attack!`);
        raise([{ stat: "attack", change: MAX_STAGE * 2 }]);
      }
      if (ability === "stamina") raise([{ stat: "defense", change: 1 }]);
      if (ability === "weak-armor" && move.category === "physical") raise([{ stat: "defense", change: -1 }, { stat: "speed", change: 2 }]);
      if (ability === "justified" && move.type === "dark") raise([{ stat: "attack", change: 1 }]);
      if (ability === "rattled" && ["bug", "ghost", "dark"].includes(move.type)) raise([{ stat: "speed", change: 1 }]);
      if (ability === "water-compaction" && move.type === "water") raise([{ stat: "defense", change: 2 }]);
      if (ability === "thermal-exchange" && move.type === "fire") raise([{ stat: "attack", change: 1 }]);
      if (ability === "steam-engine" && (move.type === "fire" || move.type === "water")) raise([{ stat: "speed", change: MAX_STAGE * 2 }]);
      if (ability === "berserk" && hit.hpBefore > defender.maxHp / 2 && defender.hp <= defender.maxHp / 2) {
        raise([{ stat: "special-attack", change: 1 }]);
      }
      if (this.itemOf(target) === "weakness-policy" && hit.effectiveness > 1) {
        this.consumeItem(target, `${defenderName}'s Weakness Policy activated!`);
        raise([{ stat: "attack", change: 2 }, { stat: "special-attack", change: 2 }]);
      }
      this.checkHpItems(target);
    }

    // Contact: physical moves count as contact here
    const contact = move.category === "physical" && this.itemOf(side) !== "protective-pads";
    if (!contact || attacker.hp === 0) return;
    const sharp = (fraction: number, text: string) => {
      if (attacker.hp === 0 || this.shieldedFromIndirect(side)) return;
      this.hurt(side, Math.max(1, Math.floor(attacker.maxHp * fraction)), text);
    };
    if (ability === "rough-skin" || ability === "iron-barbs") sharp(1 / 8, `${attackerName} was hurt by ${defenderName}'s ${abilityName(ability)}!`);
    if (this.itemOf(target) === "rocky-helmet") sharp(1 / 6, `${attackerName} was hurt by the Rocky Helmet!`);
    if (defender.hp === 0 && ability === "aftermath") sharp(1 / 4, `${attackerName} was caught in the aftermath!`);
    const statusFromContact: Record<string, StatusCondition> = { static: "paralysis", "flame-body": "burn", "poison-point": "poison" };
    const contactStatus = ability ? statusFromContact[ability] : undefined;
    if (contactStatus && attacker.hp > 0 && this.random() < 0.3 && this.canInflict(side, attacker, contactStatus)) {
      this.announceAbility(target, `${defenderName}'s ${abilityName(ability!)}!`);
      this.inflict(side, attacker, contactStatus);
    }
    if (ability === "effect-spore" && attacker.hp > 0 && !attacker.types.includes("grass") && this.abilityOf(side) !== "overcoat" && this.itemOf(side) !== "safety-goggles") {
      const roll = this.random();
      const status: StatusCondition | null = roll < 0.09 ? "poison" : roll < 0.19 ? "paralysis" : roll < 0.3 ? "sleep" : null;
      if (status && this.canInflict(side, attacker, status)) {
        this.announceAbility(target, `${defenderName}'s Effect Spore!`);
        this.inflict(side, attacker, status);
      }
    }
    if (ability === "cute-charm" && attacker.hp > 0 && attacker.gender && defender.gender && attacker.gender !== defender.gender && this.random() < 0.3) {
      const v = this.vol(side);
      if (!v.infatuated && this.abilityOf(side) !== "oblivious" && !this.aromaVeiled(side, target)) {
        v.infatuated = true;
        v.infatuatedBy = target;
        this.emitVolatile(side, `${defenderName}'s Cute Charm made ${attackerName} fall in love!`, "In love!");
        this.checkStatusItems(side);
      }
    }
    if ((ability === "gooey" || ability === "tangling-hair") && attacker.hp > 0) {
      this.announceAbility(target, `${defenderName}'s ${abilityName(ability)}!`);
      this.changeStats(side, attacker, [{ stat: "speed", change: -1 }], true);
    }
    if (this.abilityOf(side) === "poison-touch" && defender.hp > 0 && this.random() < 0.3 && this.canInflict(target, defender, "poison")) {
      this.announceAbility(side, `${attackerName}'s Poison Touch!`);
      this.inflict(target, defender, "poison", side);
    }
  }

  /** Moxie and Beast Boost after knocking out a foe */
  afterKnockOut(side: Slot) {
    const combatant = this.active(side);
    if (combatant.hp === 0) return;
    const ability = this.abilityOf(side);
    if (ability === "moxie" || ability === "chilling-neigh") {
      this.announceAbility(side, `${title(combatant.name)}'s ${abilityName(ability)}!`);
      this.changeStats(side, combatant, [{ stat: "attack", change: 1 }]);
    } else if (ability === "grim-neigh") {
      this.announceAbility(side, `${title(combatant.name)}'s Grim Neigh!`);
      this.changeStats(side, combatant, [{ stat: "special-attack", change: 1 }]);
    } else if (ability === "beast-boost") {
      const stats: [BoostStat, number][] = [
        ["attack", combatant.stats.attack],
        ["defense", combatant.stats.defense],
        ["special-attack", combatant.stats.specialAttack],
        ["special-defense", combatant.stats.specialDefense],
        ["speed", combatant.stats.speed],
      ];
      const [best] = stats.reduce((top, each) => (each[1] > top[1] ? each : top));
      this.announceAbility(side, `${title(combatant.name)}'s Beast Boost!`);
      this.changeStats(side, combatant, [{ stat: best, change: 1 }]);
    }
  }

  /** Red Card and Eject Button after their holder is hit. Returns true when the battle ended. */
  ejectAfterHit(side: Slot, target: Slot): boolean {
    const attacker = this.active(side);
    const defender = this.active(target);
    if (defender.hp === 0 || attacker.hp === 0) return false;
    const item = this.itemOf(target);
    if (item === "red-card" && healthyBench(this.sideData(side)).length > 0) {
      this.consumeItem(target, `${title(defender.name)} held up its Red Card against ${title(attacker.name)}!`);
      return this.dragOut(target, side, true);
    }
    if (item === "eject-button" && healthyBench(this.sideData(target)).length > 0) {
      this.consumeItem(target, `${title(defender.name)} is switched out with the Eject Button!`);
      this.fainted[target] = true;
      return this.pivot(target, undefined, null);
    }
    return false;
  }

  /** Item-handling moves after they hit: Knock Off, Thief, Covet, Bug Bite, Pluck, Incinerate */
  takeItemAfterHit(side: Slot, target: Slot, move: MoveInfo) {
    const attacker = this.active(side);
    const defender = this.active(target);
    const item = defender.item;
    if (!item) return;
    const attackerName = title(attacker.name);
    const defenderName = title(defender.name);
    switch (move.name) {
      case "knock-off":
        if (!this.itemRemovable(target, side)) return;
        this.emit(target, `${attackerName} knocked off ${defenderName}'s ${itemName(item)}!`, { kind: "item", item });
        this.loseItem(target);
        return;
      case "thief":
      case "covet":
        if (attacker.item || attacker.hp === 0 || !this.itemRemovable(target, side)) return;
        this.emit(side, `${attackerName} stole ${defenderName}'s ${itemName(item)}!`, { kind: "item", item });
        this.loseItem(target);
        attacker.item = item;
        return;
      case "bug-bite":
      case "pluck":
        if (!isBerry(item) || attacker.hp === 0 || this.abilityOf(target, side) === "sticky-hold") return;
        this.emit(side, `${attackerName} stole and ate ${defenderName}'s ${itemName(item)}!`, { kind: "item", item });
        this.loseItem(target);
        this.eatBerry(side, item);
        return;
      case "incinerate":
        if (!isBerry(item)) return;
        this.emit(target, `${defenderName}'s ${itemName(item)} was burned up!`, { kind: "item", item });
        this.loseItem(target);
        return;
    }
  }

  /** Status moves that move items or abilities around. Returns null when the move isn't one of them. */
  itemAbilityMove(side: Slot, target: Slot, move: MoveInfo): boolean | null {
    const user = this.active(side);
    const foe = this.active(target);
    const userName = title(user.name);
    const foeName = title(foe.name);
    const fail = () => {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    };
    const copyable = (ability: string | null | undefined): ability is string => Boolean(ability) && !UNCOPYABLE_ABILITIES.has(ability!);
    // Ability Shield keeps its holder's ability from being changed or suppressed
    const shielded = (slot: Slot) => this.itemOf(slot) === "ability-shield";
    switch (move.name) {
      case "trick":
      case "switcheroo": {
        if ((!user.item && !foe.item) || this.abilityOf(target, side) === "sticky-hold") return fail();
        [user.item, foe.item] = [foe.item ?? null, user.item ?? null];
        if (user.volatiles) user.volatiles.choiceLock = undefined;
        if (foe.volatiles) foe.volatiles.choiceLock = undefined;
        this.emit(side, `${userName} switched items with its target!`, { kind: "item", item: user.item ?? foe.item ?? "" });
        return false;
      }
      case "bestow":
        if (!user.item || foe.item) return fail();
        foe.item = user.item;
        this.emit(target, `${foeName} received ${itemName(user.item)} from ${userName}!`, { kind: "item", item: user.item });
        this.loseItem(side);
        return false;
      case "recycle":
        if (user.item || !user.consumedItem) return fail();
        user.item = user.consumedItem;
        user.consumedItem = null;
        this.emit(side, `${userName} found one ${itemName(user.item)}!`, { kind: "item", item: user.item });
        return false;
      case "corrosive-gas":
        if (!this.itemRemovable(target, side)) return fail();
        this.emit(target, `${userName} corroded ${foeName}'s ${itemName(foe.item!)}!`, { kind: "item", item: foe.item! });
        this.loseItem(target);
        return false;
      case "embargo": {
        const v = this.vol(target);
        if (v.embargo) return fail();
        v.embargo = 5;
        this.emitVolatile(target, `${foeName} can't use items anymore!`);
        return false;
      }
      case "teatime": {
        const eaters = this.slots.filter((each) => isBerry(this.active(each).item) && this.active(each).hp > 0);
        if (eaters.length === 0) return fail();
        for (const each of eaters) {
          const berry = this.active(each).item!;
          this.consumeItem(each, `${title(this.active(each).name)} ate its ${itemName(berry)}!`);
          this.eatBerry(each, berry);
        }
        return false;
      }
      case "skill-swap": {
        if (!copyable(user.ability) || !copyable(foe.ability) || shielded(side) || shielded(target)) return fail();
        this.backup(user);
        this.backup(foe);
        [user.ability, foe.ability] = [foe.ability, user.ability];
        this.announceAbility(side, `${userName} swapped Abilities with its target!`);
        this.switchInEffects(side);
        this.switchInEffects(target);
        return false;
      }
      case "role-play":
      case "doodle":
        if (!copyable(foe.ability) || foe.ability === user.ability) return fail();
        this.backup(user);
        user.ability = foe.ability;
        this.announceAbility(side, `${userName} copied ${foeName}'s ${abilityName(foe.ability)}!`);
        this.switchInEffects(side);
        return false;
      case "worry-seed":
      case "simple-beam":
      case "entrainment": {
        const next = move.name === "worry-seed" ? "insomnia" : move.name === "simple-beam" ? "simple" : user.ability;
        if (!copyable(next) || !copyable(foe.ability) || foe.ability === next || foe.ability === "truant" || shielded(target)) return fail();
        this.backup(foe);
        foe.ability = next;
        this.announceAbility(target, `${foeName} acquired ${abilityName(next)}!`);
        if (next === "insomnia" && foe.status === "sleep") {
          foe.status = null;
          this.emit(target, `${foeName} woke up!`, { kind: "cured", status: "sleep" });
        }
        return false;
      }
      case "gastro-acid": {
        const v = this.vol(target);
        if (v.abilitySuppressed || !foe.ability || shielded(target)) return fail();
        v.abilitySuppressed = true;
        this.emitVolatile(target, `${foeName}'s Ability was suppressed!`);
        return false;
      }
      default:
        return null;
    }
  }

  /** End-of-turn abilities and items: Leftovers, Speed Boost, Rain Dish, Toxic Orb… Returns true when the battle ended. */
  abilityItemEndOfTurn(order: Slot[]): boolean {
    for (const side of order) {
      const combatant = this.active(side);
      if (combatant.hp === 0) continue;
      const name = title(combatant.name);
      const ability = this.abilityOf(side);
      const weather = this.weather;
      const sixteenth = Math.max(1, Math.floor(combatant.maxHp / 16));
      const eighth = Math.max(1, Math.floor(combatant.maxHp / 8));
      const hurtSelf = (amount: number, text: string) => {
        if (!this.shieldedFromIndirect(side)) this.hurt(side, amount, text);
      };

      if (ability === "rain-dish" && weather === "rain" && combatant.hp < combatant.maxHp) this.heal(side, combatant, sixteenth, `${name}'s Rain Dish restored its HP!`);
      if (ability === "ice-body" && (weather === "hail" || weather === "snow") && combatant.hp < combatant.maxHp) {
        this.heal(side, combatant, sixteenth, `${name}'s Ice Body restored its HP!`);
      }
      if (ability === "dry-skin" && weather === "rain" && combatant.hp < combatant.maxHp) this.heal(side, combatant, eighth, `${name}'s Dry Skin restored its HP!`);
      if ((ability === "dry-skin" || ability === "solar-power") && weather === "sun") hurtSelf(eighth, `${name} was hurt by its ${abilityName(ability)}!`);
      if (combatant.hp > 0 && combatant.status && (ability === "hydration" && weather === "rain" || ability === "shed-skin" && this.random() < 0.3)) {
        const status = combatant.status;
        combatant.status = null;
        this.emit(side, `${name}'s ${abilityName(ability!)} cured its ${status}!`, { kind: "cured", status });
      }
      if (ability === "bad-dreams") {
        for (const foeSide of this.livingFoes(side)) {
          const foe = this.active(foeSide);
          if (foe.status !== "sleep" || this.shieldedFromIndirect(foeSide)) continue;
          this.hurt(foeSide, Math.max(1, Math.floor(foe.maxHp / 8)), `${title(foe.name)} is tormented by Bad Dreams!`);
          if (foe.hp === 0 && this.faint(foeSide)) return true;
        }
      }
      // Healer may cure the ally's status condition
      const ally = this.livingAlly(side);
      const partner = ally === null ? null : this.active(ally);
      if (ability === "healer" && ally !== null && partner?.status && this.random() < 0.3) {
        const status = partner.status;
        partner.status = null;
        this.announceAbility(side, `${name}'s Healer!`);
        this.emit(ally, `${title(partner.name)}'s ${status} was cured!`, { kind: "cured", status });
      }

      const item = this.itemOf(side);
      if (combatant.hp > 0 && item === "leftovers" && combatant.hp < combatant.maxHp) this.heal(side, combatant, sixteenth, `${name} restored a little HP using its Leftovers!`);
      if (combatant.hp > 0 && item === "black-sludge") {
        if (combatant.types.includes("poison")) {
          if (combatant.hp < combatant.maxHp) this.heal(side, combatant, sixteenth, `${name} restored a little HP using its Black Sludge!`);
        } else hurtSelf(eighth, `${name} was hurt by its Black Sludge!`);
      }
      if (combatant.hp > 0 && item === "toxic-orb" && this.canInflict(side, combatant, "poison", side)) {
        this.emit(side, `${name}'s Toxic Orb activated!`, { kind: "item", item });
        this.inflict(side, combatant, "poison");
      }
      if (combatant.hp > 0 && item === "flame-orb" && this.canInflict(side, combatant, "burn", side)) {
        this.emit(side, `${name}'s Flame Orb activated!`, { kind: "item", item });
        this.inflict(side, combatant, "burn");
      }
      if (combatant.hp > 0 && ability === "harvest" && !combatant.item && isBerry(combatant.consumedItem) && (weather === "sun" || this.random() < 0.5)) {
        combatant.item = combatant.consumedItem!;
        combatant.consumedItem = null;
        this.emit(side, `${name} harvested one ${itemName(combatant.item)}!`, { kind: "item", item: combatant.item });
        this.checkHpItems(side);
      }
      if (combatant.hp > 0 && ability === "speed-boost" && (combatant.activeTurns ?? 0) > 0) {
        this.announceAbility(side, `${name}'s Speed Boost!`);
        this.changeStats(side, combatant, [{ stat: "speed", change: 1 }]);
      }
      if (combatant.hp > 0 && ability === "moody") {
        const stats: BoostStat[] = ["attack", "defense", "special-attack", "special-defense", "speed"];
        const up = stats.filter((stat) => stage(combatant, stat) < MAX_STAGE);
        const raised = up.length > 0 ? up[this.randomIndex(up.length)] : null;
        const down = stats.filter((stat) => stat !== raised && stage(combatant, stat) > -MAX_STAGE);
        const lowered = down.length > 0 ? down[this.randomIndex(down.length)] : null;
        this.announceAbility(side, `${name}'s Moody!`);
        if (raised) this.changeStats(side, combatant, [{ stat: raised, change: 2 }]);
        if (lowered) this.changeStats(side, combatant, [{ stat: lowered, change: -1 }]);
      }
      this.checkHpItems(side);
      this.checkStatusItems(side);
      if (combatant.hp === 0 && this.faint(side)) return true;
    }
    return false;
  }

  /** How many times a multi-hit move hits: Skill Link always hits the most, Loaded Dice 4–5 times */
  hitCount(side: Slot, multi: MultiHit): { count: number; checksEachHit: boolean } {
    const skillLink = this.abilityOf(side) === "skill-link";
    const dice = this.itemOf(side) === "loaded-dice";
    let count: number;
    if (multi.min === multi.max) {
      // Population Bomb with Loaded Dice hits 4–10 times
      count = dice && multi.checksEachHit && multi.max >= 10 ? 4 + this.randomIndex(7) : multi.max;
    } else if (skillLink) {
      count = multi.max;
    } else if (dice && multi.min === 2 && multi.max === 5) {
      count = 4 + (this.random() < 0.5 ? 1 : 0);
    } else if (multi.min === 2 && multi.max === 5) {
      // 2 and 3 hits are most likely, 4 and 5 less so
      const roll = this.random();
      count = roll < 0.35 ? 2 : roll < 0.7 ? 3 : roll < 0.85 ? 4 : 5;
    } else {
      count = multi.min + this.randomIndex(multi.max - multi.min + 1);
    }
    return { count, checksEachHit: Boolean(multi.checksEachHit) && !skillLink && !dice };
  }

  /** A damaging move on one or more targets (several for spread moves). Returns true when the battle ended. */
  attack(side: Slot, targets: Slot[], move: MoveInfo, spread = false): boolean {
    const attacker = this.active(side);
    const special = SPECIAL_DAMAGE[move.name];

    // Counter and Mirror Coat only work after taking the right kind of hit this turn
    const taken = this.hitBy[side];
    if (special?.kind === "counter" && (!taken || (special.category !== "any" && taken.category !== special.category))) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }
    if (FIRST_TURN_MOVES.has(move.name) && (attacker.activeTurns ?? 0) > 0) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }
    if (move.name === "beat-up") return this.beatUp(side, targets[0], move);

    // Every target takes its hits first, then the move's other effects follow
    const results: TargetHit[] = [];
    for (const target of targets) {
      const result = this.hitTarget(side, target, move, spread);
      if (result) results.push(result);
    }
    if (results.length === 0) return false;
    const total = results.reduce((sum, result) => sum + result.total, 0);

    // Stat changes happen once per move (Scale Shot's come after all its hits), on each target or once on the user
    const statChanges = AFTER_HITS_STAT_CHANGES[move.name] ?? move.statChanges ?? [];
    const onTarget = !(move.name in AFTER_HITS_STAT_CHANGES) && move.statTarget !== "user";
    const removable = onTarget || statChanges.every(({ change }) => change > 0);
    if (statChanges.length > 0) {
      for (const { target, defender, hitSub } of onTarget ? results : results.slice(0, 1)) {
        const statChance = removable ? this.secondaryChance(side, target, move.statChance || 100, onTarget) : move.statChance || 100;
        // Guaranteed changes (Close Combat, Scale Shot) don't roll
        if (statChance <= 0 || (statChance < 100 && this.random() * 100 >= statChance)) continue;
        if (!onTarget && attacker.hp > 0) this.changeStats(side, attacker, statChanges);
        else if (onTarget && defender.hp > 0 && !hitSub && this.active(target) === defender) this.changeStats(target, defender, statChanges, true);
      }
    }
    if (move.name === "struggle" && attacker.hp > 0) {
      this.hurt(side, Math.max(1, Math.floor(attacker.maxHp / 4)), `${title(attacker.name)} is damaged by the recoil!`);
    }

    // Shell Bell and Life Orb, once per move
    const item = this.itemOf(side);
    if (total > 0 && attacker.hp > 0 && item === "shell-bell" && attacker.hp < attacker.maxHp) {
      this.heal(side, attacker, Math.max(1, Math.floor(total / 8)), `${title(attacker.name)} restored a little HP using its Shell Bell!`);
    }
    const sheerForce = this.abilityOf(side) === "sheer-force" && hasAddedEffects(move);
    if (attacker.hp > 0 && item === "life-orb" && !special && !sheerForce && !this.shieldedFromIndirect(side)) {
      this.hurt(side, Math.max(1, Math.floor(attacker.maxHp / 10)), `${title(attacker.name)} lost some of its HP!`);
    }
    for (const { target, defender, hitSub, flung } of results) {
      if (!hitSub) this.takeItemAfterHit(side, target, move);
      if (flung && move.name === "fling" && !hitSub && defender.hp > 0) {
        if (flung === "toxic-orb" && this.canInflict(target, defender, "poison", side)) this.inflict(target, defender, "poison", side);
        if (flung === "flame-orb" && this.canInflict(target, defender, "burn", side)) this.inflict(target, defender, "burn", side);
        if ((flung === "kings-rock" || flung === "razor-fang") && !this.moved[target]) this.flinched[target] = true;
        if (isBerry(flung)) this.eatBerry(target, flung);
      }
    }
    this.checkHpItems(side);

    for (const { target, defender } of results) {
      if (defender.hp > 0 || this.active(target) !== defender) continue;
      // Destiny Bond and Grudge take effect as their user faints
      const bond = defender.volatiles?.destinyBond;
      const grudge = defender.volatiles?.grudge;
      if (this.faint(target)) return true;
      const index = attacker.moves.findIndex((each) => each.name === move.name);
      if (grudge && index !== -1 && attacker.pp?.[index]) {
        attacker.pp[index] = 0;
        this.emit(side, `${title(attacker.name)}'s ${title(move.name)} lost all its PP due to the grudge!`, { kind: "info" });
      }
      if (bond && attacker.hp > 0) this.hurt(side, attacker.hp, `${title(defender.name)} took its attacker down with it!`);
      this.afterKnockOut(side);
    }
    if (attacker.hp === 0 && this.faint(side)) return true;
    for (const { target, hitSub } of results) {
      // A Red Card may already have sent the attacker away
      if (this.active(side) !== attacker) break;
      if (!hitSub && this.ejectAfterHit(side, target)) return true;
    }
    return false;
  }

  /** One target's part of a damaging move: accuracy, immunity and every hit. Null when it missed or did nothing. */
  hitTarget(side: Slot, target: Slot, move: MoveInfo, spread: boolean): TargetHit | null {
    const attacker = this.active(side);
    const defender = this.active(target);
    const defenderName = title(defender.name);
    const special = SPECIAL_DAMAGE[move.name];
    const taken = this.hitBy[side];
    if (special?.kind === "ohko" && attacker.level < defender.level) {
      this.emit(target, `${defenderName} is unaffected!`, { kind: "fail" });
      return null;
    }

    let power = move.power;
    const variable = VARIABLE_POWER[move.name];
    if (variable) {
      const result = variable({
        attacker,
        defender,
        random: this.random,
        speeds: [this.speed(side), this.speed(target)],
        attackerItem: this.itemOf(side),
        defenderItem: defender.item ?? null,
      });
      if ("fail" in result) {
        this.emit(side, result.fail, { kind: "fail" });
        return null;
      }
      if (result.text) this.emit(side, result.text, { kind: "info" });
      power = result.power;
    }
    // Fling and Natural Gift use up the item
    let flung: string | null = null;
    if ((move.name === "fling" || move.name === "natural-gift") && attacker.item) {
      flung = attacker.item;
      this.emit(side, move.name === "fling" ? `${title(attacker.name)} flung its ${itemName(flung)}!` : `${title(attacker.name)} used its ${itemName(flung)}!`, { kind: "item", item: flung });
      attacker.consumedItem = flung;
      this.loseItem(side);
      this.symbiosis(side);
    }

    // One-hit KO moves ignore accuracy and evasion stages, and land more often against lower levels
    const accurate =
      special?.kind === "ohko"
        ? this.random() * 100 < (move.accuracy ?? 30) + attacker.level - defender.level
        : this.hits(attacker, defender, move);
    if (!accurate) {
      this.emit(target, `${defenderName} avoided the attack!`, { kind: "miss" });
      if (this.itemOf(side) === "blunder-policy") {
        this.consumeItem(side, `${title(attacker.name)}'s Blunder Policy activated!`);
        this.changeStats(side, attacker, [{ stat: "speed", change: 2 }]);
      }
      return null;
    }

    const sheerColdOnIce = move.name === "sheer-cold" && defender.types.includes("ice");
    if (this.effectiveness(move, defender, side) === 0 || sheerColdOnIce) {
      this.emit(target, `It doesn't affect ${defenderName}…`, { kind: "immune" });
      return null;
    }

    // Present: a random gift that is sometimes healing
    if (move.name === "present") {
      const roll = this.random();
      if (roll >= 0.8) {
        if (defender.hp === defender.maxHp) this.emit(target, `${defenderName} can't receive the gift!`, { kind: "fail" });
        else this.heal(target, defender, Math.max(1, Math.floor(defender.maxHp / 4)), `${defenderName} regained health!`);
        return null;
      }
      power = roll < 0.4 ? 40 : roll < 0.7 ? 80 : 120;
    }
    // Pollen Puff heals an ally instead of hurting it
    if (move.name === "pollen-puff" && slotSide(target) === slotSide(side)) {
      if (defender.hp === defender.maxHp) this.emit(target, `${defenderName}'s HP is full!`, { kind: "fail" });
      else this.heal(target, defender, Math.max(1, Math.floor(defender.maxHp / 2)), `${defenderName} regained health!`);
      return null;
    }

    if (SCREEN_BREAKERS.has(move.name)) this.breakScreens(target);

    if (special?.kind === "endeavor" && defender.hp <= attacker.hp) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return null;
    }

    // Multi-hit moves (and Parental Bond) hit several times; each hit rolls its own damage and critical hit
    const multi = special ? null : multiHitOf(move);
    const parentalBond = !multi && !special && !spread && move.name !== "fling" && this.abilityOf(side) === "parental-bond";
    const { count, checksEachHit } = multi
      ? this.hitCount(side, multi)
      : { count: parentalBond ? 2 : 1, checksEachHit: false };
    let total = 0;
    let hits = 0;
    let anyOnSub = false;
    let berryUsed = false;
    for (let hit = 0; hit < count; hit++) {
      if (hit > 0) {
        if (defender.hp === 0 || attacker.hp === 0 || this.active(target) !== defender) break;
        if (checksEachHit && !this.hits(attacker, defender, move)) break;
      }
      const hitPower =
        multi?.escalating ? multi.escalating * (hit + 1) : parentalBond && hit === 1 && power !== null ? Math.floor(power / 4) : power;
      let damage: number;
      let effectiveness = 1;
      let critical = false;
      const hpBefore = defender.hp;
      if (special) {
        damage = specialDamage(special, attacker, defender, taken, this.random);
      } else {
        critical = this.rollCritical(side, target, move);
        const context = this.damageContext(side, target, move, spread);
        // A resist berry halves one super-effective hit (Chilan Berry: any Normal hit)
        const berry = this.itemOf(target);
        const resists = berry ? RESIST_BERRIES[berry] : undefined;
        if (!berryUsed && resists === move.type && ((context.effectiveness ?? 1) > 1 || resists === "normal") && this.canEatBerries(target)) {
          this.consumeItem(target, `${defenderName}'s ${itemName(berry!)} weakened the damage!`);
          context.resistBerry = true;
          berryUsed = true;
        }
        ({ damage, effectiveness } = calculateDamage(attacker, defender, { ...move, power: hitPower }, this.random, critical, context));
      }
      const hitSub = this.strike(target, damage, move.category, { effectiveness, critical, from: side });
      const dealt = hitSub ? 0 : hpBefore - defender.hp;
      total += dealt;
      hits += 1;
      anyOnSub ||= hitSub;
      if (special?.kind === "ohko" && !hitSub) this.emit(target, "It's a one-hit KO!", { kind: "info" });
      if (special?.kind === "final-gambit") attacker.hp = 0;

      // Draining (Big Root heals more, Liquid Ooze hurts instead) and recoil (Rock Head and Magic Guard prevent it)
      const drain = move.drain ?? 0;
      if (drain > 0) {
        let amount = Math.max(1, Math.floor((damage * drain) / 100));
        if (this.itemOf(side) === "big-root") amount = Math.floor(amount * 1.3);
        if (this.abilityOf(target, side) === "liquid-ooze") {
          if (!this.shieldedFromIndirect(side)) this.hurt(side, amount, `${title(attacker.name)} sucked up the liquid ooze!`);
        } else if (attacker.hp > 0 && attacker.hp < attacker.maxHp) {
          this.heal(side, attacker, amount, `${defenderName} had its energy drained!`);
        }
      } else if (drain < 0 && this.abilityOf(side) !== "rock-head" && !this.shieldedFromIndirect(side)) {
        const amount = Math.max(1, Math.floor((damage * -drain) / 100));
        attacker.hp = Math.max(0, attacker.hp - amount);
        this.emit(side, `${title(attacker.name)} is damaged by the recoil!`, { kind: "recoil", amount, hp: attacker.hp });
      }

      // Status conditions and other added effects can come with every hit
      const ailment = move.ailment ?? null;
      const ailmentChance = this.secondaryChance(side, target, move.ailmentChance || 100, true);
      if (ailment && !hitSub && ailmentChance > 0 && this.canInflict(target, defender, ailment, side) && this.random() * 100 < ailmentChance) {
        this.inflict(target, defender, ailment, side);
      }
      if (!hitSub && defender.hp > 0) this.secondaryVolatiles(side, target, move);
      if (!hitSub) this.afterHit(side, target, move, { critical, effectiveness, hpBefore });
    }
    if (count > 1) this.emit(target, `Hit ${hits} time${hits === 1 ? "" : "s"}!`, { kind: "info" });
    // Counter and Mirror Coat hit back for the whole move's damage
    if (count > 1 && total > 0) this.hitBy[target] = { amount: total, category: move.category, from: side };
    return { target, defender, total, hitSub: anyOnSub && total === 0, flung };
  }

  /** Confusion, binding, Heal Block and flinching from a damaging move that hit */
  secondaryVolatiles(side: Slot, target: Slot, move: MoveInfo) {
    const defender = this.active(target);
    const name = title(defender.name);
    const chance = (percent: number) => this.secondaryChance(side, target, percent, true);
    if (move.volatile === "confusion") {
      const odds = chance(move.ailmentChance || 100);
      if (odds > 0 && this.random() * 100 < odds) this.confuse(target, false);
    }
    if (PURE_TRAP_MOVES.has(move.name)) {
      const v = this.vol(target);
      if (!v.trapped) {
        v.trapped = true;
        v.trappedBy = side;
        this.emitVolatile(target, `${name} can no longer escape!`);
      }
    } else if (move.volatile === "trap") {
      const v = this.vol(target);
      if (!v.bound) {
        v.bound = { move: move.name, turns: this.itemOf(side) === "grip-claw" ? 7 : 4 + (this.random() < 0.5 ? 1 : 0), by: side };
        this.emitVolatile(target, `${name} was trapped by ${title(move.name)}!`);
      }
    }
    if (move.name === "psychic-noise" || move.volatile === "heal-block") {
      const v = this.vol(target);
      if (!v.healBlock) {
        v.healBlock = 2;
        this.emitVolatile(target, `${name} was prevented from healing!`);
      }
    }
    // King's Rock and Razor Fang add a flinch chance to moves without one; Inner Focus stops flinching
    let flinch = move.flinchChance ?? 0;
    const item = this.itemOf(side);
    if (flinch === 0 && (item === "kings-rock" || item === "razor-fang")) flinch = 10;
    flinch = flinch > 0 ? chance(flinch) : 0;
    if (flinch > 0 && !this.moved[target] && this.abilityOf(target, side) !== "inner-focus" && (flinch >= 100 || this.random() * 100 < flinch)) {
      this.flinched[target] = true;
    }
  }

  /** Beat Up: one hit from every healthy team member without a status condition. Returns true when the battle ended. */
  beatUp(side: Slot, target: Slot, move: MoveInfo): boolean {
    const attacker = this.active(side);
    const defender = this.active(target);
    if (!this.hits(attacker, defender, move)) {
      this.emit(target, `${title(defender.name)} avoided the attack!`, { kind: "miss" });
      return false;
    }
    if (this.effectiveness(move, defender) === 0) {
      this.emit(target, `It doesn't affect ${title(defender.name)}…`, { kind: "immune" });
      return false;
    }
    const strikers = this.sideData(side).team.filter((member) => member.hp > 0 && member.status === null);
    if (strikers.length === 0) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }

    let hits = 0;
    for (const member of strikers) {
      if (defender.hp === 0) break;
      const power = 5 + Math.floor((member.baseAttack ?? DEFAULT_BASE_ATTACK) / 10);
      const critical = this.rollCritical(side, target, move);
      const { damage, effectiveness } = calculateDamage(attacker, defender, { ...move, power }, this.random, critical, this.damageContext(side, target, move));
      this.strike(target, damage, move.category, { effectiveness, critical, prefix: `${title(member.name)}'s attack! `, from: side });
      hits += 1;
    }
    this.emit(target, `Hit ${hits} time${hits === 1 ? "" : "s"}!`, { kind: "info" });
    return defender.hp === 0 && this.faint(target);
  }

  /**
   * Moves for double battles: helping the ally, drawing attacks, changing places or the move order, and healing
   * others. Returns null when the move isn't one of them, else whether the battle ended.
   */
  doublesMove(side: Slot, target: Slot, move: MoveInfo): boolean | null {
    const user = this.active(side);
    const userName = title(user.name);
    const other = this.active(target);
    const otherName = title(other.name);
    const fail = () => {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    };
    switch (move.name) {
      case "helping-hand":
        if (this.moved[target] || other.hp === 0) return fail();
        this.helped[target] += 1;
        this.emit(target, `${userName} is ready to help ${otherName}!`, { kind: "info" });
        return false;
      case "follow-me":
      case "rage-powder":
        this.attention[slotSide(side)] = { slot: side, powder: move.name === "rage-powder" };
        this.emit(side, `${userName} became the center of attention!`, { kind: "info" });
        return false;
      case "spotlight":
        this.attention[slotSide(target)] = { slot: target, powder: false };
        this.emit(target, `${otherName} became the center of attention!`, { kind: "info" });
        return false;
      case "ally-switch":
        return this.allySwitch(side);
      case "after-you":
      case "quash": {
        const index = this.queue.findIndex((entry) => entry.combatant === other);
        if (index === -1) return fail();
        const [entry] = this.queue.splice(index, 1);
        if (move.name === "after-you") this.queue.unshift(entry);
        else this.queue.push(entry);
        this.emit(target, move.name === "after-you" ? `${otherName} took the kind offer!` : `${otherName}'s move was postponed!`, { kind: "info" });
        return false;
      }
      case "dragon-cheer": {
        const v = this.vol(target);
        if (v.critStage) return fail();
        // Dragon types get pumped up more
        v.critStage = other.types.includes("dragon") ? 2 : 1;
        this.emitVolatile(target, `${otherName} is getting pumped!`);
        return false;
      }
      case "heal-pulse":
      case "floral-healing": {
        if (other.hp === 0 || other.hp === other.maxHp) return fail();
        const fraction = move.name === "floral-healing" && this.battle.field?.terrain?.kind === "grassy" ? 2 / 3 : 1 / 2;
        this.heal(target, other, Math.max(1, Math.floor(other.maxHp * fraction)), `${otherName}'s HP was restored!`);
        return false;
      }
      case "life-dew":
      case "jungle-healing": {
        const ally = this.livingAlly(side);
        let helped = false;
        for (const each of ally === null ? [side] : [side, ally]) {
          const member = this.active(each);
          if (member.hp < member.maxHp) {
            this.heal(each, member, Math.max(1, Math.floor(member.maxHp / 4)), `${title(member.name)} regained health!`);
            helped = true;
          }
          if (move.name === "jungle-healing" && member.status) {
            const status = member.status;
            member.status = null;
            this.emit(each, `${title(member.name)}'s status returned to normal!`, { kind: "cured", status });
            helped = true;
          }
        }
        return helped ? false : fail();
      }
      case "hold-hands":
        this.emit(side, `${userName} and ${otherName} held hands!`, { kind: "info" });
        return false;
      case "happy-hour":
        this.emit(side, "Everyone is caught up in the happy atmosphere!", { kind: "info" });
        return false;
      default:
        return null;
    }
  }

  /** Ally Switch: the user and its ally swap places, and what happens to each this turn goes with them */
  allySwitch(side: Slot): boolean {
    const ally = this.ally(side)!;
    const battleSide = this.sideData(side);
    const actives = [...activeIndexes(battleSide)];
    const [mine, theirs] = [slotPosition(side), slotPosition(ally)];
    [actives[mine], actives[theirs]] = [actives[theirs], actives[mine]];
    battleSide.actives = actives;
    battleSide.active = actives[0];
    const flags: unknown[][] = [
      this.fainted, this.protecting, this.moved, this.flinched, this.enduring, this.magicCoat, this.snatching, this.electrified,
      this.powdered, this.helped, this.hitBy, this.ejecting,
    ];
    for (const each of flags) [each[side], each[ally]] = [each[ally], each[side]];
    const center = this.attention[slotSide(side)];
    if (center) center.slot = center.slot === side ? ally : center.slot === ally ? side : center.slot;
    const user = this.active(ally);
    const partner = this.active(side);
    const where = (slot: Slot) => (slotPosition(slot) === 0 ? "left" : "right");
    this.emit(ally, `${title(user.name)} moved to the ${where(ally)}!`, { kind: "switch", combatant: shown(user) });
    if (partner.hp > 0) this.emit(side, `${title(partner.name)} moved to the ${where(side)}!`, { kind: "switch", combatant: shown(partner) });
    else this.emit(side, `The ${where(side)} spot is empty now.`, { kind: "withdraw" });
    return false;
  }

  /** Burn and poison damage. Returns true when the battle ended. */
  endOfTurn(order: Slot[]): boolean {
    if (this.weatherEndOfTurn(order)) return true;
    if (this.fieldEndOfTurn(order)) return true;
    for (const side of order) {
      const combatant = this.active(side);
      if (combatant.hp === 0) continue;
      if (combatant.status !== "burn" && combatant.status !== "poison") continue;
      if (combatant.status === "poison" && this.abilityOf(side) === "poison-heal") {
        if (combatant.hp < combatant.maxHp) this.heal(side, combatant, Math.max(1, Math.floor(combatant.maxHp / 8)), `${title(combatant.name)} is healed by Poison Heal!`);
        continue;
      }
      if (this.shieldedFromIndirect(side)) continue;

      const fraction = combatant.status === "burn" ? 16 : 8;
      const amount = Math.max(1, Math.floor(combatant.maxHp / fraction));
      combatant.hp = Math.max(0, combatant.hp - amount);
      this.emit(side, `${title(combatant.name)} is hurt by its ${combatant.status}.`, {
        kind: "status-damage",
        status: combatant.status,
        amount,
        hp: combatant.hp,
      });
      if (combatant.hp === 0 && this.faint(side)) return true;
    }
    if (this.volatileEndOfTurn(order)) return true;
    if (this.abilityItemEndOfTurn(order)) return true;
    this.fieldCountdown();
    for (const side of order) this.active(side).activeTurns = (this.active(side).activeTurns ?? 0) + 1;
    return false;
  }
}

/** Damage from moves that ignore stats, STAB and type effectiveness (other than immunity) */
function specialDamage(
  special: SpecialDamage,
  attacker: Combatant,
  defender: Combatant,
  taken: Hit | null,
  random: RandomSource
): number {
  switch (special.kind) {
    case "level":
      return attacker.level;
    case "psywave":
      return Math.max(1, Math.floor((attacker.level * (Math.floor(random() * 101) + 50)) / 100));
    case "endeavor":
      return defender.hp - attacker.hp;
    case "final-gambit":
      return attacker.hp;
    case "ohko":
      return defender.hp;
    case "fixed":
      return special.amount;
    case "half-hp":
      return Math.max(1, Math.floor(defender.hp / 2));
    case "counter":
      return Math.max(1, Math.floor((taken?.amount ?? 0) * special.multiplier));
  }
}

export function movePriority(move: MoveInfo | undefined): number {
  return move?.priority ?? 0;
}

/** The move a Pokémon uses for a choice: one in the middle of Bide keeps biding, and Encore forces its move */
export function chosenMove(combatant: Combatant, index: number): MoveInfo {
  const forced = combatant.bide ? "bide" : combatant.volatiles?.encore?.move;
  const move = forced ? combatant.moves.find((each) => each.name === forced) : undefined;
  return move ?? combatant.moves[index] ?? combatant.moves[0];
}

/** Healthy team members that aren't in battle */
export function healthyBench(side: BattleSide): number[] {
  const actives = activeIndexes(side);
  return side.team.flatMap((combatant, index) => (!actives.includes(index) && combatant.hp > 0 ? [index] : []));
}

/** Whether a side has a fainted Pokémon to replace */
export function isReplacing(battle: Battle, side: SideIndex): boolean {
  return replacingPositions(battle, side).length > 0;
}

/** A side's positions waiting for a replacement */
export function replacingPositions(battle: Battle, side: SideIndex): number[] {
  return battleSlots(battle)
    .filter((slot) => slotSide(slot) === side && battle.replacing?.[slot])
    .map(slotPosition);
}

/** Checks a replacement pick. Returns an error message, or null when it's allowed. */
export function replacementError(side: BattleSide, index: number): string | null {
  const member = side.team[index];
  if (!member) return "That Pokémon isn't on your team";
  if (member.hp === 0) return `${title(member.name)} has fainted`;
  if (activeIndexes(side).includes(index)) return `${title(member.name)} is already in battle`;
  return null;
}

/** Checks a player's replacement picks, one per position (null for positions not being replaced) */
export function replacementsError(battle: Battle, side: SideIndex, picks: readonly (number | null)[]): string | null {
  const battleSide = battle.sides[side];
  const seen = new Set<number>();
  for (const position of replacingPositions(battle, side)) {
    const pick = picks[position];
    if (pick === null || pick === undefined) return `${battleSide.displayName} hasn't picked a Pokémon`;
    const error = replacementError(battleSide, pick);
    if (error) return error;
    if (seen.has(pick)) return `${title(battleSide.team[pick].name)} can only come in once`;
    seen.add(pick);
  }
  return null;
}

/** A side's picks out of per-slot picks */
function picksOf<T>(battle: Battle, side: SideIndex, bySlot: readonly (T | null)[]): (T | null)[] {
  return activeIndexes(battle.sides[side]).map((_, position) => bySlot[slotOf(side, position)] ?? null);
}

/** Sends in the Pokémon the players picked after a faint. `picks` has one entry per slot. */
export function resolveReplacements(battle: Battle, picks: readonly (number | null)[]): Battle {
  if (battle.winner !== null) throw new Error("The battle is already over");
  if (!battle.replacing) throw new Error("Nobody needs to send in a Pokémon");
  for (const side of [0, 1] as SideIndex[]) {
    const error = replacementsError(battle, side, picksOf(battle, side, picks));
    if (error) throw new Error(error);
  }

  const next = structuredClone(battle);
  const runner = new TurnRunner(next, Math.random);
  const start = runner.slots.map((slot) => shown(runner.active(slot)));
  const replacing = next.replacing!;
  next.replacing = undefined;
  let over = false;
  for (const slot of runner.slots) {
    const pick = picks[slot];
    if (!over && replacing[slot] && pick !== null && pick !== undefined) over = runner.sendOut(slot, pick);
  }
  if (!over) over = runner.processEjectPacks();
  if (!over) runner.autoReplace();
  next.seq = (battle.seq ?? 0) + 1;
  next.lastTurn = { seq: next.seq, turn: next.turn, start, events: runner.events,
    weather: battle.weather?.kind ?? null,
    field: battle.field ? structuredClone(battle.field) : null,
  };
  next.log = [...battle.log, ...runner.events.map((event) => event.text)].slice(-80);
  return next;
}

/** The order the leads' abilities take effect in before the first turn: fastest first */
function leadOrder(battle: Battle): Slot[] {
  const slots = battleSlots(battle);
  if (slots.length === 2) return speedOf(battle, 0) >= speedOf(battle, 1) ? [0, 1] : [1, 0];
  return [...slots].sort((a, b) => speedOf(battle, b) - speedOf(battle, a));
}

/** Runs a turn. `choices` has one entry per slot; slots whose Pokémon doesn't act (fainted, or hiding with Commander) can be null. */
export function resolveTurn(battle: Battle, choices: readonly (BattleChoice | null)[], random: RandomSource): Battle {
  if (battle.winner !== null) throw new Error("The battle is already over");
  if (battle.replacing) throw new Error("Waiting for a fainted Pokémon to be replaced");
  for (const side of [0, 1] as SideIndex[]) {
    const error = sideChoicesError(battle, side, picksOf(battle, side, choices));
    if (error) throw new Error(error);
  }

  const next = structuredClone(battle);
  next.turn += 1;
  const runner = new TurnRunner(next, random);
  runner.choices = [...choices];
  const start = runner.slots.map((slot) => shown(runner.active(slot)));
  // The leads' abilities (Intimidate, Drizzle…) take effect before the first turn, faster one first
  if (battle.turn === 0) runner.battleStart(leadOrder(next));

  // Switching always happens before moves, faster Pokémon first
  let over = false;
  if (choices.some((choice) => choice?.kind === "switch")) {
    for (const slot of speedOrder(next, random)) {
      const choice = choices[slot];
      if (choice?.kind === "switch" && slotActs(next, slot) && runner.switchTo(slot, choice.index)) {
        over = true;
        break;
      }
    }
    if (!over) over = runner.processEjectPacks();
  }

  // Moves go in priority order (Protect before Quick Attack before normal moves before Counter), then by speed
  const bySpeed = speedOrder(next, random);
  const priority = (slot: Slot) => {
    const choice = choices[slot];
    if (choice?.kind !== "move") return 0;
    let rank = effectivePriority(next, slot, chosenMove(runner.active(slot), choice.index));
    const item = activeItem(next, slot);
    // Quick Claw sometimes jumps ahead within the priority bracket; Lagging Tail and Stall fall behind
    if (item === "quick-claw" && random() < 0.2) {
      runner.emit(slot, `${title(runner.active(slot).name)}'s Quick Claw let it move first!`, { kind: "item", item });
      rank += 0.5;
    }
    if (item === "lagging-tail" || activeAbility(next, slot) === "stall") rank -= 0.25;
    return rank;
  };
  const ranks = runner.slots.map(priority);
  // A stable sort keeps the speed order within each priority bracket
  const order = [...bySpeed].sort((a, b) => ranks[b] - ranks[a]);
  // The queue holds the Pokémon, not the slots, so Ally Switch, After You and Quash can move things around
  runner.queue = order.flatMap((slot) => {
    const choice = choices[slot];
    return choice?.kind === "move" && slotActs(next, slot) ? [{ combatant: runner.active(slot), choice }] : [];
  });
  while (!over && runner.queue.length > 0) {
    const { combatant, choice } = runner.queue.shift()!;
    const slot = runner.slotOfCombatant(combatant);
    // Pokémon that fainted, were dragged out, or are hiding with Commander don't move
    if (slot === null || runner.fainted[slot] || combatant.hp === 0 || combatant.volatiles?.commanding) continue;
    if (runner.useMove(slot, choice) || runner.processEjectPacks()) over = true;
  }
  if (!over) over = runner.endOfTurn(bySpeed) || runner.processEjectPacks();
  runner.autoReplace();

  next.seq = (battle.seq ?? 0) + 1;
  next.lastTurn = { seq: next.seq, turn: next.turn, start, events: runner.events,
    weather: battle.weather?.kind ?? null,
    field: battle.field ? structuredClone(battle.field) : null,
  };
  next.log = [...battle.log, `Turn ${next.turn}`, ...runner.events.map((event) => event.text)].slice(-80);
  return next;
}

export type BattleTiming = {
  turnEndsAt: number | null;
  awayUntil: ReadonlyMap<number, number>;
};

export type BattleExtras = {
  chatModes: ReadonlyMap<number, ChatMode>;
  spectators: number;
};

const NO_TIMING: BattleTiming = { turnEndsAt: null, awayUntil: new Map() };
const NO_EXTRAS: BattleExtras = { chatModes: new Map(), spectators: 0 };

function toIso(time: number | null | undefined): string | null {
  return time === null || time === undefined ? null : new Date(time).toISOString();
}

export function publicSide(side: BattleSide): PublicSide {
  return {
    userId: side.userId,
    displayName: side.displayName,
    active: shown(side.team[side.active]),
    actives: activeIndexes(side).map((index) => shown(side.team[index])),
    remaining: side.team.filter((combatant) => combatant.hp > 0).length,
    teamSize: side.team.length,
  };
}

export function viewFor(
  battle: Battle,
  userId: number,
  chosen: ReadonlySet<number>,
  timing: BattleTiming = NO_TIMING,
  extras: BattleExtras = NO_EXTRAS
): BattleView {
  const mySide = battle.sides.findIndex((side) => side.userId === userId);
  if (mySide === -1) throw new Error("Not a player in this battle");
  const mine = battle.sides[mySide];
  const theirs = battle.sides[1 - mySide];
  const mySlots = activeIndexes(mine).map((_, position) => slotOf(mySide as SideIndex, position));

  return {
    id: battle.id,
    ruleset: rulesetOf(battle.ruleset),
    turn: battle.turn,
    log: battle.log,
    winner: battle.winner,
    mySide: mySide as SideIndex,
    me: mine,
    opponent: publicSide(theirs),
    lastTurn: battle.lastTurn ?? null,
    hasChosen: chosen.has(userId),
    opponentHasChosen: chosen.has(theirs.userId),
    mustReplace: isReplacing(battle, mySide as SideIndex),
    replacePositions: replacingPositions(battle, mySide as SideIndex),
    actingPositions: battle.replacing || battle.winner !== null ? [] : mySlots.filter((slot) => slotActs(battle, slot)).map(slotPosition),
    opponentMustReplace: isReplacing(battle, (1 - mySide) as SideIndex),
    turnEndsAt: toIso(timing.turnEndsAt),
    opponentAwayUntil: toIso(timing.awayUntil.get(theirs.userId)),
    chatMode: extras.chatModes.get(userId) ?? "public",
    spectators: extras.spectators,
    weather: battle.weather ?? null,
    field: battle.field ?? null,
    moveLocks: mySlots.map((slot) => moveLocks(battle, slot)),
    switchLocks: mySlots.map((slot) => switchLock(battle, slot)),
  };
}

export function spectatorView(
  battle: Battle,
  chosen: ReadonlySet<number>,
  timing: BattleTiming = NO_TIMING,
  extras: BattleExtras = NO_EXTRAS
): SpectatorView {
  const [a, b] = battle.sides;
  return {
    id: battle.id,
    ruleset: rulesetOf(battle.ruleset),
    turn: battle.turn,
    log: battle.log,
    winner: battle.winner,
    sides: [publicSide(a), publicSide(b)],
    lastTurn: battle.lastTurn ?? null,
    chosen: [chosen.has(a.userId), chosen.has(b.userId)],
    replacing: [isReplacing(battle, 0), isReplacing(battle, 1)],
    turnEndsAt: toIso(timing.turnEndsAt),
    awayUntil: [toIso(timing.awayUntil.get(a.userId)), toIso(timing.awayUntil.get(b.userId))],
    chatModes: [extras.chatModes.get(a.userId) ?? "public", extras.chatModes.get(b.userId) ?? "public"],
    spectators: extras.spectators,
    weather: battle.weather ?? null,
    field: battle.field ?? null,
  };
}

/** Animated battle sprites (Showdown) with static fallbacks, derived from the regular sprite URL */
export function battleSprites(spriteUrl: string): { front: string[]; back: string[] } {
  const match = /^(.*\/sprites\/pokemon)\/(\d+)\.png$/.exec(spriteUrl);
  if (!match) return { front: [spriteUrl], back: [spriteUrl] };
  const [, base, id] = match;
  return {
    front: [`${base}/other/showdown/${id}.gif`, spriteUrl],
    back: [`${base}/other/showdown/back/${id}.gif`, `${base}/back/${id}.png`, spriteUrl],
  };
}
