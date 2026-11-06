import { z } from "zod";

/** Singles: one Pokémon from each side battles at a time. Doubles: two from each side. */
export type BattleFormat = "singles" | "doubles";

export type Ruleset = {
  id: RulesetId;
  name: string;
  description: string;
  /** Every Pokémon battles at this level */
  level: number;
  format: BattleFormat;
};

export const RULESET_IDS = ["standard", "doubles"] as const;
export type RulesetId = (typeof RULESET_IDS)[number];

export const RULESETS: Record<RulesetId, Ruleset> = {
  standard: {
    id: "standard",
    name: "Standard",
    description: "Single battle. All Pokémon are set to level 50.",
    level: 50,
    format: "singles",
  },
  doubles: {
    id: "doubles",
    name: "Doubles",
    description: "Double battle: two Pokémon from each side fight at once. All Pokémon are set to level 50. Teams need at least two Pokémon.",
    level: 50,
    format: "doubles",
  },
};

export const DEFAULT_RULESET: RulesetId = "standard";

export const rulesetIdSchema = z.enum(RULESET_IDS);

export function rulesetOf(id: RulesetId | undefined): Ruleset {
  return RULESETS[id ?? DEFAULT_RULESET] ?? RULESETS[DEFAULT_RULESET];
}

/** How many Pokémon each side has in battle at once */
export function activePerSide(format: BattleFormat): number {
  return format === "doubles" ? 2 : 1;
}
