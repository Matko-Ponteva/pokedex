import { describe, expect, it } from "vitest";
import type { PokemonType } from "./pokemonTypes.ts";
import { analyzeDefense, sharedWeaknesses } from "./defense.ts";

const kantoStarters: PokemonType[][] = [
  ["fire", "flying"], // Charizard
  ["water"], // Blastoise
  ["grass", "poison"], // Venusaur
];

function matchup(attackType: PokemonType) {
  const result = analyzeDefense(kantoStarters).find((m) => m.attackType === attackType);
  if (!result) throw new Error(`No matchup for ${attackType}`);
  return result;
}

describe("analyzeDefense", () => {
  it("returns one row per attacking type", () => {
    expect(analyzeDefense(kantoStarters)).toHaveLength(18);
  });

  it("lists each member's multiplier in team order", () => {
    expect(matchup("electric").multipliers).toEqual([2, 2, 0.5]);
    expect(matchup("rock").multipliers).toEqual([4, 1, 1]);
  });

  it("counts weaknesses, resistances and immunities", () => {
    expect(matchup("electric")).toMatchObject({ weak: 2, resistant: 1, immune: 0 });
    expect(matchup("ground")).toMatchObject({ weak: 0, resistant: 0, immune: 1 });
  });

  it("handles an empty team", () => {
    for (const m of analyzeDefense([])) {
      expect(m).toMatchObject({ multipliers: [], weak: 0, resistant: 0, immune: 0 });
    }
  });
});

describe("sharedWeaknesses", () => {
  it("finds types several members are weak to", () => {
    expect(sharedWeaknesses(analyzeDefense(kantoStarters))).toEqual(["electric"]);
  });

  it("ignores a weakness the rest of the team covers", () => {
    // Grass and ice are weak to fire, water and fire resist it
    const team: PokemonType[][] = [["grass"], ["ice"], ["water"], ["fire"]];
    expect(sharedWeaknesses(analyzeDefense(team))).not.toContain("fire");
  });

  it("finds nothing for an empty team", () => {
    expect(sharedWeaknesses(analyzeDefense([]))).toEqual([]);
  });
});