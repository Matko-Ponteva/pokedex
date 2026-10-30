import { describe, expect, it } from "vitest";
import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import {
  STRUGGLE, calculateDamage, createCombatant, resolveTurn, viewFor,
  type Battle, type BattleStats, type Combatant,
} from "./battle.ts";

const maxRoll = () => 1;
const minRoll = () => 0;
const hit: MoveInfo = { name: "test-hit", type: "normal", category: "physical", power: 100 };
const blast: MoveInfo = { name: "test-blast", type: "normal", category: "special", power: 100 };

function fighter(types: PokemonType[], stats: Partial<BattleStats> = {}, hp = 200): Combatant {
  return {
    name: "test",
    spriteUrl: "",
    types,
    stats: {
      hp: 50, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100,
      ...stats,
    },
    maxHp: 200,
    hp,
    moves: [hit],
  };
}

function battleOf(a: Combatant[], b: Combatant[]): Battle {
  return {
    id: "test-battle",
    turn: 0,
    log: [],
    winner: null,
    sides: [
      { userId: 1, displayName: "Ash", team: a, active: 0 },
      { userId: 2, displayName: "Brock", team: b, active: 0 },
    ],
  };
}

describe("calculateDamage", () => {
  it("follows the formula for a neutral hit", () => {
    // floor(22 * 100 * 100 / 100 / 50) + 2 = 46
    expect(calculateDamage(fighter(["water"]), fighter(["water"]), hit, maxRoll).damage).toBe(46);
  });

  it("adds STAB when the move matches the attacker's type", () => {
    expect(calculateDamage(fighter(["normal"]), fighter(["water"]), hit, maxRoll).damage).toBe(69);
  });

  it("applies type effectiveness", () => {
    expect(calculateDamage(fighter(["water"]), fighter(["rock"]), hit, maxRoll)).toEqual({
      damage: 23,
      effectiveness: 0.5,
    });
    expect(calculateDamage(fighter(["water"]), fighter(["ghost"]), hit, maxRoll).damage).toBe(0);
  });

  it("uses special stats for special moves", () => {
    const attacker = fighter(["water"], { specialAttack: 200 });
    expect(calculateDamage(attacker, fighter(["water"]), blast, maxRoll).damage).toBe(90);
  });

  it("scales damage down with a low roll", () => {
    expect(calculateDamage(fighter(["water"]), fighter(["water"]), hit, minRoll).damage).toBe(39);
  });
});

describe("createCombatant", () => {
  it("falls back to Struggle without damaging moves", () => {
    const growl: MoveInfo = { name: "growl", type: "normal", category: "status", power: null };
    const combatant = createCombatant({
      name: "charizard",
      spriteUrl: "",
      types: ["fire", "flying"],
      baseStats: [{ name: "hp", value: 78 }],
      moves: [growl],
    });
    expect(combatant.moves).toEqual([STRUGGLE]);
    expect(combatant.maxHp).toBe(266);
  });
});

describe("resolveTurn", () => {
  it("lets the faster Pokémon move first, and a fainted one can't strike back", () => {
    const fast = fighter(["water"], { speed: 150 });
    const fragile = fighter(["water"], { speed: 50 }, 10);
    const backup = fighter(["water"]);
    const after = resolveTurn(battleOf([fast], [fragile, backup]), [0, 0], maxRoll);

    expect(after.sides[1].team[0].hp).toBe(0);
    expect(after.sides[1].active).toBe(1);
    expect(after.sides[0].team[0].hp).toBe(200);
    expect(after.winner).toBeNull();
  });

  it("declares a winner when a side runs out of Pokémon", () => {
    const after = resolveTurn(
      battleOf([fighter(["water"], { speed: 150 })], [fighter(["water"], { speed: 50 }, 10)]),
      [0, 0],
      maxRoll
    );
    expect(after.winner).toBe(1);
    expect(after.log.at(-1)).toBe("Ash wins the battle!");
  });

  it("doesn't change the battle it receives", () => {
    const before = battleOf([fighter(["water"])], [fighter(["water"])]);
    resolveTurn(before, [0, 0], maxRoll);
    expect(before.sides[1].team[0].hp).toBe(200);
    expect(before.turn).toBe(0);
  });
});

describe("viewFor", () => {
  it("hides the opponent's moves and bench", () => {
    const view = viewFor(battleOf([fighter(["water"])], [fighter(["fire"]), fighter(["grass"])]), 1, new Set([2]));
    expect(view.opponent.active).not.toHaveProperty("moves");
    expect(view.opponent.remaining).toBe(2);
    expect(view).toMatchObject({ hasChosen: false, opponentHasChosen: true });
  });
});