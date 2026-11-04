import { z } from "zod";

export type Ruleset = {
  id: RulesetId;
  name: string;
  description: string;
  /** Every Pokémon battles at this level */
  level: number;
};

export const RULESET_IDS = ["standard"] as const;
export type RulesetId = (typeof RULESET_IDS)[number];

export const RULESETS: Record<RulesetId, Ruleset> = {
  standard: {
    id: "standard",
    name: "Standard",
    description: "All Pokémon are set to level 50.",
    level: 50,
  },
};

export const DEFAULT_RULESET: RulesetId = "standard";

export const rulesetIdSchema = z.enum(RULESET_IDS);

export function rulesetOf(id: RulesetId | undefined): Ruleset {
  return RULESETS[id ?? DEFAULT_RULESET];
}
