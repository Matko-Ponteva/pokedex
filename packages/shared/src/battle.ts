import { STAB_BONUS, type BoostStat, type MoveInfo, type StatChange, type StatusCondition } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import { rulesetOf, type Ruleset, type RulesetId } from "./rulesets.ts";
import { PROTECT_MOVES, SPECIAL_DAMAGE, VARIABLE_POWER, hasBattleEffect, type SpecialDamage } from "./specialMoves.ts";
import {
  FIELD_EFFECT_ENDED, FIELD_EFFECT_MOVES, FIELD_EFFECT_STARTED, GUARD_MOVES, HAZARD_MOVES, HAZARD_SET, SCREEN_BREAKERS,
  SIDE_CONDITION_MOVES, SIDE_CONDITION_NAMES, SIDE_CONDITION_STARTED, SPINNING_MOVES, TERRAIN_ENDED, TERRAIN_MOVES,
  TERRAIN_STARTED, TERRAIN_TURNS, emptyField, isGrounded, moveEffectiveness, sportMultiplier, terrainPowerMultiplier,
  type FieldEffect, type FieldState, type Hazard, type SideCondition,
} from "./field.ts";
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
  bide?: { turns: number; damage: number } | null;
  /** How many times each move has been used, for moves that run out of PP like Trump Card */
  uses?: Record<string, number>;
  /** HP left in this Pokémon's substitute; 0 or missing means none */
  substituteHp?: number;
  /** Leech Seed drains this Pokémon each turn until it switches out */
  seeded?: boolean;
  /** Ends of turn since this Pokémon came in, for Mat Block */
  activeTurns?: number;
};

/** What anyone watching the battle can see of a Pokémon */
export type ShownCombatant = Pick<Combatant, "name" | "spriteUrl" | "types" | "level" | "hp" | "maxHp" | "status" | "boosts"> & {
  substitute?: boolean;
  seeded?: boolean;
};

export type BattleSide = {
  userId: number;
  displayName: string;
  team: Combatant[];
  active: number;
};

export type SideIndex = 0 | 1;

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
  | { kind: "faint" }
  | { kind: "withdraw" }
  | { kind: "switch"; combatant: ShownCombatant }
  | { kind: "win" };

/** One step of a turn. `side` is the battle side the event happens to. */
export type BattleEvent = { side: SideIndex; text: string } & EventBody;

/** What a player does in a turn: use one of their active Pokémon's moves, or switch to a team member */
export type BattleChoice = { kind: "move"; index: number } | { kind: "switch"; index: number };

export type TurnRecord = {
  /** Increases with every resolved step (a turn, or sending in replacements) */
  seq: number;
  turn: number;
  /** The active Pokémon of both sides when the turn began */
  start: [ShownCombatant, ShownCombatant];
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
  /** Sides whose Pokémon fainted and who must choose the next one before the battle goes on */
  replacing?: [boolean, boolean];
  weather?: WeatherState | null;
  field?: FieldState | null;
};

export type RandomSource = () => number;

export type PublicSide = {
  userId: number;
  displayName: string;
  active: ShownCombatant;
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
  /** The opponent is choosing their next Pokémon */
  opponentMustReplace: boolean;
  turnEndsAt: string | null;
  opponentAwayUntil: string | null;
  chatMode: ChatMode;
  spectators: number;
  weather: WeatherState | null;
  field: FieldState | null;
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
}): Combatant {
  const { level } = input;
  const base = (name: string) => input.baseStats.find((s) => s.name === name)?.value ?? 50;
  const stats: BattleStats = {
    hp: statAtLevel(base("hp"), level, true),
    attack: statAtLevel(base("attack"), level),
    defense: statAtLevel(base("defense"), level),
    specialAttack: statAtLevel(base("special-attack"), level),
    specialDefense: statAtLevel(base("special-defense"), level),
    speed: statAtLevel(base("speed"), level),
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
  };
}

