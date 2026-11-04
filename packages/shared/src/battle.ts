import { STAB_BONUS, type BoostStat, type MoveInfo, type StatChange, type StatusCondition } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import { rulesetOf, type Ruleset, type RulesetId } from "./rulesets.ts";
import { effectivenessAgainst } from "./typeChart.ts";

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
};

/** What anyone watching the battle can see of a Pokémon */
export type ShownCombatant = Pick<Combatant, "name" | "spriteUrl" | "types" | "level" | "hp" | "maxHp" | "status" | "boosts">;

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

/** Damaging moves without a fixed power (Seismic Toss, Counter…) aren't supported yet */
export function isUsableMove(move: MoveInfo): boolean {
  return move.category === "status" || move.power !== null;
}

export function createCombatant(input: {
  name: string;
  spriteUrl: string;
  types: PokemonType[];
  baseStats: { name: string; value: number }[];
  moves: MoveInfo[];
  level: number;
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
  };
}

export function shown(combatant: Combatant): ShownCombatant {
  const { name, spriteUrl, types, level, hp, maxHp, status, boosts } = combatant;
  return { name, spriteUrl, types, level, hp, maxHp, status, boosts: { ...boosts } };
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

export function calculateDamage(
  attacker: Combatant,
  defender: Combatant,
  move: MoveInfo,
  random: RandomSource,
  critical = false
): { damage: number; effectiveness: number; critical: boolean } {
  const effectiveness = effectivenessAgainst(move.type, defender.types);
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
  const defense = Math.floor(
    (physical ? defender.stats.defense : defender.stats.specialDefense) * stageMultiplier(defenseStage)
  );
  const levelFactor = (2 * attacker.level) / 5 + 2;
  const base = Math.floor((levelFactor * (move.power ?? 0) * attack) / defense / 50) + 2;

  const stab = attacker.types.includes(move.type) ? STAB_BONUS : 1;
  const crit = critical ? CRIT_MULTIPLIER : 1;
  const burn = physical && attacker.status === "burn" ? 0.5 : 1;
  const roll = 0.85 + random() * 0.15;
  return {
    damage: Math.max(1, Math.floor(base * effectiveness * stab * crit * burn * roll)),
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

function turnOrder(battle: Battle, random: RandomSource): SideIndex[] {
  const [a, b] = battle.sides.map((side) => effectiveSpeed(side.team[side.active]));
  if (a !== b) return a > b ? [0, 1] : [1, 0];
  return random() < 0.5 ? [0, 1] : [1, 0];
}

/** Checks a choice against the battle. Returns an error message, or null when it's allowed. */
export function choiceError(side: BattleSide, choice: BattleChoice): string | null {
  if (choice.kind === "move") {
    return choice.index < side.team[side.active].moves.length ? null : "That move doesn't exist";
  }
  const member = side.team[choice.index];
  if (!member) return "That Pokémon isn't on your team";
  if (choice.index === side.active) return `${title(member.name)} is already in battle`;
  if (member.hp === 0) return `${title(member.name)} has fainted`;
  return null;
}

class TurnRunner {
  readonly events: BattleEvent[] = [];
  readonly battle: Battle;
  readonly random: RandomSource;
  /** Sides whose Pokémon fainted this turn; their replacement doesn't get to act */
  readonly fainted: [boolean, boolean] = [false, false];

  constructor(battle: Battle, random: RandomSource) {
    this.battle = battle;
    this.random = random;
  }

  emit(side: SideIndex, text: string, body: EventBody) {
    this.events.push({ side, text, ...body } as BattleEvent);
  }

  active(side: SideIndex): Combatant {
    const battleSide = this.battle.sides[side];
    return battleSide.team[battleSide.active];
  }

  switchTo(side: SideIndex, index: number) {
    const battleSide = this.battle.sides[side];
    const outgoing = this.active(side);
    outgoing.boosts = {};
    this.emit(side, `${battleSide.displayName} withdrew ${title(outgoing.name)}!`, { kind: "withdraw" });
    battleSide.active = index;
    const incoming = this.active(side);
    this.emit(side, `${battleSide.displayName} sent out ${title(incoming.name)}!`, {
      kind: "switch",
      combatant: shown(incoming),
    });
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

  sendOut(side: SideIndex, index: number) {
    const battleSide = this.battle.sides[side];
    battleSide.active = index;
    const next = this.active(side);
    this.emit(side, `${battleSide.displayName} sent out ${title(next.name)}!`, {
      kind: "switch",
      combatant: shown(next),
    });
  }

  /** Sends in the only Pokémon left when there's nothing to choose */
  autoReplace() {
    if (this.battle.winner !== null || !this.battle.replacing) return;
    for (const side of [0, 1] as SideIndex[]) {
      if (!this.battle.replacing[side]) continue;
      const options = healthyBench(this.battle.sides[side]);
      if (options.length === 1) {
        this.sendOut(side, options[0]);
        this.battle.replacing[side] = false;
      }
    }
    if (!this.battle.replacing.some(Boolean)) this.battle.replacing = undefined;
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
    const odds = accuracy * accuracyMultiplier(stage(attacker, "accuracy") - stage(defender, "evasion"));
    return this.random() * 100 < odds;
  }

  inflict(side: SideIndex, combatant: Combatant, status: StatusCondition) {
    combatant.status = status;
    if (status === "sleep") combatant.sleepTurns = 1 + Math.floor(this.random() * 3);
    this.emit(side, `${title(combatant.name)} ${STATUS_INFLICTED[status]}`, { kind: "status", status });
  }

  changeStats(side: SideIndex, combatant: Combatant, changes: readonly StatChange[]) {
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
    const move = attacker.moves[moveIndex] ?? attacker.moves[0];
    if (!this.canAct(side, move)) return false;

    this.emit(side, `${title(attacker.name)} used ${title(move.name)}.`, {
      kind: "move",
      move: move.name,
      moveType: move.type,
    });

    const needsFoe =
      move.category !== "status" || Boolean(move.ailment) || ((move.statChanges ?? []).length > 0 && move.statTarget !== "user");
    if (needsFoe && this.active(target).hp === 0) {
      this.emit(side, "But there was no target!", { kind: "fail" });
      return false;
    }

    if (move.category === "status") {
      this.statusMove(side, target, move);
      return false;
    }
    return this.attack(side, target, move);
  }

  statusMove(side: SideIndex, target: SideIndex, move: MoveInfo) {
    const user = this.active(side);
    const foe = this.active(target);
    const ailment = move.ailment ?? null;
    const statChanges = move.statChanges ?? [];
    const hitsFoe = ailment !== null || (statChanges.length > 0 && move.statTarget !== "user");

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

    let didSomething = false;
    if (ailment) {
      if (canReceiveStatus(foe, ailment)) {
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
      else this.changeStats(target, foe, statChanges);
      didSomething = true;
    }
    if ((move.healing ?? 0) > 0) {
      if (user.hp === user.maxHp) {
        this.emit(side, `${title(user.name)}'s HP is full!`, { kind: "fail" });
      } else {
        const amount = Math.max(1, Math.floor((user.maxHp * (move.healing ?? 0)) / 100));
        this.heal(side, user, amount, `${title(user.name)} regained health!`);
      }
      didSomething = true;
    }
    if (!didSomething) this.emit(side, "But nothing happened!", { kind: "fail" });
  }

  /** A damaging move. Returns true when the battle ended. */
  attack(side: SideIndex, target: SideIndex, move: MoveInfo): boolean {
    const attacker = this.active(side);
    const defender = this.active(target);
    const defenderName = title(defender.name);

    if (!this.hits(attacker, defender, move)) {
      this.emit(target, `${defenderName} avoided the attack!`, { kind: "miss" });
      return false;
    }

    if (effectivenessAgainst(move.type, defender.types) === 0) {
      this.emit(target, `It doesn't affect ${defenderName}…`, { kind: "immune" });
      return false;
    }

    const critical = this.random() < criticalChance(move);
    const { damage, effectiveness } = calculateDamage(attacker, defender, move, this.random, critical);
    defender.hp = Math.max(0, defender.hp - damage);
    this.emit(
      target,
      `${critical ? "A critical hit! " : ""}${effectNote(effectiveness)}${defenderName} lost ${damage} HP.`,
      { kind: "damage", amount: damage, hp: defender.hp, effectiveness, critical }
    );

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
      else if (move.statTarget !== "user" && defender.hp > 0) this.changeStats(target, defender, statChanges);
    }
    const ailment = move.ailment ?? null;
    if (ailment && canReceiveStatus(defender, ailment) && this.random() * 100 < (move.ailmentChance || 100)) {
      this.inflict(target, defender, ailment);
    }

    if (defender.hp === 0 && this.faint(target)) return true;
    if (attacker.hp === 0 && this.faint(side)) return true;
    return false;
  }

  /** Burn and poison damage. Returns true when the battle ended. */
  endOfTurn(order: SideIndex[]): boolean {
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
    return false;
  }
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
  for (const side of [0, 1] as SideIndex[]) {
    const pick = picks[side];
    if (next.replacing![side] && pick !== null) runner.sendOut(side, pick);
  }
  next.replacing = undefined;
  next.seq = (battle.seq ?? 0) + 1;
  next.lastTurn = { seq: next.seq, turn: next.turn, start, events: runner.events };
  next.log = [...battle.log, ...runner.events.map((event) => event.text)].slice(-80);
  return next;
}

export function resolveTurn(battle: Battle, choices: [BattleChoice, BattleChoice], random: RandomSource): Battle {
  if (battle.winner !== null) throw new Error("The battle is already over");
  if (battle.replacing) throw new Error("Waiting for a fainted Pokémon to be replaced");
  battle.sides.forEach((side, index) => {
    const error = choiceError(side, choices[index]);
    if (error) throw new Error(error);
  });

  const next = structuredClone(battle);
  next.turn += 1;
  const runner = new TurnRunner(next, random);
  const start: [ShownCombatant, ShownCombatant] = [shown(runner.active(0)), shown(runner.active(1))];

  // Switching always happens before moves, faster Pokémon first
  if (choices.some((choice) => choice.kind === "switch")) {
    for (const side of turnOrder(next, random)) {
      const choice = choices[side];
      if (choice.kind === "switch") runner.switchTo(side, choice.index);
    }
  }

  const order = turnOrder(next, random);
  let over = false;
  for (const side of order) {
    const choice = choices[side];
    if (choice.kind !== "move" || runner.fainted[side]) continue;
    if (runner.useMove(side, choice.index)) {
      over = true;
      break;
    }
  }
  if (!over) runner.endOfTurn(order);
  runner.autoReplace();

  next.seq = (battle.seq ?? 0) + 1;
  next.lastTurn = { seq: next.seq, turn: next.turn, start, events: runner.events };
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
