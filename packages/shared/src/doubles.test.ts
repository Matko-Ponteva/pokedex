import { describe, expect, it } from "vitest";
import type { MoveInfo } from "./offense.ts";
import type { PokemonType } from "./pokemonTypes.ts";
import {
  resolveReplacements, resolveTurn, sideChoicesError, viewFor, type Battle, type BattleChoice, type BattleStats, type Combatant,
} from "./battle.ts";

const maxRoll = () => 1;
const hit: MoveInfo = { name: "test-hit", type: "normal", category: "physical", power: 100, target: "selected-pokemon" };
const wave: MoveInfo = { name: "test-wave", type: "normal", category: "physical", power: 100, target: "all-opponents" };
const quake: MoveInfo = { name: "earthquake", type: "ground", category: "physical", power: 100, target: "all-other-pokemon" };
const splash: MoveInfo = { name: "splash", type: "normal", category: "status", power: null, target: "user" };
const status = (name: string, target: string, extra: Partial<MoveInfo> = {}): MoveInfo => ({
  name, type: "normal", category: "status", power: null, target, ...extra,
});

function fighter(name: string, moves: MoveInfo[] = [hit], stats: Partial<BattleStats> = {}, types: PokemonType[] = ["water"]): Combatant {
  return {
    name,
    spriteUrl: "",
    types,
    level: 50,
    stats: { hp: 50, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100, ...stats },
    maxHp: 200,
    hp: 200,
    moves,
    status: null,
    sleepTurns: 0,
    boosts: {},
  };
}

/** Slots: 0 = Ash left, 2 = Ash right, 1 = Brock left, 3 = Brock right */
function doubles(a: Combatant[], b: Combatant[]): Battle {
  return {
    id: "doubles",
    ruleset: "doubles",
    turn: 1,
    log: [],
    winner: null,
    sides: [
      { userId: 1, displayName: "Ash", team: a, active: 0, actives: [0, 1] },
      { userId: 2, displayName: "Brock", team: b, active: 0, actives: [0, 1] },
    ],
  };
}

const move = (index = 0, targetSlot?: number): BattleChoice => ({ kind: "move", index, ...(targetSlot === undefined ? {} : { targetSlot }) });
const idle = (count = 4): BattleChoice[] => Array.from({ length: count }, () => move(0));

