import { STAB_BONUS, type MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import { effectivenessAgainst } from "./typeChart.ts";

export const BATTLE_LEVEL = 50;
export const STRUGGLE: MoveInfo = { name: "struggle", type: "normal", category: "physical", power: 50 };

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
  stats: BattleStats;
  maxHp: number;
  hp: number;
  moves: MoveInfo[];
};

export type BattleSide = {
  userId: number;
  displayName: string;
  team: Combatant[];
  active: number;
};

export type Battle = {
  id: string;
  sides: [BattleSide, BattleSide];
  turn: number;
  log: string[];
  winner: number | null;
};

export type RandomSource = () => number;

export type OpponentView = {
  userId: number;
  displayName: string;
  active: Pick<Combatant, "name" | "spriteUrl" | "types" | "hp" | "maxHp">;
  remaining: number;
};

export type BattleView = {
  id: string;
  turn: number;
  log: string[];
  winner: number | null;
  me: BattleSide;
  opponent: OpponentView;
  hasChosen: boolean;
  opponentHasChosen: boolean;
};

function title(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function createCombatant(input: {
  name: string;
  spriteUrl: string;
  types: PokemonType[];
  baseStats: { name: string; value: number }[];
  moves: MoveInfo[];
}): Combatant {
  const base = (name: string) => input.baseStats.find((s) => s.name === name)?.value ?? 50;
  const stats: BattleStats = {
    hp: base("hp"),
    attack: base("attack"),
    defense: base("defense"),
    specialAttack: base("special-attack"),
    specialDefense: base("special-defense"),
    speed: base("speed"),
  };
  const damaging = input.moves.filter((move) => move.category !== "status" && move.power !== null);
  const maxHp = stats.hp * 2 + 110;

  return {
    name: input.name,
    spriteUrl: input.spriteUrl,
    types: input.types,
    stats,
    maxHp,
    hp: maxHp,
    moves: damaging.length > 0 ? damaging : [STRUGGLE],
  };
}

export function calculateDamage(
  attacker: Combatant,
  defender: Combatant,
  move: MoveInfo,
  random: RandomSource
): { damage: number; effectiveness: number } {
  const effectiveness = effectivenessAgainst(move.type, defender.types);
  if (effectiveness === 0) return { damage: 0, effectiveness };

  const physical = move.category === "physical";
  const attack = physical ? attacker.stats.attack : attacker.stats.specialAttack;
  const defense = physical ? defender.stats.defense : defender.stats.specialDefense;
  const levelFactor = (2 * BATTLE_LEVEL) / 5 + 2;
  const base = Math.floor((levelFactor * (move.power ?? 0) * attack) / defense / 50) + 2;

  const stab = attacker.types.includes(move.type) ? STAB_BONUS : 1;
  const roll = 0.85 + random() * 0.15;
  return { damage: Math.max(1, Math.floor(base * effectiveness * stab * roll)), effectiveness };
}

function effectNote(effectiveness: number): string {
  if (effectiveness === 0) return " It had no effect.";
  if (effectiveness > 1) return " It's super effective!";
  if (effectiveness < 1) return " It's not very effective.";
  return "";
}

function turnOrder(battle: Battle, random: RandomSource): (0 | 1)[] {
  const [a, b] = battle.sides.map((side) => side.team[side.active].stats.speed);
  if (a !== b) return a > b ? [0, 1] : [1, 0];
  return random() < 0.5 ? [0, 1] : [1, 0];
}

export function resolveTurn(battle: Battle, choices: [number, number], random: RandomSource): Battle {
  if (battle.winner !== null) throw new Error("The battle is already over");

  const next = structuredClone(battle);
  next.turn += 1;
  const log = [`Turn ${next.turn}`];
  const startActive = next.sides.map((side) => side.active);

  for (const sideIndex of turnOrder(next, random)) {
    const attackerSide = next.sides[sideIndex];
    const defenderSide = next.sides[1 - sideIndex];
    if (attackerSide.active !== startActive[sideIndex]) continue;

    const attacker = attackerSide.team[attackerSide.active];
    const defender = defenderSide.team[defenderSide.active];
    const move = attacker.moves[choices[sideIndex]] ?? attacker.moves[0];
    const { damage, effectiveness } = calculateDamage(attacker, defender, move, random);

    defender.hp = Math.max(0, defender.hp - damage);
    log.push(
      `${title(attacker.name)} used ${title(move.name)}.${effectNote(effectiveness)}` +
        (damage > 0 ? ` ${title(defender.name)} lost ${damage} HP.` : "")
    );

    if (defender.hp === 0) {
      log.push(`${title(defender.name)} fainted!`);
      const replacement = defenderSide.team.findIndex((combatant) => combatant.hp > 0);
      if (replacement === -1) {
        next.winner = attackerSide.userId;
        log.push(`${attackerSide.displayName} wins the battle!`);
        break;
      }
      defenderSide.active = replacement;
      log.push(`${defenderSide.displayName} sent out ${title(defenderSide.team[replacement].name)}.`);
    }
  }

  next.log = [...battle.log, ...log].slice(-40);
  return next;
}

export function viewFor(battle: Battle, userId: number, chosen: ReadonlySet<number>): BattleView {
  const mine = battle.sides.find((side) => side.userId === userId);
  const theirs = battle.sides.find((side) => side.userId !== userId);
  if (!mine || !theirs) throw new Error("Not a player in this battle");

  const { name, spriteUrl, types, hp, maxHp } = theirs.team[theirs.active];
  return {
    id: battle.id,
    turn: battle.turn,
    log: battle.log,
    winner: battle.winner,
    me: mine,
    opponent: {
      userId: theirs.userId,
      displayName: theirs.displayName,
      active: { name, spriteUrl, types, hp, maxHp },
      remaining: theirs.team.filter((combatant) => combatant.hp > 0).length,
    },
    hasChosen: chosen.has(userId),
    opponentHasChosen: chosen.has(theirs.userId),
  };
}