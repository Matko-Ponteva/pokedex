import { describe, expect, it } from "vitest";
import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import { emptyField, type FieldState } from "./field.ts";
import {
  STRUGGLE, battleSprites, calculateDamage, choiceError, isUsableMove, replacementError, resolveReplacements, createCombatant, resolveTurn, spectatorView, viewFor,
  type Battle, type BattleChoice, type BattleStats, type Combatant,
} from "./battle.ts";

const maxRoll = () => 1;
const FIGHT: [BattleChoice, BattleChoice] = [{ kind: "move", index: 0 }, { kind: "move", index: 0 }];
const minRoll = () => 0;
const hit: MoveInfo = { name: "test-hit", type: "normal", category: "physical", power: 100 };
const blast: MoveInfo = { name: "test-blast", type: "normal", category: "special", power: 100 };

function fighter(types: PokemonType[], stats: Partial<BattleStats> = {}, hp = 200): Combatant {
  return {
    name: "test",
    spriteUrl: "",
    types,
    level: 50,
    stats: {
      hp: 50, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100,
      ...stats,
    },
    maxHp: 200,
    hp,
    moves: [hit],
    status: null,
    sleepTurns: 0,
    boosts: {},
  };
}

function battleOf(a: Combatant[], b: Combatant[]): Battle {
  return {
    id: "test-battle",
    ruleset: "standard",
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
      critical: false,
    });
    expect(calculateDamage(fighter(["water"]), fighter(["ghost"]), hit, maxRoll).damage).toBe(0);
  });

  it("uses special stats for special moves", () => {
    const attacker = fighter(["water"], { specialAttack: 200 });
    expect(calculateDamage(attacker, fighter(["water"]), blast, maxRoll).damage).toBe(90);
  });

  it("multiplies critical hits by 1.5", () => {
    expect(calculateDamage(fighter(["water"]), fighter(["water"]), hit, maxRoll, true).damage).toBe(69);
  });

  it("halves physical damage from a burned attacker", () => {
    const burned = { ...fighter(["water"]), status: "burn" as const };
    expect(calculateDamage(burned, fighter(["water"]), hit, maxRoll).damage).toBe(23);
    expect(calculateDamage(burned, fighter(["water"]), blast, maxRoll).damage).toBe(46);
  });

  it("scales damage down with a low roll", () => {
    expect(calculateDamage(fighter(["water"]), fighter(["water"]), hit, minRoll).damage).toBe(39);
  });
});

describe("createCombatant", () => {
  it("keeps Counter and fixed-damage moves", () => {
    const counter: MoveInfo = { name: "counter", type: "fighting", category: "physical", power: null, priority: -5 };
    const seismicToss: MoveInfo = { name: "seismic-toss", type: "fighting", category: "physical", power: null };
    expect(
      createCombatant({ name: "primeape", spriteUrl: "", types: ["fighting"], baseStats: [], moves: [counter, seismicToss], level: 50 }).moves
    ).toEqual([counter, seismicToss]);
  });

  it("keeps status moves, and falls back to Struggle without usable moves", () => {
    const growl: MoveInfo = { name: "growl", type: "normal", category: "status", power: null };
    const fling: MoveInfo = { name: "fling", type: "dark", category: "physical", power: null };
    expect(
      createCombatant({ name: "x", spriteUrl: "", types: ["normal"], baseStats: [], moves: [growl, fling], level: 50 }).moves
    ).toEqual([growl]);
    const combatant = createCombatant({
      name: "charizard",
      spriteUrl: "",
      types: ["fire", "flying"],
      baseStats: [{ name: "hp", value: 78 }],
      moves: [fling],
      level: 50,
    });
    expect(combatant.moves).toEqual([STRUGGLE]);
  });

  it("computes stats for the level, like the games with perfect IVs", () => {
    const charizard = (level: number) =>
      createCombatant({
        name: "charizard",
        spriteUrl: "",
        types: ["fire", "flying"],
        baseStats: [
          { name: "hp", value: 78 },
          { name: "special-attack", value: 109 },
          { name: "speed", value: 100 },
        ],
        moves: [],
        level,
      });
    expect(charizard(50)).toMatchObject({ level: 50, maxHp: 153, hp: 153, stats: { specialAttack: 129, speed: 120 } });
    expect(charizard(100)).toMatchObject({ maxHp: 297, stats: { specialAttack: 254 } });
  });
});