describe("double battles", () => {
  it("hits the chosen foe", () => {
    // Slow Ash so Brock's splashes don't matter
    const battle = doubles([fighter("a1"), fighter("a2", [splash])], [fighter("b1", [splash]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, [move(0, 3), move(), move(), move()], maxRoll);
    expect(after.sides[1].team[0].hp).toBe(200);
    expect(after.sides[1].team[1].hp).toBe(154);
  });

  it("moves on to the other foe when the target has fainted", () => {
    const b1 = { ...fighter("b1", [splash]), hp: 0 };
    const battle = doubles([fighter("a1"), fighter("a2", [splash])], [b1, fighter("b2", [splash])]);
    const after = resolveTurn(battle, [move(0, 1), null, move(), move()], maxRoll);
    expect(after.sides[1].team[1].hp).toBe(154);
  });

  it("spreads damage over both foes at 75%", () => {
    const battle = doubles([fighter("a1", [wave]), fighter("a2", [splash])], [fighter("b1", [splash]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.sides[1].team.map((each) => each.hp)).toEqual([166, 166]);
  });

  it("hits the ally too with moves like Earthquake, unless it has Telepathy", () => {
    const battle = doubles([fighter("a1", [quake]), fighter("a2", [splash])], [fighter("b1", [splash]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.sides[0].team[1].hp).toBeLessThan(200);
    battle.sides[0].team[1].ability = "telepathy";
    const guarded = resolveTurn(battle, idle(), maxRoll);
    expect(guarded.sides[0].team[1].hp).toBe(200);
    expect(guarded.sides[1].team[0].hp).toBeLessThan(200);
  });

  it("draws single-target moves to a Pokémon using Follow Me", () => {
    const followMe = status("follow-me", "user", { priority: 2 });
    const battle = doubles([fighter("a1"), fighter("a2", [splash])], [fighter("b1", [followMe]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, [move(0, 3), move(), move(), move()], maxRoll);
    expect(after.sides[1].team[0].hp).toBe(154);
    expect(after.sides[1].team[1].hp).toBe(200);
  });

  it("powers up the ally's move with Helping Hand", () => {
    const helpingHand = status("helping-hand", "ally", { priority: 5 });
    const battle = doubles([fighter("a1"), fighter("a2", [helpingHand])], [fighter("b1", [splash]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, [move(0, 1), move(), move(), move()], maxRoll);
    // 150 power: floor(22 * 150 * 100 / 100 / 50) + 2 = 68
    expect(after.sides[1].team[0].hp).toBe(132);
  });

  it("fails moves that need an ally in a single battle", () => {
    const helpingHand = status("helping-hand", "ally", { priority: 5 });
    const battle: Battle = { ...doubles([fighter("a1", [helpingHand])], [fighter("b1", [splash])]), ruleset: "standard" };
    battle.sides.forEach((side) => delete side.actives);
    const after = resolveTurn(battle, [move(), move()], maxRoll);
    expect(after.lastTurn?.events.some((event) => event.kind === "fail" && event.side === 0)).toBe(true);
  });

  it("blocks spread moves with Wide Guard", () => {
    const wideGuard = status("wide-guard", "users-field", { priority: 3 });
    const battle = doubles([fighter("a1", [wave]), fighter("a2", [splash])], [fighter("b1", [wideGuard]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.sides[1].team.map((each) => each.hp)).toEqual([200, 200]);
  });

  it("lowers both foes' Attack with Intimidate", () => {
    const intimidator = { ...fighter("a1", [splash]), ability: "intimidate" };
    const battle = { ...doubles([intimidator, fighter("a2", [splash])], [fighter("b1", [splash]), fighter("b2", [splash])]), turn: 0 };
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.sides[1].team.map((each) => each.boosts.attack)).toEqual([-1, -1]);
  });

  it("asks for a replacement only for the slot that fainted, and leaves it empty without one", () => {
    const frail = { ...fighter("b1", [splash]), hp: 10 };
    const battle = doubles([fighter("a1"), fighter("a2", [splash])], [frail, fighter("b2", [splash]), fighter("b3"), fighter("b4")]);
    const after = resolveTurn(battle, [move(0, 1), move(), move(), move()], maxRoll);
    expect(after.replacing).toEqual([false, true, false, false]);
    const view = viewFor(after, 2, new Set());
    expect(view.replacePositions).toEqual([0]);
    expect(view.actingPositions).toEqual([]);
    const replaced = resolveReplacements(after, [null, 3, null, null]);
    expect(replaced.sides[1].actives).toEqual([3, 1]);
    expect(replaced.replacing).toBeUndefined();

    // Nobody left to send in: the battle goes on with one Pokémon
    const alone = resolveTurn(doubles([fighter("a1"), fighter("a2", [splash])], [{ ...frail }, fighter("b2", [splash])]), [move(0, 1), move(), move(), move()], maxRoll);
    expect(alone.replacing).toBeUndefined();
    expect(alone.winner).toBeNull();
    expect(viewFor(alone, 2, new Set()).actingPositions).toEqual([1]);
  });

  it("sends in the last Pokémon left without touching the other side, even when the sides share an array", () => {
    const leads = [0, 1];
    const battle = doubles([fighter("a1"), fighter("a2", [splash])], [{ ...fighter("b1", [splash]), hp: 10 }, fighter("b2", [splash]), fighter("b3")]);
    battle.sides.forEach((side) => (side.actives = leads));
    const after = resolveTurn(battle, [move(0, 1), move(), move(), move()], maxRoll);
    expect(after.sides[1].actives).toEqual([2, 1]);
    expect(after.sides[0].actives).toEqual([0, 1]);
    expect(after.replacing).toBeUndefined();
  });

  it("ends the battle when both of a side's Pokémon are down", () => {
    const battle = doubles([fighter("a1", [wave]), fighter("a2", [splash])], [{ ...fighter("b1", [splash]), hp: 5 }, { ...fighter("b2", [splash]), hp: 5 }]);
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.winner).toBe(1);
  });

  it("swaps places with Ally Switch", () => {
    const allySwitch = status("ally-switch", "user", { priority: 2 });
    const battle = doubles([fighter("a1", [allySwitch]), fighter("a2", [splash])], [fighter("b1", [splash]), fighter("b2", [splash])]);
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.sides[0].actives).toEqual([1, 0]);
    expect(after.sides[0].active).toBe(1);
  });

  it("softens hits on the ally with Friend Guard", () => {
    const guard = { ...fighter("b2", [splash]), ability: "friend-guard" };
    const battle = doubles([fighter("a1"), fighter("a2", [splash])], [fighter("b1", [splash]), guard]);
    const after = resolveTurn(battle, [move(0, 1), move(), move(), move()], maxRoll);
    expect(after.sides[1].team[0].hp).toBe(200 - Math.floor(46 * 0.75));
  });

  it("keeps the ally awake with Sweet Veil", () => {
    const sing = status("sing", "selected-pokemon", { ailment: "sleep" });
    const veil = { ...fighter("b2", [splash]), ability: "sweet-veil" };
    const battle = doubles([fighter("a1", [sing]), fighter("a2", [splash])], [fighter("b1", [splash]), veil]);
    const after = resolveTurn(battle, [move(0, 1), move(), move(), move()], maxRoll);
    expect(after.sides[1].team[0].status).toBeNull();
  });

  it("switches out a Pokémon whose Eject Pack goes off", () => {
    const intimidator = { ...fighter("a1", [splash]), ability: "intimidate" };
    const packed = { ...fighter("b1", [splash]), item: "eject-pack" };
    const battle = { ...doubles([intimidator, fighter("a2", [splash])], [packed, fighter("b2", [splash]), fighter("b3", [splash])]), turn: 0 };
    const after = resolveTurn(battle, idle(), maxRoll);
    expect(after.sides[1].actives).toEqual([2, 1]);
    expect(after.sides[1].team[0].item).toBeNull();
  });

  it("hides Tatsugiri inside Dondozo with Commander", () => {
    const tatsugiri = { ...fighter("tatsugiri", [hit]), ability: "commander" };
    const battle = { ...doubles([fighter("dondozo", [splash]), tatsugiri], [fighter("b1", [hit]), fighter("b2", [splash])]), turn: 0 };
    const after = resolveTurn(battle, [move(), move(), move(0, 2), move()], maxRoll);
    expect(after.sides[0].team[0].boosts.attack).toBe(2);
    expect(after.sides[0].team[1].volatiles?.commanding).toBe(true);
    // Brock aimed at Tatsugiri, which can't be reached, so Dondozo takes the hit
    expect(after.sides[0].team[1].hp).toBe(200);
    expect(after.sides[0].team[0].hp).toBeLessThan(200);
    expect(viewFor(after, 1, new Set()).actingPositions).toEqual([0]);
  });

  it("won't send the same Pokémon in twice", () => {
    const battle = doubles([fighter("a1"), fighter("a2"), fighter("a3")], [fighter("b1"), fighter("b2")]);
    expect(sideChoicesError(battle, 0, [{ kind: "switch", index: 2 }, { kind: "switch", index: 2 }])).toMatch(/only come in once/);
    expect(sideChoicesError(battle, 0, [{ kind: "switch", index: 1 }, move()])).toMatch(/already in battle/);
  });

  it("shows each position's locks to the player", () => {
    const battle = doubles([fighter("a1"), fighter("a2", [hit, splash])], [fighter("b1"), fighter("b2")]);
    const view = viewFor(battle, 1, new Set());
    expect(view.moveLocks).toEqual([[null], [null, null]]);
    expect(view.switchLocks).toEqual([null, null]);
    expect(view.actingPositions).toEqual([0, 1]);
    expect(view.opponent.actives).toHaveLength(2);
  });
});
