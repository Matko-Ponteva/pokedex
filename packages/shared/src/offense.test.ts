import { describe, expect, it } from "vitest";
import type { PokemonType } from "./pokemonTypes.ts";
import {
  SINGLE_TYPE_TARGETS, analyzeCoverage, coverageGaps, coverageDistribution, damageMultiplier, summarizeCoverage,
  type Attacker, type CoverageTarget, type MoveInfo,
} from "./offense.ts";

const flamethrower: MoveInfo = { name: "flamethrower", type: "fire", category: "special", power: 90 };
const airSlash: MoveInfo = { name: "air-slash", type: "flying", category: "special", power: 75 };
const earthquake: MoveInfo = { name: "earthquake", type: "ground", category: "physical", power: 100 };
const dragonClaw: MoveInfo = { name: "dragon-claw", type: "dragon", category: "physical", power: 80 };
const tackle: MoveInfo = { name: "tackle", type: "normal", category: "physical", power: 40 };
const thunderWave: MoveInfo = { name: "thunder-wave", type: "electric", category: "status", power: null };

const charizard: Attacker = {
  types: ["fire", "flying"],
  moves: [flamethrower, airSlash, earthquake, dragonClaw],
};
const rhydon: Attacker = { types: ["ground", "rock"], moves: [earthquake] };

function entryFor(team: Attacker[], types: PokemonType[]) {
  const [entry] = analyzeCoverage(team, [{ types, count: 1 }]);
  return entry;
}

describe("damageMultiplier", () => {
  it("adds the STAB bonus when the move matches its user's type", () => {
    expect(damageMultiplier(flamethrower, ["fire", "flying"], ["grass"])).toBe(3);
    expect(damageMultiplier(flamethrower, ["water"], ["grass"])).toBe(2);
  });

  it("uses both types of a dual-type defender", () => {
    expect(damageMultiplier(earthquake, ["ground", "rock"], ["fire", "rock"])).toBe(6);
    expect(damageMultiplier(earthquake, ["fire", "flying"], ["electric", "flying"])).toBe(0);
  });
});

describe("analyzeCoverage", () => {
  it("finds the strongest hit, including STAB", () => {
    expect(entryFor([charizard], ["steel"])).toMatchObject({ best: 3, bestMoves: ["flamethrower"] });
  });

  it("can leave STAB out to show plain type effectiveness", () => {
    expect(analyzeCoverage([charizard], [{ types: ["steel"], count: 1 }], { stab: false })[0])
      .toMatchObject({ best: 2, bestMoves: ["flamethrower", "earthquake"] });
  });

  it("lists every move that reaches the best value", () => {
    expect(entryFor([charizard], ["grass"]).bestMoves).toEqual(["flamethrower", "air-slash"]);
  });

  it("applies STAB per user, and lists a shared move once", () => {
    expect(entryFor([charizard, rhydon], ["fire"])).toMatchObject({ best: 3, bestMoves: ["earthquake"] });
  });

  it("ignores status moves", () => {
    const pikachu: Attacker = { types: ["electric"], moves: [thunderWave] };
    expect(entryFor([pikachu], ["water"])).toMatchObject({ best: 0, bestMoves: [] });
  });

  it("keeps each target's count", () => {
    const [entry] = analyzeCoverage([charizard], [{ types: ["grass"], count: 7 }]);
    expect(entry.count).toBe(7);
  });
});

describe("coverageGaps", () => {
  it("finds targets that no move hits neutrally", () => {
    const team: Attacker[] = [{ types: ["fire", "flying"], moves: [tackle] }];
    const gaps = coverageGaps(analyzeCoverage(team, SINGLE_TYPE_TARGETS));
    expect(gaps.map((gap) => gap.types)).toEqual([["rock"], ["ghost"], ["steel"]]);
  });

  it("doesn't let STAB turn a resisted hit into a neutral one", () => {
    const snorlax: Attacker = { types: ["normal"], moves: [tackle] };
    expect(entryFor([snorlax], ["rock"]).best).toBe(0.75);
  });

  it("finds no gaps for well-rounded moves", () => {
    expect(coverageGaps(analyzeCoverage([charizard], SINGLE_TYPE_TARGETS))).toEqual([]);
  });
});

describe("summarizeCoverage", () => {
  it("weighs each target by how many Pokémon have it", () => {
    const targets: CoverageTarget[] = [
      { types: ["grass"], count: 3 },
      { types: ["water"], count: 1 },
    ];
    const team: Attacker[] = [{ types: ["fire"], moves: [flamethrower] }];
    expect(summarizeCoverage(analyzeCoverage(team, targets))).toEqual({
      total: 4,
      superEffective: 3,
      neutralOrBetter: 3,
    });
  });

  it("is all zeros for no targets", () => {
    expect(summarizeCoverage([])).toEqual({ total: 0, superEffective: 0, neutralOrBetter: 0 });
  });
});

describe("coverageDistribution", () => {
  it("groups Pokémon by their best multiplier, weakest first", () => {
    const targets: CoverageTarget[] = [
      { types: ["grass"], count: 3 },
      { types: ["water"], count: 1 },
      { types: ["bug"], count: 2 },
      { types: ["normal"], count: 4 },
    ];
    const team: Attacker[] = [{ types: ["fire"], moves: [flamethrower] }];
    expect(coverageDistribution(analyzeCoverage(team, targets))).toEqual([
      { multiplier: 0.75, count: 1 },
      { multiplier: 1.5, count: 4 },
      { multiplier: 3, count: 5 },
    ]);
  });

  it("is empty for no targets", () => {
    expect(coverageDistribution([])).toEqual([]);
  });
});