describe("resolveTurn", () => {
  it("lets the faster Pokémon move first, and a fainted one can't strike back", () => {
    const fast = fighter(["water"], { speed: 150 });
    const fragile = fighter(["water"], { speed: 50 }, 10);
    const backup = fighter(["water"]);
    const after = resolveTurn(battleOf([fast], [fragile, backup]), FIGHT, maxRoll);

    expect(after.sides[1].team[0].hp).toBe(0);
    expect(after.sides[1].active).toBe(1);
    expect(after.sides[0].team[0].hp).toBe(200);
    expect(after.winner).toBeNull();
  });

  it("declares a winner when a side runs out of Pokémon", () => {
    const after = resolveTurn(
      battleOf([fighter(["water"], { speed: 150 })], [fighter(["water"], { speed: 50 }, 10)]),
      FIGHT,
      maxRoll
    );
    expect(after.winner).toBe(1);
    expect(after.log.at(-1)).toBe("Ash wins the battle!");
  });

  it("doesn't change the battle it receives", () => {
    const before = battleOf([fighter(["water"])], [fighter(["water"])]);
    resolveTurn(before, FIGHT, maxRoll);
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

  it("reports the turn deadline and an absent opponent", () => {
    const battle = battleOf([fighter(["water"])], [fighter(["fire"])]);
    const view = viewFor(battle, 1, new Set(), {
      turnEndsAt: Date.UTC(2026, 0, 1, 12, 0, 45),
      awayUntil: new Map([[2, Date.UTC(2026, 0, 1, 12, 0, 30)]]),
    });
    expect(view.turnEndsAt).toBe("2026-01-01T12:00:45.000Z");
    expect(view.opponentAwayUntil).toBe("2026-01-01T12:00:30.000Z");
    expect(viewFor(battle, 2, new Set()).opponentAwayUntil).toBeNull();
  });
});

/** Returns the given numbers in order, then keeps repeating the last one */
function script(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const kinds = (battle: Battle) => battle.lastTurn?.events.map((event) => event.kind);

describe("resolveTurn events", () => {
  it("records a turn's events, and the log matches them", () => {
    const after = resolveTurn(battleOf([fighter(["water"], { speed: 150 })], [fighter(["water"])]), FIGHT, maxRoll);
    expect(kinds(after)).toEqual(["move", "damage", "move", "damage"]);
    expect(after.lastTurn?.start[1].hp).toBe(200);
    expect(after.log).toEqual(["Turn 1", ...after.lastTurn!.events.map((event) => event.text)]);
    expect(after.lastTurn?.events[1]).toMatchObject({ side: 1, kind: "damage", amount: 46, hp: 154 });
  });

  it("misses when the accuracy roll fails, and never misses without accuracy", () => {
    const a = fighter(["water"], { speed: 150 });
    a.moves = [{ ...hit, accuracy: 70 }];
    // 0.8 * 100 >= 70 is a miss; the defender's move has no accuracy roll
    const after = resolveTurn(battleOf([a], [fighter(["water"])]), FIGHT, script(0.8, 0.5, 1));
    expect(kinds(after)).toEqual(["move", "miss", "move", "damage"]);
    expect(after.sides[1].team[0].hp).toBe(200);
  });

  it("reports type immunity", () => {
    const after = resolveTurn(battleOf([fighter(["water"], { speed: 150 })], [fighter(["ghost"])]), FIGHT, maxRoll);
    expect(after.lastTurn?.events[1]).toMatchObject({ side: 1, kind: "immune" });
  });

  it("lands critical hits", () => {
    const after = resolveTurn(battleOf([fighter(["water"], { speed: 150 })], [fighter(["water"])]), FIGHT, script(0, 1));
    expect(after.lastTurn?.events[1]).toMatchObject({ kind: "damage", critical: true, amount: 69 });
  });

  it("inflicts a status from the move, but not on an immune type", () => {
    const ember: MoveInfo = {
      name: "ember", type: "fire", category: "special", power: 40, ailment: "burn", ailmentChance: 10,
    };
    const a = fighter(["water"], { speed: 150 });
    a.moves = [ember];
    // crit roll, damage roll, then 0.05 * 100 < 10 burns
    const burned = resolveTurn(battleOf([a], [fighter(["water"])]), FIGHT, script(1, 1, 0.05, 1));
    expect(burned.sides[1].team[0].status).toBe("burn");
    expect(kinds(burned)).toContain("status");

    const safe = resolveTurn(battleOf([a], [fighter(["fire"])]), FIGHT, script(1, 1, 0.05, 1));
    expect(safe.sides[1].team[0].status).toBeNull();
  });

  it("treats an ailment chance of 0 as always", () => {
    const a = fighter(["water"], { speed: 150 });
    a.moves = [{ ...hit, ailment: "paralysis", ailmentChance: 0 }];
    const after = resolveTurn(battleOf([a], [fighter(["water"])]), FIGHT, script(1, 1, 0.99, 1));
    expect(after.sides[1].team[0].status).toBe("paralysis");
  });

  it("deals burn and poison damage at the end of the turn", () => {
    const burned = { ...fighter(["water"], { speed: 150 }), status: "burn" as const };
    const poisoned = { ...fighter(["water"]), status: "poison" as const };
    const after = resolveTurn(battleOf([burned], [poisoned]), FIGHT, maxRoll);
    expect(after.lastTurn!.events.slice(-2)).toMatchObject([
      { side: 0, kind: "status-damage", status: "burn", amount: 12 },
      { side: 1, kind: "status-damage", status: "poison", amount: 25 },
    ]);
  });

  it("can faint and switch from status damage", () => {
    // Both are Ghosts, so neither Normal move lands
    const poisoned = { ...fighter(["ghost"], { speed: 150 }, 10), status: "poison" as const };
    const after = resolveTurn(battleOf([poisoned, fighter(["water"])], [fighter(["ghost"])]), FIGHT, maxRoll);
    expect(kinds(after)?.slice(-3)).toEqual(["status-damage", "faint", "switch"]);
    expect(after.sides[0].active).toBe(1);
    expect(after.winner).toBeNull();
  });

  it("keeps a sleeping Pokémon from moving until it wakes up", () => {
    const sleeper = { ...fighter(["water"], { speed: 150 }), status: "sleep" as const, sleepTurns: 1 };
    const first = resolveTurn(battleOf([sleeper], [fighter(["water"])]), FIGHT, maxRoll);
    expect(first.lastTurn?.events[0]).toMatchObject({ kind: "cant-move", status: "sleep" });

    const second = resolveTurn(first, FIGHT, maxRoll);
    expect(second.lastTurn?.events.slice(0, 2)).toMatchObject([{ kind: "cured", status: "sleep" }, { kind: "move" }]);
    expect(second.sides[0].team[0].status).toBeNull();
  });

  it("thaws a frozen Pokémon by chance or with a fire move", () => {
    const frozen = { ...fighter(["water"], { speed: 150 }), status: "freeze" as const };
    const stuck = resolveTurn(battleOf([frozen], [fighter(["water"])]), FIGHT, maxRoll);
    expect(stuck.lastTurn?.events[0]).toMatchObject({ kind: "cant-move", status: "freeze" });

    const thawed = resolveTurn(battleOf([frozen], [fighter(["water"])]), FIGHT, script(0.1, 1));
    expect(thawed.lastTurn?.events[0]).toMatchObject({ kind: "cured", status: "freeze" });

    const fiery = { ...frozen, moves: [{ ...hit, type: "fire" as const }] };
    const fired = resolveTurn(battleOf([fiery], [fighter(["water"])]), FIGHT, maxRoll);
    expect(fired.lastTurn?.events[0]).toMatchObject({ kind: "cured", status: "freeze" });
  });

  it("halves speed and sometimes stops a paralyzed Pokémon", () => {
    // 75 effective speed is slower than 100, so the opponent moves first
    const paralyzed = { ...fighter(["water"], { speed: 150 }), status: "paralysis" as const };
    const after = resolveTurn(battleOf([paralyzed], [fighter(["water"])]), FIGHT, script(1, 1, 0.1));
    expect(after.lastTurn?.events[0]).toMatchObject({ side: 1, kind: "move" });
    expect(after.lastTurn?.events.at(-1)).toMatchObject({ side: 0, kind: "cant-move", status: "paralysis" });
  });
});

describe("spectatorView", () => {
  it("includes the ruleset", () => {
    const view = spectatorView(battleOf([fighter(["water"])], [fighter(["fire"])]), new Set());
    expect(view.ruleset).toMatchObject({ id: "standard", level: 50 });
    expect(view.sides[0].active.level).toBe(50);
  });

  it("shows both active Pokémon without moves", () => {
    const view = spectatorView(battleOf([fighter(["water"])], [fighter(["fire"])]), new Set([1]));
    expect(view.sides[0].active).not.toHaveProperty("moves");
    expect(view.chosen).toEqual([true, false]);
    expect(view.sides[1].teamSize).toBe(1);
  });
});

describe("battleSprites", () => {
  it("derives animated and back sprites", () => {
    const sprites = battleSprites("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png");
    expect(sprites.back[0]).toMatch(/other\/showdown\/back\/6\.gif$/);
    expect(sprites.back[1]).toMatch(/pokemon\/back\/6\.png$/);
    expect(sprites.front.at(-1)).toMatch(/pokemon\/6\.png$/);
  });
});
describe("status and stat moves", () => {
  const willOWisp: MoveInfo = { name: "will-o-wisp", type: "fire", category: "status", power: null, accuracy: 85, ailment: "burn", ailmentChance: 0 };
  const swordsDance: MoveInfo = { name: "swords-dance", type: "normal", category: "status", power: null, statChanges: [{ stat: "attack", change: 2 }], statTarget: "user" };
  const scaryFace: MoveInfo = { name: "scary-face", type: "normal", category: "status", power: null, accuracy: 100, statChanges: [{ stat: "speed", change: -2 }], statTarget: "target" };
  const recover: MoveInfo = { name: "recover", type: "normal", category: "status", power: null, healing: 50 };
  const splash: MoveInfo = { name: "splash", type: "normal", category: "status", power: null };

  /** An opponent that does nothing */
  const idle = () => ({ ...fighter(["water"]), moves: [splash] });

  function user(moves: MoveInfo[], hp = 200) {
    const combatant = fighter(["water"], { speed: 150 }, hp);
    combatant.moves = moves;
    return combatant;
  }

  it("inflicts a status with a status move, unless it misses or can't", () => {
    const burned = resolveTurn(battleOf([user([willOWisp])], [fighter(["water"])]), FIGHT, script(0.5, 1));
    expect(burned.sides[1].team[0].status).toBe("burn");

    const missed = resolveTurn(battleOf([user([willOWisp])], [fighter(["water"])]), FIGHT, script(0.9, 1));
    expect(missed.lastTurn?.events[1]).toMatchObject({ kind: "miss" });

    const fireType = resolveTurn(battleOf([user([willOWisp])], [fighter(["fire"])]), FIGHT, script(0.5, 1));
    expect(fireType.lastTurn?.events[1]).toMatchObject({ kind: "fail", text: "But it failed!" });
  });

  it("raises the user's stats, which boosts its damage, up to +6", () => {
    const boosted = resolveTurn(battleOf([user([swordsDance, hit])], [fighter(["water"])]), FIGHT, maxRoll);
    expect(boosted.sides[0].team[0].boosts.attack).toBe(2);
    expect(boosted.lastTurn?.events[1]).toMatchObject({ side: 0, kind: "stat", stat: "attack", change: 2, text: "Test's Attack rose sharply!" });

    const strike = resolveTurn(boosted, [{ kind: "move", index: 1 }, { kind: "move", index: 0 }], maxRoll);
    expect(strike.lastTurn?.events[1]).toMatchObject({ kind: "damage", amount: 90 });

    const maxed = { ...user([swordsDance]), boosts: { attack: 6 } };
    const capped = resolveTurn(battleOf([maxed], [fighter(["water"])]), FIGHT, maxRoll);
    expect(capped.lastTurn?.events[1]).toMatchObject({ kind: "stat", change: 0, text: "Test's Attack won't go any higher!" });
  });

  it("lowers the target's stats, which can change who moves first", () => {
    const slow = fighter(["water"], { speed: 100 });
    slow.moves = [scaryFace];
    const fast = fighter(["water"], { speed: 120 });
    // Turn 1: the faster Pokémon moves first, then Scary Face drops its speed to 60
    // The fast one's crit and damage rolls, then Scary Face's accuracy roll
    const first = resolveTurn(battleOf([slow], [fast]), FIGHT, script(1, 1, 0.5));
    expect(first.lastTurn?.events[0]).toMatchObject({ side: 1, kind: "move" });
    expect(first.sides[1].team[0].boosts.speed).toBe(-2);
    const second = resolveTurn(first, FIGHT, script(0.5, 1, 1));
    expect(second.lastTurn?.events[0]).toMatchObject({ side: 0, kind: "move", move: "scary-face" });
  });

  it("heals with recovery moves, and fails at full HP", () => {
    const healed = resolveTurn(battleOf([user([recover], 50)], [idle()]), FIGHT, maxRoll);
    expect(healed.sides[0].team[0].hp).toBe(150);
    expect(healed.lastTurn?.events[1]).toMatchObject({ kind: "heal", amount: 100, hp: 150 });

    const full = resolveTurn(battleOf([user([recover])], [idle()]), FIGHT, maxRoll);
    expect(full.lastTurn?.events[1]).toMatchObject({ kind: "fail" });
  });

  it("says nothing happened for effects it doesn't support", () => {
    const after = resolveTurn(battleOf([user([splash])], [idle()]), FIGHT, maxRoll);
    expect(after.lastTurn?.events[1]).toMatchObject({ kind: "fail", text: "But nothing happened!" });
  });

  it("drains HP and takes recoil from damaging moves", () => {
    const drained = resolveTurn(battleOf([user([{ ...hit, drain: 50 }], 100)], [fighter(["ghost"])]), FIGHT, maxRoll);
    // Normal moves can't hit the Ghost, so test against a Water type instead
    expect(drained.lastTurn?.events[1]).toMatchObject({ kind: "immune" });

    const drain = resolveTurn(battleOf([user([{ ...hit, drain: 50 }], 100)], [fighter(["water"])]), FIGHT, maxRoll);
    expect(drain.lastTurn?.events.slice(1, 3)).toMatchObject([{ kind: "damage", amount: 46 }, { side: 0, kind: "heal", amount: 23 }]);

    const recoil = resolveTurn(battleOf([user([{ ...hit, drain: -33 }])], [fighter(["water"])]), FIGHT, maxRoll);
    expect(recoil.lastTurn?.events[2]).toMatchObject({ side: 0, kind: "recoil", amount: 15, hp: 185 });
  });

  it("applies secondary stat changes from damaging moves by chance", () => {
    const crunch: MoveInfo = { ...hit, statChanges: [{ stat: "defense", change: -1 }], statTarget: "target", statChance: 20 };
    // crit roll, damage roll, then 0.1 * 100 < 20
    const after = resolveTurn(battleOf([user([crunch])], [fighter(["water"])]), FIGHT, script(1, 1, 0.1, 1));
    expect(after.sides[1].team[0].boosts.defense).toBe(-1);
    const unlucky = resolveTurn(battleOf([user([crunch])], [fighter(["water"])]), FIGHT, script(1, 1, 0.5, 1));
    expect(unlucky.sides[1].team[0].boosts.defense).toBeUndefined();
  });
});

describe("switching", () => {
  it("switches before moves, and the incoming Pokémon takes the hit", () => {
    const boosted = { ...fighter(["water"], { speed: 50 }), boosts: { attack: 2 } };
    const bench = fighter(["rock"]);
    const after = resolveTurn(
      battleOf([boosted, bench], [fighter(["water"], { speed: 150 })]),
      [{ kind: "switch", index: 1 }, { kind: "move", index: 0 }],
      maxRoll
    );
    expect(kinds(after)).toEqual(["withdraw", "switch", "move", "damage"]);
    expect(after.sides[0].active).toBe(1);
    expect(after.sides[0].team[1].hp).toBe(177);
    expect(after.sides[0].team[0].boosts).toEqual({});
    expect(after.log).toContain("Ash withdrew Test!");
  });

  it("rejects switching to the active or a fainted Pokémon", () => {
    const battle = battleOf([fighter(["water"]), fighter(["water"], {}, 0)], [fighter(["water"])]);
    expect(choiceError(battle.sides[0], { kind: "switch", index: 0 })).toMatch(/already in battle/);
    expect(choiceError(battle.sides[0], { kind: "switch", index: 1 })).toMatch(/fainted/);
    expect(choiceError(battle.sides[0], { kind: "switch", index: 5 })).toMatch(/isn't on your team/);
    expect(choiceError(battle.sides[0], { kind: "move", index: 3 })).toMatch(/doesn't exist/);
    expect(() => resolveTurn(battle, [{ kind: "switch", index: 1 }, FIGHT[1]], maxRoll)).toThrow();
  });
});

describe("replacing a fainted Pokémon", () => {
  const fast = () => fighter(["water"], { speed: 150 });

  it("waits for the player to choose when more than one Pokémon is left", () => {
    const battle = battleOf([fast()], [fighter(["water"], {}, 10), fighter(["fire"]), fighter(["grass"])]);
    const after = resolveTurn(battle, FIGHT, maxRoll);
    expect(kinds(after)).toEqual(["move", "damage", "faint"]);
    expect(after.replacing).toEqual([false, true]);
    expect(after.sides[1].active).toBe(0);
    expect(viewFor(after, 2, new Set())).toMatchObject({ mustReplace: true, opponentMustReplace: false });
    expect(() => resolveTurn(after, FIGHT, maxRoll)).toThrow(/replaced/);

    expect(replacementError(after.sides[1], 0)).toMatch(/fainted/);
    expect(() => resolveReplacements(after, [null, null])).toThrow();

    const replaced = resolveReplacements(after, [null, 2]);
    expect(replaced.sides[1].active).toBe(2);
    expect(replaced.replacing).toBeUndefined();
    expect(replaced.lastTurn).toMatchObject({ seq: after.lastTurn!.seq + 1, turn: 1 });
    expect(replaced.lastTurn?.events).toMatchObject([{ side: 1, kind: "switch", text: "Brock sent out Test!" }]);
    expect(replaced.log.at(-1)).toBe("Brock sent out Test!");

    // The battle goes on with the new Pokémon
    const next = resolveTurn(replaced, FIGHT, maxRoll);
    expect(next.turn).toBe(2);
  });

  it("sends in the last Pokémon automatically at the end of the turn", () => {
    const after = resolveTurn(battleOf([fast()], [fighter(["water"], {}, 10), fighter(["fire"])]), FIGHT, maxRoll);
    expect(kinds(after)).toEqual(["move", "damage", "faint", "switch"]);
    expect(after.replacing).toBeUndefined();
  });

  it("has no target when the foe already fainted this turn", () => {
    // The faster Pokémon knocks itself out with recoil, so the slower one's attack has no target
    const reckless = { ...fast(), hp: 5, moves: [{ ...hit, drain: -50 }] };
    const after = resolveTurn(battleOf([reckless, fighter(["water"]), fighter(["water"])], [fighter(["water"])]), FIGHT, maxRoll);
    expect(kinds(after)).toEqual(["move", "damage", "recoil", "faint", "move", "fail"]);
    expect(after.lastTurn?.events.at(-1)?.text).toBe("But there was no target!");
    expect(after.replacing).toEqual([true, false]);
  });
});

describe("move priority and special moves", () => {
  const quickAttack: MoveInfo = { ...hit, name: "quick-attack", power: 40, priority: 1 };
  const counter: MoveInfo = { name: "counter", type: "fighting", category: "physical", power: null, priority: -5 };
  const mirrorCoat: MoveInfo = { name: "mirror-coat", type: "psychic", category: "special", power: null, priority: -5 };
  const seismicToss: MoveInfo = { name: "seismic-toss", type: "fighting", category: "physical", power: null };
  const superFang: MoveInfo = { name: "super-fang", type: "normal", category: "physical", power: null };
  const protect: MoveInfo = { name: "protect", type: "normal", category: "status", power: null, priority: 4 };

  function knowing(moves: MoveInfo[], speed: number, types: PokemonType[] = ["water"]) {
    const combatant = fighter(types, { speed });
    combatant.moves = moves;
    return combatant;
  }

  it("lets a higher priority move go first, even when slower", () => {
    const after = resolveTurn(battleOf([knowing([quickAttack], 50)], [knowing([hit], 150)]), FIGHT, maxRoll);
    expect(after.lastTurn?.events[0]).toMatchObject({ kind: "move", side: 0, move: "quick-attack" });
  });

  it("makes Counter go last and hit back for double the physical damage taken", () => {
    const after = resolveTurn(battleOf([knowing([counter], 150)], [knowing([hit], 50)]), FIGHT, maxRoll);
    expect(after.lastTurn?.events.map(({ kind, side }) => [kind, side])).toEqual([
      ["move", 1], ["damage", 0], ["move", 0], ["damage", 1],
    ]);
    expect(after.lastTurn?.events[1]).toMatchObject({ amount: 46 });
    expect(after.lastTurn?.events[3]).toMatchObject({ amount: 92, effectiveness: 1, critical: false });
    expect(after.sides[1].team[0].hp).toBe(200 - 92);
  });

  it("fails Counter without a physical hit, and Mirror Coat without a special one", () => {
    const noHit = resolveTurn(battleOf([knowing([counter], 150)], [knowing([blast], 50)]), FIGHT, maxRoll);
    expect(noHit.lastTurn?.events.at(-1)).toMatchObject({ kind: "fail", side: 0 });

    const coat = resolveTurn(battleOf([knowing([mirrorCoat], 150)], [knowing([blast], 50)]), FIGHT, maxRoll);
    expect(coat.lastTurn?.events.at(-1)).toMatchObject({ kind: "damage", side: 1, amount: 92 });
  });

  it("can't Counter a Ghost type", () => {
    const after = resolveTurn(battleOf([knowing([counter], 150)], [knowing([hit], 50, ["ghost"])]), FIGHT, maxRoll);
    expect(after.lastTurn?.events.at(-1)).toMatchObject({ kind: "immune" });
  });

  it("deals fixed damage with Seismic Toss and Super Fang", () => {
    const toss = resolveTurn(battleOf([knowing([seismicToss], 150)], [knowing([hit], 50, ["rock"])]), FIGHT, maxRoll);
    expect(toss.lastTurn?.events[1]).toMatchObject({ kind: "damage", amount: 50, effectiveness: 1 });

    const fang = resolveTurn(battleOf([knowing([superFang], 150)], [knowing([hit], 50)]), FIGHT, maxRoll);
    expect(fang.lastTurn?.events[1]).toMatchObject({ kind: "damage", amount: 100 });
  });

  it("blocks the foe's move with Protect, which goes first and gets less reliable in a row", () => {
    const first = resolveTurn(battleOf([knowing([protect], 50)], [knowing([hit], 150)]), FIGHT, script(0.5));
    expect(first.lastTurn?.events).toMatchObject([
      { kind: "move", side: 0 },
      { kind: "protect", side: 0, blocked: false },
      { kind: "move", side: 1 },
      { kind: "protect", side: 0, blocked: true },
    ]);
    expect(first.sides[0].team[0].hp).toBe(200);

    // A second Protect in a row only works a third of the time
    const second = resolveTurn(first, FIGHT, script(0.5));
    expect(second.lastTurn?.events[1]).toMatchObject({ kind: "fail" });
    expect(second.sides[0].team[0].hp).toBeLessThan(200);
  });
});

describe("moves without a base power", () => {
  const splashOnly: MoveInfo = { name: "splash", type: "normal", category: "status", power: null };
  const move = (
    name: string,
    type: PokemonType,
    category: MoveInfo["category"] = "physical",
    extra: Partial<MoveInfo> = {}
  ): MoveInfo => ({ name, type, category, power: null, ...extra });

  function knowing(moves: MoveInfo[], speed: number, extra: Partial<Combatant> = {}, types: PokemonType[] = ["water"]): Combatant {
    return { ...fighter(types, { speed }), moves, ...extra };
  }
  const damageEvents = (battle: Battle) => battle.lastTurn?.events.filter((event) => event.kind === "damage") ?? [];
  /** The damage of a regular move with the given power and category, between two plain test Pokémon */
  const regular = (power: number, base: MoveInfo = hit) =>
    calculateDamage(fighter(["water"]), fighter(["water"]), { ...base, power }, maxRoll).damage;

  it("supports every learnable damaging move without a base power, except the ones that need a held item", () => {
    const names = [
      "beat-up", "bide", "counter", "crush-grip", "dragon-rage", "electro-ball", "endeavor", "final-gambit", "fissure", "flail",
      "frustration", "grass-knot", "guillotine", "gyro-ball", "heat-crash", "heavy-slam", "horn-drill", "low-kick", "magnitude",
      "metal-burst", "mirror-coat", "natures-madness", "night-shade", "pika-papow", "present", "psywave", "punishment", "return",
      "reversal", "seismic-toss", "sheer-cold", "sonic-boom", "spit-up", "super-fang", "trump-card", "veevee-volley", "wring-out",
    ];
    for (const name of names) expect(isUsableMove(move(name, "normal")), name).toBe(true);
    expect(isUsableMove(move("fling", "dark"))).toBe(false);
    expect(isUsableMove(move("natural-gift", "normal"))).toBe(false);
  });

  it("hits heavier targets harder with Low Kick", () => {
    const lowKick = move("low-kick", "fighting");
    const light = resolveTurn(battleOf([knowing([lowKick], 150)], [knowing([hit], 50, { weightKg: 5 })]), FIGHT, maxRoll);
    const heavy = resolveTurn(battleOf([knowing([lowKick], 150)], [knowing([hit], 50, { weightKg: 300 })]), FIGHT, maxRoll);
    expect(damageEvents(light)[0]).toMatchObject({ amount: regular(20) });
    expect(damageEvents(heavy)[0]).toMatchObject({ amount: regular(120) });
  });

  it("hits harder with Flail at low HP and with Gyro Ball when slower", () => {
    const flail = resolveTurn(battleOf([knowing([move("flail", "normal")], 150, { hp: 2 })], [knowing([splashOnly], 50)]), FIGHT, maxRoll);
    expect(damageEvents(flail)[0]).toMatchObject({ amount: regular(200) });

    const gyro = resolveTurn(battleOf([knowing([move("gyro-ball", "normal")], 20)], [knowing([splashOnly], 200)]), FIGHT, maxRoll);
    expect(damageEvents(gyro)[0]).toMatchObject({ amount: regular(150) });
  });

  it("announces Magnitude's power", () => {
    const after = resolveTurn(battleOf([knowing([move("magnitude", "ground")], 150)], [knowing([splashOnly], 50)]), FIGHT, script(0.5, 1));
    expect(after.lastTurn?.events[1]).toMatchObject({ kind: "info", text: "Magnitude 7!" });
    expect(damageEvents(after)[0]).toMatchObject({ amount: regular(70) });
  });

  it("knocks out in one hit with OHKO moves, and Sheer Cold can't hit Ice types", () => {
    const fissure = move("fissure", "ground", "physical", { accuracy: 30 });
    const after = resolveTurn(battleOf([knowing([fissure], 150)], [knowing([hit], 50)]), FIGHT, minRoll);
    expect(kinds(after)).toEqual(["move", "damage", "info", "faint", "win"]);

    const sheerCold = move("sheer-cold", "ice", "special", { accuracy: 30 });
    const ice = resolveTurn(battleOf([knowing([sheerCold], 150)], [knowing([hit], 50, {}, ["ice"])]), FIGHT, minRoll);
    expect(ice.lastTurn?.events[1]).toMatchObject({ kind: "immune" });
  });

  it("cuts the foe down to the user's HP with Endeavor, and fails when it can't", () => {
    const endeavor = move("endeavor", "normal");
    const after = resolveTurn(battleOf([knowing([endeavor], 150, { hp: 30 })], [knowing([splashOnly], 50)]), FIGHT, maxRoll);
    expect(after.sides[1].team[0].hp).toBe(30);
    const again = resolveTurn(after, FIGHT, maxRoll);
    expect(again.lastTurn?.events[1]).toMatchObject({ kind: "fail" });
  });

  it("faints the user of Final Gambit after dealing its HP as damage", () => {
    const gambit = move("final-gambit", "fighting", "special");
    const after = resolveTurn(
      battleOf([knowing([gambit], 150, { hp: 80 }), fighter(["water"])], [knowing([splashOnly], 50)]),
      FIGHT,
      maxRoll
    );
    expect(after.sides[1].team[0].hp).toBe(120);
    expect(after.sides[0].team[0].hp).toBe(0);
  });

  it("hits once per healthy teammate without a status condition with Beat Up", () => {
    const beatUp = move("beat-up", "dark", "physical", { accuracy: 100 });
    const team = [
      knowing([beatUp], 150, { baseAttack: 100 }),
      { ...fighter(["water"]), baseAttack: 50 },
      { ...fighter(["water"]), status: "poison" as const },
    ];
    const after = resolveTurn(battleOf(team, [knowing([splashOnly], 50)]), FIGHT, minRoll);
    expect(damageEvents(after)).toHaveLength(2);
    expect(after.lastTurn?.events.find((event) => event.kind === "info")).toMatchObject({ side: 1, text: "Hit 2 times!" });
  });

  it("stores defenses with Stockpile and releases them with Spit Up", () => {
    const stockpile = move("stockpile", "normal", "status", {
      statTarget: "user",
      statChanges: [{ stat: "defense", change: 1 }, { stat: "special-defense", change: 1 }],
    });
    const spitUp = move("spit-up", "normal", "special");
    const SPIT: [BattleChoice, BattleChoice] = [{ kind: "move", index: 1 }, { kind: "move", index: 0 }];
    const stored = resolveTurn(battleOf([knowing([stockpile, spitUp], 150)], [knowing([splashOnly], 50)]), FIGHT, maxRoll);
    expect(stored.sides[0].team[0]).toMatchObject({ stockpile: 1, boosts: { defense: 1, "special-defense": 1 } });

    const spat = resolveTurn(stored, SPIT, maxRoll);
    expect(damageEvents(spat)[0]).toMatchObject({ amount: regular(100, blast) });
    expect(spat.sides[0].team[0]).toMatchObject({ stockpile: 0, boosts: { defense: 0, "special-defense": 0 } });

    const empty = resolveTurn(spat, SPIT, maxRoll);
    expect(empty.lastTurn?.events[1]).toMatchObject({ kind: "fail" });
  });

  it("gets stronger with Trump Card as its PP runs out, then can't use it", () => {
    const trumpCard = move("trump-card", "normal", "special");
    let battle = battleOf([knowing([trumpCard], 150)], [{ ...knowing([splashOnly], 50), maxHp: 9999, hp: 9999 }]);
    const amounts: number[] = [];
    for (let turn = 0; turn < 6; turn++) {
      battle = resolveTurn(battle, FIGHT, maxRoll);
      amounts.push(damageEvents(battle)[0]?.amount ?? 0);
    }
    expect(amounts.slice(0, 5)).toEqual([40, 50, 60, 80, 200].map((power) => regular(power, blast)));
    expect(amounts[5]).toBe(0);
    expect(battle.lastTurn?.events[1]).toMatchObject({ kind: "fail" });
  });

  it("stores energy with Bide for two turns, then hits back for double, and can't switch meanwhile", () => {
    const bide = move("bide", "normal", "physical", { priority: 1 });
    let battle = battleOf([knowing([bide, hit], 50), fighter(["water"])], [knowing([hit], 150)]);
    battle = resolveTurn(battle, FIGHT, maxRoll);
    expect(choiceError(battle.sides[0], { kind: "switch", index: 1 })).toMatch(/storing energy/);

    // Picking another move keeps biding
    battle = resolveTurn(battle, [{ kind: "move", index: 1 }, { kind: "move", index: 0 }], maxRoll);
    expect(battle.lastTurn?.events[0]).toMatchObject({ kind: "info", side: 0, text: "Test is storing energy!" });

    battle = resolveTurn(battle, FIGHT, maxRoll);
    expect(battle.lastTurn?.events[0]).toMatchObject({ kind: "info", text: "Test unleashed its energy!" });
    expect(battle.lastTurn?.events[1]).toMatchObject({ kind: "damage", side: 1, amount: 46 * 2 * 2 });
    expect(battle.sides[0].team[0].bide).toBeNull();
  });
});

describe("weather", () => {
  const status = (name: string, extra: Partial<MoveInfo> = {}): MoveInfo => ({ name, type: "normal", category: "status", power: null, ...extra });
  const rainDance = status("rain-dance", { type: "water" });
  const sunnyDay = status("sunny-day", { type: "fire" });
  const sandstorm = status("sandstorm", { type: "rock" });
  const splash = status("splash");
  const surf: MoveInfo = { name: "surf", type: "water", category: "special", power: 90 };
  const flamethrower: MoveInfo = { name: "flamethrower", type: "fire", category: "special", power: 90 };

  function knowing(moves: MoveInfo[], speed: number, types: PokemonType[] = ["normal"], extra: Partial<Combatant> = {}): Combatant {
    return { ...fighter(types, { speed }), moves, ...extra };
  }
  const damageTo = (battle: Battle, side: 0 | 1) =>
    battle.lastTurn?.events.find((event) => event.kind === "damage" && event.side === side);

  it("starts with a move, shows in both views, and ends after five turns", () => {
    let battle = battleOf([knowing([rainDance], 150)], [knowing([splash], 50)]);
    battle = resolveTurn(battle, FIGHT, maxRoll);
    expect(battle.lastTurn?.events[1]).toMatchObject({ kind: "weather", weather: "rain", text: "It started to rain!" });
    expect(battle.weather).toEqual({ kind: "rain", turnsLeft: 4 });
    expect(viewFor(battle, 1, new Set()).weather).toEqual({ kind: "rain", turnsLeft: 4 });
    expect(spectatorView(battle, new Set()).weather).toEqual({ kind: "rain", turnsLeft: 4 });

    // Using it again while it's raining fails
    battle = resolveTurn(battle, FIGHT, maxRoll);
    expect(battle.lastTurn?.events[1]).toMatchObject({ kind: "fail" });
    expect(battle.lastTurn?.weather).toBe("rain");

    for (let turn = 0; turn < 3; turn++) battle = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "move", index: 0 }], maxRoll);
    expect(battle.weather).toBeNull();
    expect(battle.lastTurn?.events.at(-1)).toMatchObject({ kind: "weather", weather: null, text: "The rain stopped." });
  });

  it("strengthens Water and weakens Fire moves in rain, and the opposite in sun", () => {
    const plain = (move: MoveInfo) => calculateDamage(fighter(["normal"]), fighter(["normal"]), move, maxRoll).damage;
    const inRain = (move: MoveInfo) => calculateDamage(fighter(["normal"]), fighter(["normal"]), move, maxRoll, false, { weather: "rain" }).damage;
    const inSun = (move: MoveInfo) => calculateDamage(fighter(["normal"]), fighter(["normal"]), move, maxRoll, false, { weather: "sun" }).damage;
    expect(inRain(surf)).toBe(Math.floor(plain(surf) * 1.5));
    expect(inRain(flamethrower)).toBe(Math.floor(plain(flamethrower) * 0.5));
    expect(inSun(flamethrower)).toBe(Math.floor(plain(flamethrower) * 1.5));
    expect(inSun(surf)).toBe(Math.floor(plain(surf) * 0.5));
    expect(inRain(hit)).toBe(plain(hit));

    // The weather set this turn already affects the slower Pokémon's move
    const after = resolveTurn(battleOf([knowing([rainDance], 150)], [knowing([surf], 50)]), FIGHT, maxRoll);
    expect(damageTo(after, 0)).toMatchObject({ amount: inRain(surf) });
  });

  it("raises Rock types' Special Defense in a sandstorm", () => {
    const rock = fighter(["rock"]);
    const plain = calculateDamage(fighter(["normal"]), rock, blast, maxRoll).damage;
    expect(calculateDamage(fighter(["normal"]), rock, blast, maxRoll, false, { weather: "sand" }).damage).toBeLessThan(plain);
    expect(calculateDamage(fighter(["normal"]), rock, hit, maxRoll, false, { weather: "sand" }).damage).toBe(
      calculateDamage(fighter(["normal"]), rock, hit, maxRoll).damage
    );
  });

  it("chips 1/16 HP in a sandstorm, except from Rock, Ground and Steel types", () => {
    const after = resolveTurn(battleOf([knowing([sandstorm], 150)], [knowing([splash], 50, ["steel"])]), FIGHT, maxRoll);
    const chips = after.lastTurn?.events.filter((event) => event.kind === "weather-damage") ?? [];
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ side: 0, amount: Math.floor(200 / 16), text: "Test is buffeted by the sandstorm!" });
  });

  it("changes Weather Ball and makes Thunder never miss in rain", () => {
    const weatherBall: MoveInfo = { name: "weather-ball", type: "normal", category: "special", power: 50 };
    const thunder: MoveInfo = { name: "thunder", type: "electric", category: "special", power: 110, accuracy: 70 };
    const sunny = resolveTurn(battleOf([knowing([sunnyDay], 150)], [knowing([weatherBall], 50)]), FIGHT, maxRoll);
    expect(sunny.lastTurn?.events.find((event) => event.side === 1 && event.kind === "move")).toMatchObject({ moveType: "fire" });
    expect(damageTo(sunny, 0)).toMatchObject({
      amount: calculateDamage(fighter(["normal"]), fighter(["normal"]), { ...weatherBall, type: "fire", power: 100 }, maxRoll, false, { weather: "sun" }).damage,
    });

    // maxRoll misses anything with an accuracy check, so a hit means Thunder skipped it
    const rainy = resolveTurn(battleOf([knowing([rainDance], 150)], [knowing([thunder], 50)]), FIGHT, maxRoll);
    expect(damageTo(rainy, 0)).toBeDefined();
  });

  it("makes Synthesis heal more in sunlight and keeps Pokémon from freezing", () => {
    const synthesis = status("synthesis", { type: "grass", healing: 50 });
    let battle = battleOf([knowing([sunnyDay, synthesis], 150, ["normal"], { hp: 50 })], [knowing([splash], 50)]);
    battle = resolveTurn(battle, FIGHT, maxRoll);
    battle = resolveTurn(battle, [{ kind: "move", index: 1 }, { kind: "move", index: 0 }], maxRoll);
    expect(battle.lastTurn?.events.find((event) => event.kind === "heal")).toMatchObject({ amount: Math.floor((200 * 200) / 3 / 100) });

    const iceBeam: MoveInfo = { name: "ice-beam", type: "ice", category: "special", power: 90, ailment: "freeze", ailmentChance: 0 };
    const frozen = resolveTurn(battleOf([knowing([sunnyDay], 150)], [knowing([iceBeam], 50)]), FIGHT, minRoll);
    expect(frozen.sides[0].team[0].status).toBeNull();
  });
});

