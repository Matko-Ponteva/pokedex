import { describe, expect, it } from "vitest";
import { POKEMON_TYPES } from "./pokemonTypes.ts";
import { TYPE_CHART, effectiveness, effectivenessAgainst } from "./typeChart.ts";

describe("effectiveness", () => {
  it.each([
    ["fire", "grass", 2],
    ["water", "fire", 2],
    ["grass", "fire", 0.5],
    ["electric", "ground", 0],
    ["normal", "ghost", 0],
    ["normal", "normal", 1],
  ] as const)("%s against %s is %s×", (attack, defend, expected) => {
    expect(effectiveness(attack, defend)).toBe(expected);
  });
});

describe("effectivenessAgainst", () => {
  it("multiplies the multipliers of both types", () => {
    expect(effectivenessAgainst("electric", ["water", "flying"])).toBe(4); // Gyarados
    expect(effectivenessAgainst("rock", ["fire", "flying"])).toBe(4); // Charizard
    expect(effectivenessAgainst("grass", ["water", "ground"])).toBe(4); // Swampert
  });

  it("cancels out a weakness and a resistance", () => {
    expect(effectivenessAgainst("ice", ["fire", "flying"])).toBe(1);
  });

  it("lets an immunity override everything", () => {
    expect(effectivenessAgainst("ground", ["fire", "flying"])).toBe(0);
  });

  it("is neutral against a Pokémon without types", () => {
    expect(effectivenessAgainst("fire", [])).toBe(1);
  });
});

describe("TYPE_CHART", () => {
  it("only uses valid multipliers", () => {
    for (const matchups of Object.values(TYPE_CHART)) {
      for (const multiplier of Object.values(matchups)) {
        expect([0, 0.5, 2]).toContain(multiplier);
      }
    }
  });

  it("has exactly 8 immunities", () => {
    const immunities = POKEMON_TYPES.flatMap((attack) =>
      POKEMON_TYPES.filter((defend) => effectiveness(attack, defend) === 0)
    );
    expect(immunities).toHaveLength(8);
  });
});