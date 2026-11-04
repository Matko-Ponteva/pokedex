import { describe, expect, it } from "vitest";
import type { ChatMode } from "./battle.ts";
import { canSeeChat, parseChatCommand } from "./chat.ts";

describe("canSeeChat", () => {
  const players = [1, 2];
  const player = { role: "player" as const };
  const spectator = { role: "spectator" as const };

  it("shows everything to spectators", () => {
    const modes = new Map<number, ChatMode>([[1, "private"]]);
    expect(canSeeChat(player, 3, players, modes)).toBe(true);
    expect(canSeeChat(spectator, 3, players, modes)).toBe(true);
  });

  it("always shows battlers each other's messages", () => {
    expect(canSeeChat(player, 1, players, new Map<number, ChatMode>([[1, "private"]]))).toBe(true);
  });

  it("hides spectators from a battler whose chat is private", () => {
    const modes = new Map<number, ChatMode>([[1, "private"], [2, "public"]]);
    expect(canSeeChat(spectator, 1, players, modes)).toBe(false);
    expect(canSeeChat(spectator, 2, players, modes)).toBe(true);
    expect(canSeeChat(spectator, 2, players, new Map())).toBe(true);
  });
});

describe("parseChatCommand", () => {
  it("recognizes /public and /private", () => {
    expect(parseChatCommand(" /Private ")).toBe("private");
    expect(parseChatCommand("/public")).toBe("public");
    expect(parseChatCommand("hello /public")).toBeNull();
  });
});