describe("field moves", () => {
  const status = (name: string, extra: Partial<MoveInfo> = {}): MoveInfo => ({ name, type: "normal", category: "status", power: null, ...extra });
  const splash = status("splash");
  const reflect = status("reflect", { type: "psychic" });
  const spikes = status("spikes", { type: "ground" });
  const stealthRock = status("stealth-rock", { type: "rock" });
  const toxicSpikes = status("toxic-spikes", { type: "poison" });
  const stickyWeb = status("sticky-web", { type: "bug" });
  const substitute = status("substitute");
  const leechSeed = status("leech-seed", { type: "grass", accuracy: null });
  const quickAttack: MoveInfo = { ...hit, name: "quick-attack", power: 40, priority: 1 };
  const SECOND: [BattleChoice, BattleChoice] = [{ kind: "move", index: 1 }, { kind: "move", index: 0 }];

  function knowing(moves: MoveInfo[], speed: number, types: PokemonType[] = ["water"], extra: Partial<Combatant> = {}): Combatant {
    return { ...fighter(types, { speed }), moves, ...extra };
  }
  const events = (battle: Battle) => battle.lastTurn?.events ?? [];
  const damageTo = (battle: Battle, side: 0 | 1) => events(battle).find((event) => event.kind === "damage" && event.side === side);

  it("halves physical damage with Reflect, but not special damage or critical hits, and wears off after 5 turns", () => {
    let battle = resolveTurn(battleOf([knowing([reflect], 150)], [knowing([hit], 50)]), FIGHT, maxRoll);
    expect(events(battle)[1]).toMatchObject({ kind: "field", text: "Reflect made Ash's team stronger against physical moves!" });
    expect(damageTo(battle, 0)).toMatchObject({ amount: 23 });
    expect(battle.field?.sides[0].conditions.reflect).toBe(4);
    expect(viewFor(battle, 2, new Set()).field?.sides[0].conditions.reflect).toBe(4);

    const special = resolveTurn(battleOf([knowing([reflect], 150)], [knowing([blast], 50)]), FIGHT, maxRoll);
    expect(damageTo(special, 0)).toMatchObject({ amount: 46 });

    const crit = resolveTurn(battleOf([knowing([reflect], 150)], [knowing([hit], 50)]), FIGHT, script(0, 1));
    expect(damageTo(crit, 0)).toMatchObject({ critical: true, amount: 69 });

    for (let turn = 0; turn < 4; turn++) battle = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "move", index: 0 }], maxRoll);
    expect(battle.field?.sides[0].conditions.reflect).toBeUndefined();
    expect(events(battle).at(-1)).toMatchObject({ kind: "field", text: "Ash's team's Reflect wore off!" });
  });

  it("hurts Pokémon switching in with Spikes, up to three layers, but not Flying types", () => {
    let battle = battleOf([knowing([spikes], 150)], [knowing([splash], 50), fighter(["water"]), fighter(["flying"])]);
    for (let layer = 1; layer <= 3; layer++) {
      battle = resolveTurn(battle, FIGHT, maxRoll);
      expect(battle.field?.sides[1].hazards.spikes).toBe(layer);
    }
    battle = resolveTurn(battle, FIGHT, maxRoll);
    expect(events(battle)[1]).toMatchObject({ kind: "fail" });

    const grounded = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "switch", index: 1 }], maxRoll);
    expect(events(grounded).find((event) => event.kind === "hazard-damage")).toMatchObject({ side: 1, hazard: "spikes", amount: 50 });

    const flying = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "switch", index: 2 }], maxRoll);
    expect(events(flying).some((event) => event.kind === "hazard-damage")).toBe(false);
  });

  it("hurts by type with Stealth Rock, poisons with Toxic Spikes, and slows with Sticky Web", () => {
    const charizard = fighter(["fire", "flying"]);
    let battle = resolveTurn(battleOf([knowing([stealthRock], 150)], [knowing([splash], 50), charizard]), FIGHT, maxRoll);
    battle = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "switch", index: 1 }], maxRoll);
    expect(events(battle).find((event) => event.kind === "hazard-damage")).toMatchObject({ amount: 100 });

    let poisoned = resolveTurn(
      battleOf([knowing([toxicSpikes, stickyWeb, splash], 150)], [knowing([splash], 50), fighter(["water"]), fighter(["poison"])]),
      FIGHT,
      maxRoll
    );
    poisoned = resolveTurn(poisoned, SECOND, maxRoll);
    const water = resolveTurn(poisoned, [{ kind: "move", index: 2 }, { kind: "switch", index: 1 }], maxRoll);
    expect(water.sides[1].team[1]).toMatchObject({ status: "poison", boosts: { speed: -1 } });

    // A grounded Poison type soaks up Toxic Spikes
    const poisonType = resolveTurn(poisoned, [{ kind: "move", index: 2 }, { kind: "switch", index: 2 }], maxRoll);
    expect(poisonType.sides[1].team[2].status).toBeNull();
    expect(poisonType.field?.sides[1].hazards["toxic-spikes"]).toBeUndefined();
  });

  it("can knock out a Pokémon switching in, and hits the one sent in after it", () => {
    const battle = battleOf([knowing([splash], 150)], [knowing([splash], 50), fighter(["fire", "flying"], {}, 10)]);
    battle.field = { sides: [{ conditions: {}, hazards: {} }, { conditions: {}, hazards: { "stealth-rock": 1 } }], effects: {}, terrain: null };
    battle.sides[1].team[0].hp = 200;
    const after = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "switch", index: 1 }], maxRoll);
    expect(kinds(after)).toEqual(["withdraw", "switch", "hazard-damage", "faint", "move", "fail", "switch", "hazard-damage"]);
    expect(after.replacing).toBeUndefined();
    expect(after.sides[1].active).toBe(0);
    expect(after.sides[1].team[0].hp).toBe(200 - 25);

    // With nothing left to send in, the knockout ends the battle
    const last = battleOf([knowing([splash], 150)], [{ ...fighter(["water"]), hp: 0 }, fighter(["fire", "flying"], {}, 10)]);
    last.field = after.field;
    last.replacing = [false, true];
    const sentIn = resolveReplacements(last, [null, 1]);
    expect(kinds(sentIn)).toEqual(["switch", "hazard-damage", "faint", "win"]);
    expect(sentIn.winner).toBe(1);
  });

  it("speeds a team up with Tailwind and reverses the order with Trick Room", () => {
    const tailwind = status("tailwind", { type: "flying" });
    let battle = resolveTurn(battleOf([knowing([tailwind, hit], 80)], [knowing([hit], 100)]), FIGHT, maxRoll);
    battle = resolveTurn(battle, SECOND, maxRoll);
    expect(events(battle)[0]).toMatchObject({ kind: "move", side: 0 });

    const trickRoom = status("trick-room", { type: "psychic", priority: -7 });
    let twisted = resolveTurn(battleOf([knowing([trickRoom, hit], 150)], [knowing([hit], 50)]), FIGHT, maxRoll);
    twisted = resolveTurn(twisted, SECOND, maxRoll);
    expect(events(twisted)[0]).toMatchObject({ kind: "move", side: 1 });
  });

  it("puts up a Substitute that takes hits and blocks status moves until it breaks", () => {
    const thunderWave = status("thunder-wave", { type: "electric", ailment: "paralysis", accuracy: null });
    let battle = resolveTurn(battleOf([knowing([substitute, splash], 150)], [knowing([hit, thunderWave], 50)]), FIGHT, maxRoll);
    expect(battle.sides[0].team[0]).toMatchObject({ hp: 150, substituteHp: 4 });
    expect(events(battle).at(-1)).toMatchObject({ kind: "substitute", side: 0, active: true, hp: 150 });
    battle = resolveTurn(battle, SECOND, maxRoll);
    expect(events(battle).at(-1)).toMatchObject({ kind: "substitute", side: 0, active: false, hp: 150 });
    expect(battle.sides[0].team[0].substituteHp).toBe(0);

    battle = resolveTurn(battleOf([knowing([substitute, splash], 150)], [knowing([thunderWave], 50)]), FIGHT, maxRoll);
    expect(events(battle).at(-1)).toMatchObject({ kind: "fail", side: 1 });
    expect(battle.sides[0].team[0].status).toBeNull();
    expect(viewFor(battle, 2, new Set()).opponent.active.substitute).toBe(true);
  });

  it("drains the foe with Leech Seed until Rapid Spin frees it, and can't seed Grass types", () => {
    const rapidSpin: MoveInfo = { name: "rapid-spin", type: "normal", category: "physical", power: 50 };
    let battle = resolveTurn(battleOf([knowing([leechSeed], 150, ["water"], { hp: 100 })], [knowing([splash, rapidSpin], 50)]), FIGHT, maxRoll);
    expect(events(battle).filter((event) => event.kind === "leech" || event.kind === "heal")).toMatchObject([
      { kind: "leech", side: 1, amount: 25, hp: 175 },
      { kind: "heal", side: 0, amount: 25 },
    ]);
    battle.field = { sides: [{ conditions: {}, hazards: {} }, { conditions: {}, hazards: { spikes: 2 } }], effects: {}, terrain: null };
    battle = resolveTurn(battle, [{ kind: "move", index: 0 }, { kind: "move", index: 1 }], maxRoll);
    expect(battle.sides[1].team[0].seeded).toBe(false);
    expect(battle.field?.sides[1].hazards).toEqual({});

    const grass = resolveTurn(battleOf([knowing([leechSeed], 150)], [knowing([splash], 50, ["grass"])]), FIGHT, maxRoll);
    expect(events(grass)[1]).toMatchObject({ kind: "immune" });
  });

  it("breaks screens with Brick Break and clears them and hazards with Defog", () => {
    const brickBreak: MoveInfo = { name: "brick-break", type: "fighting", category: "physical", power: 75 };
    const screened = battleOf([knowing([brickBreak], 150)], [knowing([splash], 50)]);
    screened.field = { sides: [{ conditions: {}, hazards: {} }, { conditions: { reflect: 3 }, hazards: {} }], effects: {}, terrain: null };
    const broken = resolveTurn(screened, FIGHT, maxRoll);
    expect(events(broken)[1]).toMatchObject({ kind: "field", text: "It shattered the barrier!" });
    expect(damageTo(broken, 1)).toMatchObject({
      amount: calculateDamage(fighter(["water"]), fighter(["water"]), brickBreak, maxRoll).damage,
    });

    const defog = status("defog", { type: "flying", statChanges: [{ stat: "evasion", change: -1 }], statTarget: "target" });
    const foggy = battleOf([knowing([defog], 150)], [knowing([splash], 50)]);
    foggy.field = {
      sides: [{ conditions: {}, hazards: { spikes: 1 } }, { conditions: { "light-screen": 2 }, hazards: { "stealth-rock": 1 } }],
      effects: {},
      terrain: { kind: "grassy", turnsLeft: 3 },
    };
    const cleared = resolveTurn(foggy, FIGHT, maxRoll);
    expect(cleared.field).toMatchObject({ sides: [{ hazards: {} }, { conditions: {}, hazards: {} }], terrain: null });
  });

  it("resets every stat change with Haze, and protects stats with Mist and status with Safeguard", () => {
    const haze = status("haze", { type: "ice" });
    const boosted = battleOf([knowing([haze], 150, ["water"], { boosts: { attack: 2 } })], [knowing([splash], 50, ["water"], { boosts: { speed: -1 } })]);
    const hazed = resolveTurn(boosted, FIGHT, maxRoll);
    expect([hazed.sides[0].team[0].boosts, hazed.sides[1].team[0].boosts]).toEqual([{}, {}]);

    const mist = status("mist", { type: "ice" });
    const growl = status("growl", { statChanges: [{ stat: "attack", change: -1 }], statTarget: "target" });
    const misty = resolveTurn(battleOf([knowing([mist], 150)], [knowing([growl], 50)]), FIGHT, maxRoll);
    expect(misty.sides[0].team[0].boosts.attack ?? 0).toBe(0);

    const safeguard = status("safeguard");
    const willOWisp = status("will-o-wisp", { type: "fire", ailment: "burn", accuracy: null });
    const safe = resolveTurn(battleOf([knowing([safeguard], 150)], [knowing([willOWisp], 50)]), FIGHT, maxRoll);
    expect(safe.sides[0].team[0].status).toBeNull();
  });

  it("boosts moves, heals and blocks priority or status with terrains", () => {
    const grassyTerrain = status("grassy-terrain", { type: "grass" });
    const grassy = resolveTurn(battleOf([knowing([grassyTerrain], 150, ["water"], { hp: 100 })], [knowing([splash], 50)]), FIGHT, maxRoll);
    expect(events(grassy).find((event) => event.kind === "heal")).toMatchObject({ side: 0, amount: 12 });

    const psychicTerrain = status("psychic-terrain", { type: "psychic" });
    const psychic = resolveTurn(battleOf([knowing([psychicTerrain], 150)], [knowing([quickAttack], 50)]), FIGHT, maxRoll);
    // Quick Attack goes first, before the terrain is up, then is blocked the next turn
    const next = resolveTurn(psychic, FIGHT, maxRoll);
    expect(events(next).find((event) => event.side === 0 && event.kind === "protect")).toMatchObject({ blocked: true });

    const electricTerrain = status("electric-terrain", { type: "electric" });
    const spore = status("spore", { type: "grass", ailment: "sleep", accuracy: null });
    const awake = resolveTurn(battleOf([knowing([electricTerrain], 150)], [knowing([spore], 50)]), FIGHT, maxRoll);
    expect(awake.sides[0].team[0].status).toBeNull();

    const thunderbolt: MoveInfo = { name: "thunderbolt", type: "electric", category: "special", power: 90 };
    const plain = calculateDamage(fighter(["water"]), fighter(["normal"]), thunderbolt, maxRoll).damage;
    const field: FieldState = { ...emptyField(), terrain: { kind: "electric", turnsLeft: 3 } };
    expect(calculateDamage(fighter(["water"]), fighter(["normal"]), thunderbolt, maxRoll, false, { field }).damage).toBe(Math.floor(plain * 1.3));
  });

  it("lets Ground moves hit Flying types under Gravity", () => {
    const earthquake: MoveInfo = { name: "earthquake", type: "ground", category: "physical", power: 100 };
    const gravity = status("gravity", { type: "psychic" });
    let battle = battleOf([knowing([gravity, earthquake], 150)], [knowing([splash], 50, ["flying"])]);
    const before = resolveTurn(battle, SECOND, maxRoll);
    expect(events(before)[1]).toMatchObject({ kind: "immune" });
    battle = resolveTurn(battle, FIGHT, maxRoll);
    battle = resolveTurn(battle, SECOND, maxRoll);
    expect(damageTo(battle, 1)).toBeDefined();
  });

  it("blocks switching for a turn with Fairy Lock", () => {
    const fairyLock = status("fairy-lock", { type: "fairy" });
    const battle = resolveTurn(battleOf([knowing([fairyLock], 150), fighter(["water"])], [knowing([splash], 50)]), FIGHT, maxRoll);
    expect(choiceError(battle.sides[0], { kind: "switch", index: 1 }, battle.field)).toMatch(/Fairy Lock/);
    expect(() => resolveTurn(battle, [{ kind: "switch", index: 1 }, { kind: "move", index: 0 }], maxRoll)).toThrow(/Fairy Lock/);
    const later = resolveTurn(battle, FIGHT, maxRoll);
    expect(choiceError(later.sides[0], { kind: "switch", index: 1 }, later.field)).toBeNull();
  });

  it("blocks priority moves with Quick Guard, and Mat Block only works on the first turn out", () => {
    const quickGuard = status("quick-guard", { type: "fighting", priority: 3 });
    const guarded = resolveTurn(battleOf([knowing([quickGuard], 50)], [knowing([quickAttack], 150)]), FIGHT, maxRoll);
    expect(events(guarded).at(-1)).toMatchObject({ kind: "protect", side: 0, blocked: true });

    const matBlock = status("mat-block", { type: "fighting" });
    let mat = resolveTurn(battleOf([knowing([matBlock], 150)], [knowing([hit], 50)]), FIGHT, maxRoll);
    expect(damageTo(mat, 0)).toBeUndefined();
    mat = resolveTurn(mat, FIGHT, maxRoll);
    expect(events(mat)[1]).toMatchObject({ kind: "fail" });
  });

  it("swaps the sides' effects with Court Change", () => {
    const courtChange = status("court-change", { type: "normal" });
    const battle = battleOf([knowing([courtChange], 150)], [knowing([splash], 50)]);
    battle.field = { sides: [{ conditions: {}, hazards: { spikes: 2 } }, { conditions: { reflect: 3 }, hazards: {} }], effects: {}, terrain: null };
    const after = resolveTurn(battle, FIGHT, maxRoll);
    expect(after.field?.sides[0]).toMatchObject({ conditions: { reflect: 2 }, hazards: {} });
    expect(after.field?.sides[1]).toMatchObject({ conditions: {}, hazards: { spikes: 2 } });
  });
});
