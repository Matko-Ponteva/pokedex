import { describe, expect, it } from "vitest";
import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import {
  STRUGGLE, battleSprites, calculateDamage, choiceError, replacementError, resolveReplacements, createCombatant, resolveTurn, spectatorView, viewFor,
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
  it("keeps status moves, and falls back to Struggle without usable moves", () => {
    const growl: MoveInfo = { name: "growl", type: "normal", category: "status", power: null };
    const seismicToss: MoveInfo = { name: "seismic-toss", type: "fighting", category: "physical", power: null };
    expect(
      createCombatant({ name: "x", spriteUrl: "", types: ["normal"], baseStats: [], moves: [growl, seismicToss], level: 50 }).moves
    ).toEqual([growl]);
    const combatant = createCombatant({
      name: "charizard",
      spriteUrl: "",
      types: ["fire", "flying"],
      baseStats: [{ name: "hp", value: 78 }],
      moves: [seismicToss],
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
  const protect: MoveInfo = { name: "protect", type: "normal", category: "status", power: null };

  /** An opponent that does nothing */
  const idle = () => ({ ...fighter(["water"]), moves: [protect] });

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
    const after = resolveTurn(battleOf([user([protect])], [idle()]), FIGHT, maxRoll);
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