export function shown(combatant: Combatant): ShownCombatant {
  const { name, spriteUrl, types, level, hp, maxHp, status, boosts } = combatant;
  const shownCombatant: ShownCombatant = { name, spriteUrl, types, level, hp, maxHp, status, boosts: { ...boosts } };
  if ((combatant.substituteHp ?? 0) > 0) shownCombatant.substitute = true;
  if (combatant.seeded) shownCombatant.seeded = true;
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
  const gravity = Boolean(field?.effects.gravity);
  const effectiveness = moveEffectiveness(move.type, defender.types, gravity);
  if (effectiveness === 0) return { damage: 0, effectiveness, critical: false };

  const physical = move.category === "physical";
  let attackStage = stage(attacker, physical ? "attack" : "special-attack");
  let defenseStage = stage(defender, physical ? "defense" : "special-defense");
  // Critical hits ignore the attacker's drops and the defender's boosts
  if (critical) {
    attackStage = Math.max(0, attackStage);
    defenseStage = Math.min(0, defenseStage);
  }
  const attack = Math.floor(
    (physical ? attacker.stats.attack : attacker.stats.specialAttack) * stageMultiplier(attackStage)
  );
  // Wonder Room swaps which defense stat each kind of move hits
  const wonderRoom = Boolean(field?.effects["wonder-room"]);
  const defense = Math.floor(
    (physical !== wonderRoom ? defender.stats.defense : defender.stats.specialDefense) *
      stageMultiplier(defenseStage) *
      weatherDefenseMultiplier(weather, defender.types, physical)
  );
  const levelFactor = (2 * attacker.level) / 5 + 2;
  const base = Math.floor((levelFactor * (move.power ?? 0) * attack) / defense / 50) + 2;

  const stab = attacker.types.includes(move.type) ? STAB_BONUS : 1;
  const crit = critical ? CRIT_MULTIPLIER : 1;
  const burn = physical && attacker.status === "burn" ? 0.5 : 1;
  const sky = weatherPowerMultiplier(weather, move.type);
  const ground = terrainPowerMultiplier(
    field?.terrain?.kind ?? null,
    move,
    isGrounded(attacker.types, gravity),
    isGrounded(defender.types, gravity)
  );
  const sport = sportMultiplier(field?.effects, move.type);
  // Screens halve damage, except from critical hits
  const screens = field && defenderSide !== undefined ? field.sides[defenderSide].conditions : {};
  const screened = !critical && (screens["aurora-veil"] || (physical ? screens.reflect : screens["light-screen"])) ? 0.5 : 1;
  const roll = 0.85 + random() * 0.15;
  return {
    damage: Math.max(1, Math.floor(base * effectiveness * stab * crit * burn * sky * ground * sport * screened * roll)),
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

export function criticalChance(move: MoveInfo): number {
  return (move.critRate ?? 0) >= 1 ? 1 / 8 : 1 / 24;
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

/** Faster Pokémon first; a speed tie is a coin flip */
function speedOrder(battle: Battle, random: RandomSource): SideIndex[] {
  const field = battle.field;
  const [a, b] = battle.sides.map(
    (side, index) => effectiveSpeed(side.team[side.active]) * (field?.sides[index].conditions.tailwind ? 2 : 1)
  );
  // Trick Room lets the slower Pokémon go first
  if (a !== b) return a > b === !field?.effects["trick-room"] ? [0, 1] : [1, 0];
  return random() < 0.5 ? [0, 1] : [1, 0];
}

/** Checks a choice against the battle. Returns an error message, or null when it's allowed. */
export function choiceError(side: BattleSide, choice: BattleChoice, field: FieldState | null = null): string | null {
  if (choice.kind === "move") {
    return choice.index < side.team[side.active].moves.length ? null : "That move doesn't exist";
  }
  if (field?.effects["fairy-lock"]) return "Fairy Lock keeps everyone from switching out this turn";
  const active = side.team[side.active];
  if (active.bide && active.hp > 0) return `${title(active.name)} is storing energy and can't switch out`;
  const member = side.team[choice.index];
  if (!member) return "That Pokémon isn't on your team";
  if (choice.index === side.active) return `${title(member.name)} is already in battle`;
  if (member.hp === 0) return `${title(member.name)} has fainted`;
  return null;
}

type Hit = { amount: number; category: MoveInfo["category"] };

class TurnRunner {
  readonly events: BattleEvent[] = [];
  readonly battle: Battle;
  readonly random: RandomSource;
  /** Sides whose Pokémon fainted this turn; their replacement doesn't get to act */
  readonly fainted: [boolean, boolean] = [false, false];
  /** Sides shielded by Protect for the rest of the turn */
  readonly protecting: [boolean, boolean] = [false, false];
  /** The last damage each side's Pokémon took from a move this turn, for Counter and Mirror Coat */
  readonly hitBy: [Hit | null, Hit | null] = [null, null];
  /** Quick Guard, Crafty Shield and Mat Block up on each side this turn */
  readonly guards: [Set<string>, Set<string>] = [new Set(), new Set()];
  /** Ion Deluge turns Normal moves into Electric ones for the rest of the turn */
  ionDeluge = false;

  constructor(battle: Battle, random: RandomSource) {
    this.battle = battle;
    this.random = random;
  }

  get weather(): Weather | null {
    return this.battle.weather?.kind ?? null;
  }

  /** Status conditions the target can get, also counting that nothing freezes in harsh sunlight */
  canInflict(side: SideIndex, combatant: Combatant, status: StatusCondition): boolean {
    if (!canReceiveStatus(combatant, status)) return false;
    if (status === "freeze" && this.weather === "sun") return false;
    const field = this.battle.field;
    if (field?.sides[side].conditions.safeguard) return false;
    const terrain = field?.terrain?.kind;
    if (terrain && this.grounded(side) && (terrain === "misty" || (terrain === "electric" && status === "sleep"))) return false;
    return true;
  }

  setWeather(side: SideIndex, weather: Weather) {
    if (this.weather === weather) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return;
    }
    this.battle.weather = { kind: weather, turnsLeft: WEATHER_TURNS };
    this.emit(side, WEATHER_STARTED[weather], { kind: "weather", weather });
  }

  /** Counts the weather down, and lets sandstorm and hail hurt both Pokémon. Returns true when the battle ended. */
  weatherEndOfTurn(order: SideIndex[]): boolean {
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
      if (combatant.hp === 0 || !hurtByWeather(state.kind, combatant.types)) continue;
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

  emit(side: SideIndex, text: string, body: EventBody) {
    this.events.push({ side, text, ...body } as BattleEvent);
  }

  active(side: SideIndex): Combatant {
    const battleSide = this.battle.sides[side];
    return battleSide.team[battleSide.active];
  }

  /** Returns true when the battle ended (hazards can knock out the incoming Pokémon) */
  switchTo(side: SideIndex, index: number): boolean {
    const battleSide = this.battle.sides[side];
    const outgoing = this.active(side);
    outgoing.boosts = {};
    outgoing.protectStreak = 0;
    outgoing.stockpile = 0;
    outgoing.bide = null;
    outgoing.substituteHp = 0;
    outgoing.seeded = false;
    this.emit(side, `${battleSide.displayName} withdrew ${title(outgoing.name)}!`, { kind: "withdraw" });
    battleSide.active = index;
    const incoming = this.active(side);
    this.emit(side, `${battleSide.displayName} sent out ${title(incoming.name)}!`, {
      kind: "switch",
      combatant: shown(incoming),
    });
    return this.enterField(side);
  }

  /** Handles a faint on `side`. Returns true when that ends the battle. */
  faint(side: SideIndex): boolean {
    const battleSide = this.battle.sides[side];
    this.fainted[side] = true;
    this.emit(side, `${title(this.active(side).name)} fainted!`, { kind: "faint" });

    if (!battleSide.team.some((combatant) => combatant.hp > 0)) {
      const winner = this.battle.sides[1 - side];
      this.battle.winner = winner.userId;
      this.emit((1 - side) as SideIndex, `${winner.displayName} wins the battle!`, { kind: "win" });
      return true;
    }
    // The player picks the replacement once the turn is over
    const replacing = this.battle.replacing ?? [false, false];
    replacing[side] = true;
    this.battle.replacing = replacing;
    return false;
  }

  /** Returns true when the battle ended (hazards can knock out the incoming Pokémon) */
  sendOut(side: SideIndex, index: number): boolean {
    const battleSide = this.battle.sides[side];
    battleSide.active = index;
    const next = this.active(side);
    this.emit(side, `${battleSide.displayName} sent out ${title(next.name)}!`, {
      kind: "switch",
      combatant: shown(next),
    });
    return this.enterField(side);
  }

  /** Sends in the only Pokémon left when there's nothing to choose */
  autoReplace() {
    // Hazards can knock out the Pokémon sent in, so keep going until nothing changes
    let changed = true;
    while (changed && this.battle.winner === null && this.battle.replacing) {
      changed = false;
      for (const side of [0, 1] as SideIndex[]) {
        if (!this.battle.replacing?.[side]) continue;
        const options = healthyBench(this.battle.sides[side]);
        if (options.length !== 1) continue;
        this.battle.replacing[side] = false;
        changed = true;
        if (this.sendOut(side, options[0])) return;
      }
      if (this.battle.replacing && !this.battle.replacing.some(Boolean)) this.battle.replacing = undefined;
    }
  }

  /** Sleep, freeze and paralysis checks. Returns false when the Pokémon can't move. */
  canAct(side: SideIndex, move: MoveInfo): boolean {
    const combatant = this.active(side);
    const name = title(combatant.name);

    switch (combatant.status) {
      case "sleep":
        if (combatant.sleepTurns > 0) {
          combatant.sleepTurns -= 1;
          this.emit(side, `${name} is fast asleep.`, { kind: "cant-move", status: "sleep" });
          return false;
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
    const gravity = this.battle.field?.effects.gravity ? 5 / 3 : 1;
    const odds = accuracy * accuracyMultiplier(stage(attacker, "accuracy") - stage(defender, "evasion")) * gravity;
    return this.random() * 100 < odds;
  }

  inflict(side: SideIndex, combatant: Combatant, status: StatusCondition) {
    combatant.status = status;
    if (status === "sleep") combatant.sleepTurns = 1 + Math.floor(this.random() * 3);
    this.emit(side, `${title(combatant.name)} ${STATUS_INFLICTED[status]}`, { kind: "status", status });
  }

  changeStats(side: SideIndex, combatant: Combatant, changes: readonly StatChange[], fromFoe = false) {
    if (fromFoe && this.battle.field?.sides[side].conditions.mist && changes.some(({ change }) => change < 0)) {
      this.emit(side, `${title(combatant.name)} is protected by the mist!`, { kind: "fail" });
      changes = changes.filter(({ change }) => change > 0);
    }
    for (const { stat, change } of changes) {
      const before = stage(combatant, stat);
      const after = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, before + change));
      combatant.boosts[stat] = after;
      this.emit(side, statChangeText(title(combatant.name), stat, after - before, change), {
        kind: "stat",
        stat,
        change: after - before,
        attempted: change,
      });
    }
  }

  heal(side: SideIndex, combatant: Combatant, amount: number, text: string) {
    const healed = Math.min(amount, combatant.maxHp - combatant.hp);
    combatant.hp += healed;
    this.emit(side, text, { kind: "heal", amount: healed, hp: combatant.hp });
  }

  /** Runs one move. Returns true when the battle ended. */
  useMove(side: SideIndex, moveIndex: number): boolean {
    const target = (1 - side) as SideIndex;
    const attacker = this.active(side);
    let move = weatherAdjustedMove(chosenMove(attacker, moveIndex), this.weather);
    if (this.ionDeluge && move.type === "normal") move = { ...move, type: "electric" };
    if (!PROTECT_MOVES.has(move.name)) attacker.protectStreak = 0;
    if (!this.canAct(side, move)) {
      attacker.protectStreak = 0;
      attacker.bide = null;
      return false;
    }
    if (attacker.bide) return this.continueBide(side, target);

    attacker.uses = { ...attacker.uses, [move.name]: (attacker.uses?.[move.name] ?? 0) + 1 };
    this.emit(side, `${title(attacker.name)} used ${title(move.name)}.`, {
      kind: "move",
      move: move.name,
      moveType: move.type,
    });

    if (move.name === "bide") {
      attacker.bide = { turns: 2, damage: 0 };
      this.emit(side, `${title(attacker.name)} is storing energy!`, { kind: "info" });
      return false;
    }

    const needsFoe =
      move.category !== "status" ||
      Boolean(move.ailment) ||
      ((move.statChanges ?? []).length > 0 && move.statTarget !== "user") ||
      move.name === "leech-seed";
    if (needsFoe && this.active(target).hp === 0) {
      this.emit(side, "But there was no target!", { kind: "fail" });
      return false;
    }
    if (needsFoe && this.protecting[target]) {
      this.emit(target, `${title(this.active(target).name)} protected itself!`, { kind: "protect", blocked: true });
      return false;
    }
    if (needsFoe && this.blockedByGuard(target, move)) return false;
    const foe = this.active(target);
    if (needsFoe && (move.priority ?? 0) > 0 && this.battle.field?.terrain?.kind === "psychic" && this.grounded(target)) {
      this.emit(target, `${title(foe.name)} is protected by the Psychic Terrain!`, { kind: "protect", blocked: true });
      return false;
    }
    // A substitute keeps status moves off the Pokémon behind it
    if (needsFoe && move.category === "status" && (foe.substituteHp ?? 0) > 0) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }

    if (this.fieldMove(side, target, move)) return false;
    if (PROTECT_MOVES.has(move.name)) {
      this.protect(side);
      return false;
    }
    if (move.category === "status") {
      this.statusMove(side, target, move);
      this.clearField(side, target, move);
      return false;
    }
    const over = this.attack(side, target, move);
    if (!over && move.name === "spit-up") this.releaseStockpile(side);
    if (!over) this.clearField(side, target, move);
    return over;
  }

  /** Protect and Detect: always work the first time, then a third as likely with each use in a row */
  protect(side: SideIndex) {
    const user = this.active(side);
    const streak = user.protectStreak ?? 0;
    if (this.random() >= 1 / 3 ** streak) {
      user.protectStreak = 0;
      this.emit(side, "But it failed!", { kind: "fail" });
      return;
    }
    user.protectStreak = streak + 1;
    this.protecting[side] = true;
    this.emit(side, `${title(user.name)} protected itself!`, { kind: "protect", blocked: false });
  }

  /** Bide's later turns: store energy, then hit back for twice the damage taken. Returns true when the battle ended. */
  continueBide(side: SideIndex, target: SideIndex): boolean {
    const user = this.active(side);
    const bide = user.bide!;
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
    this.strike(target, bide.damage * 2, "physical", { effectiveness: 1, critical: false });
    return foe.hp === 0 && this.faint(target);
  }

  /** Spit Up and Swallow give back the defenses Stockpile raised */
  releaseStockpile(side: SideIndex) {
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

  statusMove(side: SideIndex, target: SideIndex, move: MoveInfo) {
    const user = this.active(side);
    const foe = this.active(target);
    const ailment = move.ailment ?? null;
    const statChanges = move.statChanges ?? [];
    const hitsFoe = ailment !== null || (statChanges.length > 0 && move.statTarget !== "user");

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
      if (this.canInflict(target, foe, ailment)) {
        this.inflict(target, foe, ailment);
      } else if (foe.status === ailment) {
        this.emit(target, `${title(foe.name)} ${STATUS_ALREADY[ailment]}!`, { kind: "fail" });
      } else {
        this.emit(target, "But it failed!", { kind: "fail" });
      }
      didSomething = true;
    }
    if (statChanges.length > 0) {
      if (move.statTarget === "user") this.changeStats(side, user, statChanges);
      else this.changeStats(target, foe, statChanges, true);
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

  /** Takes HP off the target of a move and reports it */
  strike(
    target: SideIndex,
    damage: number,
    category: MoveInfo["category"],
    { effectiveness, critical, prefix = "" }: { effectiveness: number; critical: boolean; prefix?: string }
  ): boolean {
    const defender = this.active(target);
    const substitute = defender.substituteHp ?? 0;
    if (substitute > 0) {
      defender.substituteHp = Math.max(0, substitute - damage);
      const broke = defender.substituteHp === 0;
      const name = title(defender.name);
      this.emit(
        target,
        `${prefix}${critical ? "A critical hit! " : ""}${effectNote(effectiveness)}The substitute took damage for ${name}!${broke ? ` ${name}'s substitute faded!` : ""}`,
        { kind: "substitute", active: !broke, hp: defender.hp }
      );
      return true;
    }
    defender.hp = Math.max(0, defender.hp - damage);
    this.hitBy[target] = { amount: damage, category };
    if (defender.bide) defender.bide.damage += damage;
    this.emit(
      target,
      `${prefix}${critical ? "A critical hit! " : ""}${effectNote(effectiveness)}${title(defender.name)} lost ${damage} HP.`,
      { kind: "damage", amount: damage, hp: defender.hp, effectiveness, critical }
    );
    return false;
  }

  get field(): FieldState {
    this.battle.field ??= emptyField();
    return this.battle.field;
  }

  team(side: SideIndex): string {
    return `${this.battle.sides[side].displayName}'s team`;
  }

  grounded(side: SideIndex): boolean {
    return isGrounded(this.active(side).types, Boolean(this.battle.field?.effects.gravity));
  }

  /** Speed after stages, paralysis and Tailwind */
  speed(side: SideIndex): number {
    return effectiveSpeed(this.active(side)) * (this.battle.field?.sides[side].conditions.tailwind ? 2 : 1);
  }

  damageContext(defenderSide: SideIndex): DamageContext {
    return { weather: this.weather, field: this.battle.field ?? null, defenderSide };
  }

  effectiveness(move: MoveInfo, defender: Combatant): number {
    return moveEffectiveness(move.type, defender.types, Boolean(this.battle.field?.effects.gravity));
  }

  /** Critical hit roll, which Lucky Chant on the target's side rules out */
  rollCritical(target: SideIndex, move: MoveInfo): boolean {
    if (this.battle.field?.sides[target].conditions["lucky-chant"]) return false;
    return this.random() < criticalChance(move);
  }

  /** Reports a change to the field, with the field as it is now so the screen can follow along */
  emitField(side: SideIndex, text: string) {
    this.emit(side, text, { kind: "field", field: structuredClone(this.field) });
  }

  /** Quick Guard, Crafty Shield and Mat Block on the target's side. Returns true when the move is blocked. */
  blockedByGuard(target: SideIndex, move: MoveInfo): boolean {
    const guards = this.guards[target];
    const guard =
      guards.has("quick-guard") && (move.priority ?? 0) > 0
        ? "quick-guard"
        : guards.has("crafty-shield") && move.category === "status"
          ? "crafty-shield"
          : guards.has("mat-block") && move.category !== "status"
            ? "mat-block"
            : null;
    if (!guard) return false;
    this.emit(target, `${GUARD_MOVES[guard]} protected ${this.team(target)}!`, { kind: "protect", blocked: true });
    return true;
  }

  /** Status and field moves that change the field, guard the user's side, or set up Substitute or Leech Seed. Returns true when it handled the move. */
  fieldMove(side: SideIndex, target: SideIndex, move: MoveInfo): boolean {
    const user = this.active(side);
    const userName = title(user.name);
    const fail = (text = "But it failed!") => this.emit(side, text, { kind: "fail" });

    const sideMove = SIDE_CONDITION_MOVES[move.name];
    if (sideMove) {
      const conditions = this.field.sides[side].conditions;
      const needsSnow = sideMove.condition === "aurora-veil" && this.weather !== "hail" && this.weather !== "snow";
      if (conditions[sideMove.condition] || needsSnow) {
        fail();
      } else {
        conditions[sideMove.condition] = sideMove.turns;
        this.emitField(side, SIDE_CONDITION_STARTED[sideMove.condition](this.team(side)));
      }
      return true;
    }

    const hazardMove = HAZARD_MOVES[move.name];
    if (hazardMove) {
      const hazards = this.field.sides[target].hazards;
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
      }
      return true;
    }

    const terrain = TERRAIN_MOVES[move.name];
    if (terrain) {
      if (this.field.terrain?.kind === terrain) {
        fail();
      } else {
        this.field.terrain = { kind: terrain, turnsLeft: TERRAIN_TURNS };
        this.emitField(side, TERRAIN_STARTED[terrain]);
      }
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
        for (const each of [0, 1] as SideIndex[]) this.active(each).boosts = {};
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
          this.emit(target, `${title(foe.name)} was seeded!`, { kind: "seeded", seeded: true });
        }
        return true;
      }
      default:
        return false;
    }
  }

  /** Defog, Tidy Up, Rapid Spin and Mortal Spin clearing hazards and more, after they hit */
  clearField(side: SideIndex, target: SideIndex, move: MoveInfo) {
    const field = this.battle.field;
    const user = this.active(side);
    if (user.hp === 0) return;
    const clearHazards = (which: SideIndex) => {
      if (!field || Object.keys(field.sides[which].hazards).length === 0) return false;
      field.sides[which].hazards = {};
      return true;
    };

    if (SPINNING_MOVES.has(move.name)) {
      if (user.seeded) {
        user.seeded = false;
        this.emit(side, `${title(user.name)} was freed from Leech Seed!`, { kind: "seeded", seeded: false });
      }
      if (clearHazards(side)) this.emitField(side, `${title(user.name)} blew away the hazards!`);
    }
    if (move.name === "defog") {
      let cleared = false;
      if (field) {
        const conditions = field.sides[target].conditions;
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
      for (const each of [0, 1] as SideIndex[]) {
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
  breakScreens(target: SideIndex) {
    const conditions = this.battle.field?.sides[target].conditions;
    if (!conditions) return;
    const screens = (["reflect", "light-screen", "aurora-veil"] as const).filter((screen) => conditions[screen]);
    if (screens.length === 0) return;
    for (const screen of screens) delete conditions[screen];
    this.emitField(target, "It shattered the barrier!");
  }

  /** Hazards hurting or hindering a Pokémon that just came in. Returns true when the battle ended. */
  enterField(side: SideIndex): boolean {
    const combatant = this.active(side);
    combatant.activeTurns = 0;
    const hazards = this.battle.field?.sides[side].hazards;
    if (!hazards) return false;
    const name = title(combatant.name);
    const hurt = (hazard: Hazard, amount: number, text: string) => {
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
    return combatant.hp === 0 && this.faint(side);
  }

  /** Grassy Terrain healing and Leech Seed draining. Returns true when the battle ended. */
  fieldEndOfTurn(order: SideIndex[]): boolean {
    if (this.battle.field?.terrain?.kind === "grassy") {
      for (const side of order) {
        const combatant = this.active(side);
        if (combatant.hp === 0 || combatant.hp === combatant.maxHp || !this.grounded(side)) continue;
        this.heal(side, combatant, Math.max(1, Math.floor(combatant.maxHp / 16)), `${title(combatant.name)} is healed by the grassy terrain!`);
      }
    }
    for (const side of order) {
      const seeded = this.active(side);
      if (seeded.hp === 0 || !seeded.seeded) continue;
      const amount = Math.min(seeded.hp, Math.max(1, Math.floor(seeded.maxHp / 8)));
      seeded.hp -= amount;
      this.emit(side, `${title(seeded.name)}'s health is sapped by Leech Seed!`, { kind: "leech", amount, hp: seeded.hp });
      const other = (1 - side) as SideIndex;
      const sapper = this.active(other);
      if (sapper.hp > 0 && sapper.hp < sapper.maxHp) this.heal(other, sapper, amount, `${title(sapper.name)} regained health!`);
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

  /** A damaging move. Returns true when the battle ended. */
  attack(side: SideIndex, target: SideIndex, move: MoveInfo): boolean {
    const attacker = this.active(side);
    const defender = this.active(target);
    const defenderName = title(defender.name);
    const special = SPECIAL_DAMAGE[move.name];

    // Counter and Mirror Coat only work after taking the right kind of hit this turn
    const taken = this.hitBy[side];
    if (special?.kind === "counter" && (!taken || (special.category !== "any" && taken.category !== special.category))) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }
    if (special?.kind === "ohko" && attacker.level < defender.level) {
      this.emit(target, `${defenderName} is unaffected!`, { kind: "fail" });
      return false;
    }
    if (move.name === "beat-up") return this.beatUp(side, target, move);

    let power = move.power;
    const variable = VARIABLE_POWER[move.name];
    if (variable) {
      const result = variable({
        attacker,
        defender,
        random: this.random,
        speeds: [this.speed(side), this.speed(target)],
      });
      if ("fail" in result) {
        this.emit(side, result.fail, { kind: "fail" });
        return false;
      }
      if (result.text) this.emit(side, result.text, { kind: "info" });
      power = result.power;
    }

    // One-hit KO moves ignore accuracy and evasion stages, and land more often against lower levels
    const accurate =
      special?.kind === "ohko"
        ? this.random() * 100 < (move.accuracy ?? 30) + attacker.level - defender.level
        : this.hits(attacker, defender, move);
    if (!accurate) {
      this.emit(target, `${defenderName} avoided the attack!`, { kind: "miss" });
      return false;
    }

    const sheerColdOnIce = move.name === "sheer-cold" && defender.types.includes("ice");
    if (this.effectiveness(move, defender) === 0 || sheerColdOnIce) {
      this.emit(target, `It doesn't affect ${defenderName}…`, { kind: "immune" });
      return false;
    }

    // Present: a random gift that is sometimes healing
    if (move.name === "present") {
      const roll = this.random();
      if (roll >= 0.8) {
        if (defender.hp === defender.maxHp) this.emit(target, `${defenderName} can't receive the gift!`, { kind: "fail" });
        else this.heal(target, defender, Math.max(1, Math.floor(defender.maxHp / 4)), `${defenderName} regained health!`);
        return false;
      }
      power = roll < 0.4 ? 40 : roll < 0.7 ? 80 : 120;
    }

    if (SCREEN_BREAKERS.has(move.name)) this.breakScreens(target);

    if (special?.kind === "endeavor" && defender.hp <= attacker.hp) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }

    let damage: number;
    let effectiveness = 1;
    let critical = false;
    if (special) {
      damage = specialDamage(special, attacker, defender, taken, this.random);
    } else {
      critical = this.rollCritical(target, move);
      ({ damage, effectiveness } = calculateDamage(attacker, defender, { ...move, power }, this.random, critical, this.damageContext(target)));
    }
    const hitSub = this.strike(target, damage, move.category, { effectiveness, critical });
    if (special?.kind === "ohko" && !hitSub) this.emit(target, "It's a one-hit KO!", { kind: "info" });
    if (special?.kind === "final-gambit") attacker.hp = 0;

    // Draining and recoil
    const drain = move.drain ?? 0;
    if (drain > 0 && attacker.hp < attacker.maxHp) {
      const amount = Math.max(1, Math.floor((damage * drain) / 100));
      this.heal(side, attacker, amount, `${defenderName} had its energy drained!`);
    } else if (drain < 0) {
      const amount = Math.max(1, Math.floor((damage * -drain) / 100));
      attacker.hp = Math.max(0, attacker.hp - amount);
      this.emit(side, `${title(attacker.name)} is damaged by the recoil!`, { kind: "recoil", amount, hp: attacker.hp });
    }

    // Secondary effects
    const statChanges = move.statChanges ?? [];
    if (statChanges.length > 0 && this.random() * 100 < (move.statChance || 100)) {
      if (move.statTarget === "user" && attacker.hp > 0) this.changeStats(side, attacker, statChanges);
      else if (move.statTarget !== "user" && defender.hp > 0 && !hitSub) this.changeStats(target, defender, statChanges, true);
    }
    const ailment = move.ailment ?? null;
    if (ailment && !hitSub && this.canInflict(target, defender, ailment) && this.random() * 100 < (move.ailmentChance || 100)) {
      this.inflict(target, defender, ailment);
    }

    if (defender.hp === 0 && this.faint(target)) return true;
    if (attacker.hp === 0 && this.faint(side)) return true;
    return false;
  }

  /** Beat Up: one hit from every healthy team member without a status condition. Returns true when the battle ended. */
  beatUp(side: SideIndex, target: SideIndex, move: MoveInfo): boolean {
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
    const strikers = this.battle.sides[side].team.filter((member) => member.hp > 0 && member.status === null);
    if (strikers.length === 0) {
      this.emit(side, "But it failed!", { kind: "fail" });
      return false;
    }

    let hits = 0;
    for (const member of strikers) {
      if (defender.hp === 0) break;
      const power = 5 + Math.floor((member.baseAttack ?? DEFAULT_BASE_ATTACK) / 10);
      const critical = this.rollCritical(target, move);
      const { damage, effectiveness } = calculateDamage(attacker, defender, { ...move, power }, this.random, critical, this.damageContext(target));
      this.strike(target, damage, move.category, { effectiveness, critical, prefix: `${title(member.name)}'s attack! ` });
      hits += 1;
    }
    this.emit(target, `Hit ${hits} time${hits === 1 ? "" : "s"}!`, { kind: "info" });
    return defender.hp === 0 && this.faint(target);
  }

  /** Burn and poison damage. Returns true when the battle ended. */
  endOfTurn(order: SideIndex[]): boolean {
    if (this.weatherEndOfTurn(order)) return true;
    if (this.fieldEndOfTurn(order)) return true;
    for (const side of order) {
      const combatant = this.active(side);
      if (combatant.hp === 0) continue;
      if (combatant.status !== "burn" && combatant.status !== "poison") continue;

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

/** The move a Pokémon uses for a choice: a Pokémon in the middle of Bide keeps biding whatever was picked */
export function chosenMove(combatant: Combatant, index: number): MoveInfo {
  const bide = combatant.bide ? combatant.moves.find((move) => move.name === "bide") : undefined;
  return bide ?? combatant.moves[index] ?? combatant.moves[0];
}

/** Healthy team members that aren't in battle */
export function healthyBench(side: BattleSide): number[] {
  return side.team.flatMap((combatant, index) => (index !== side.active && combatant.hp > 0 ? [index] : []));
}

export function isReplacing(battle: Battle, side: SideIndex): boolean {
  return battle.replacing?.[side] ?? false;
}

/** Checks a replacement pick. Returns an error message, or null when it's allowed. */
export function replacementError(side: BattleSide, index: number): string | null {
  const member = side.team[index];
  if (!member) return "That Pokémon isn't on your team";
  if (member.hp === 0) return `${title(member.name)} has fainted`;
  if (index === side.active) return `${title(member.name)} is already in battle`;
  return null;
}

/** Sends in the Pokémon the players picked after a faint */
export function resolveReplacements(battle: Battle, picks: [number | null, number | null]): Battle {
  if (battle.winner !== null) throw new Error("The battle is already over");
  if (!battle.replacing) throw new Error("Nobody needs to send in a Pokémon");
  battle.sides.forEach((side, index) => {
    if (!battle.replacing![index]) return;
    const pick = picks[index];
    if (pick === null) throw new Error(`${side.displayName} hasn't picked a Pokémon`);
    const error = replacementError(side, pick);
    if (error) throw new Error(error);
  });

  const next = structuredClone(battle);
  const runner = new TurnRunner(next, Math.random);
  const start: [ShownCombatant, ShownCombatant] = [shown(runner.active(0)), shown(runner.active(1))];
  const replacing = next.replacing!;
  next.replacing = undefined;
  let over = false;
  for (const side of [0, 1] as SideIndex[]) {
    const pick = picks[side];
    if (!over && replacing[side] && pick !== null) over = runner.sendOut(side, pick);
  }
  if (!over) runner.autoReplace();
  next.seq = (battle.seq ?? 0) + 1;
  next.lastTurn = { seq: next.seq, turn: next.turn, start, events: runner.events,
    weather: battle.weather?.kind ?? null,
    field: battle.field ? structuredClone(battle.field) : null,
  };
  next.log = [...battle.log, ...runner.events.map((event) => event.text)].slice(-80);
  return next;
}

export function resolveTurn(battle: Battle, choices: [BattleChoice, BattleChoice], random: RandomSource): Battle {
  if (battle.winner !== null) throw new Error("The battle is already over");
  if (battle.replacing) throw new Error("Waiting for a fainted Pokémon to be replaced");
  battle.sides.forEach((side, index) => {
    const error = choiceError(side, choices[index], battle.field ?? null);
    if (error) throw new Error(error);
  });

  const next = structuredClone(battle);
  next.turn += 1;
  const runner = new TurnRunner(next, random);
  const start: [ShownCombatant, ShownCombatant] = [shown(runner.active(0)), shown(runner.active(1))];

  // Switching always happens before moves, faster Pokémon first
  let over = false;
  if (choices.some((choice) => choice.kind === "switch")) {
    for (const side of speedOrder(next, random)) {
      const choice = choices[side];
      if (choice.kind === "switch" && runner.switchTo(side, choice.index)) {
        over = true;
        break;
      }
    }
  }

  // Moves go in priority order (Protect before Quick Attack before normal moves before Counter), then by speed
  const bySpeed = speedOrder(next, random);
  const priority = (side: SideIndex) => {
    const choice = choices[side];
    return choice.kind === "move" ? movePriority(chosenMove(runner.active(side), choice.index)) : 0;
  };
  const [first, second] = [priority(0), priority(1)];
  const order: SideIndex[] = first === second ? bySpeed : first > second ? [0, 1] : [1, 0];
  for (const side of over ? [] : order) {
    const choice = choices[side];
    if (choice.kind !== "move" || runner.fainted[side]) continue;
    if (runner.useMove(side, choice.index)) {
      over = true;
      break;
    }
  }
  if (!over) runner.endOfTurn(bySpeed);
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
    opponentMustReplace: isReplacing(battle, (1 - mySide) as SideIndex),
    turnEndsAt: toIso(timing.turnEndsAt),
    opponentAwayUntil: toIso(timing.awayUntil.get(theirs.userId)),
    chatMode: extras.chatModes.get(userId) ?? "public",
    spectators: extras.spectators,
    weather: battle.weather ?? null,
    field: battle.field ?? null,
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
