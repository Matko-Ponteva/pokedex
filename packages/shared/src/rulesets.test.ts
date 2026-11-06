import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET, RULESETS, rulesetOf, teamSizeError } from "./rulesets.ts";

describe("rulesets", () => {
  it("defaults to standard teams of up to 6", () => {
    expect(DEFAULT_RULESET).toBe("standard");
    expect(rulesetOf(undefined)).toMatchObject({ minTeamSize: 1, maxTeamSize: 6 });
  });

  it("lets standard battles use 1 to 6 Pokémon", () => {
    for (let size = 1; size <= 6; size++) expect(teamSizeError(RULESETS.standard, size)).toBeNull();
    expect(teamSizeError(RULESETS.standard, 0)).toMatch(/at least 1/);
    expect(teamSizeError(RULESETS.standard, 7)).toMatch(/at most 6/);
  });

  it.each([
    ["1v1", 1],
    ["2v2", 2],
    ["3v3", 3],
  ] as const)("requires exactly the right team size for %s", (id, size) => {
    const ruleset = RULESETS[id];
    expect(teamSizeError(ruleset, size)).toBeNull();
    expect(teamSizeError(ruleset, size - 1)).toMatch(new RegExp(`exactly ${size}`));
    expect(teamSizeError(ruleset, size + 1)).toMatch(new RegExp(`exactly ${size}`));
    expect(teamSizeError(ruleset, 6)).not.toBeNull();
  });
});
