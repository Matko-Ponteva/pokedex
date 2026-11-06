import { randomUUID } from "node:crypto";
import {
  battleChallengeInputSchema, battleChatInputSchema, battleChatModeInputSchema, battleForfeitInputSchema,
  battleActionInputSchema, battleIdInputSchema, battleRespondInputSchema,
  activePerSide, canSeeChat, defaultChoice, healthyBench, isReplacing, replacementsError, replacingPositions, resolveReplacements,
  resolveTurn, rulesetOf, sideChoicesError, slotActs, slotOf, spectatorView, viewFor,
  type Battle, type BattleChoice, type BattleSide, type SideIndex, type ChallengeInfo, type ChatMessage, type ChatMode, type Combatant,
  type LiveBattleInfo, type OnlineUser, type SpectatorView,
} from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";
import { loadCombatants } from "../services/battleService.ts";
import { onlineUser } from "./presence.ts";
import { respond } from "./respond.ts";
import { userRoom, watchRoom, type AppServer, type AppSocket } from "./types.ts";

const CHALLENGE_LIFETIME_MS = 60_000;
const FINISHED_BATTLE_LIFETIME_MS = 5 * 60_000;
const TURN_LIMIT_MS = 45_000;
const RECONNECT_WINDOW_MS = 30_000;
const MAX_TIMEOUTS = 2;
const CHAT_HISTORY = 100;
// At most CHAT_BURST messages per CHAT_WINDOW_MS for each user
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 5000;

type Timer = ReturnType<typeof setTimeout>;

type PendingChallenge = {
  info: ChallengeInfo;
  fromTeam: Combatant[];
  timer: Timer;
};

/** What a player chose for each of their positions; null for positions with nothing to do */
type PositionChoices = (BattleChoice | null)[];

type LiveBattle = {
  battle: Battle;
  choices: Map<number, PositionChoices>;
  turnEndsAt: number | null;
  turnTimer: Timer | null;
  timeouts: Map<number, number>;
  away: Map<number, { until: number; timer: Timer }>;
  /** Spectating socket id → user */
  spectators: Map<string, OnlineUser>;
  chat: ChatMessage[];
  chatModes: Map<number, ChatMode>;
};

/** Used when a player runs out of time */

const challenges = new Map<string, PendingChallenge>();
const battles = new Map<string, LiveBattle>();
const recentChats = new Map<number, number[]>();

// ---------- Challenges ----------

function closeChallenge(io: AppServer, challenge: PendingChallenge, messages: { from: string; to: string }) {
  const challengeId = challenge.info.id;
  clearTimeout(challenge.timer);
  challenges.delete(challengeId);
  io.to(userRoom(challenge.info.from.id)).emit("battle:challenge-closed", { challengeId, message: messages.from });
  io.to(userRoom(challenge.info.to.id)).emit("battle:challenge-closed", { challengeId, message: messages.to });
}

export function cancelChallengesFor(io: AppServer, user: OnlineUser) {
  for (const challenge of [...challenges.values()]) {
    if (challenge.info.from.id !== user.id && challenge.info.to.id !== user.id) continue;
    const message = `The challenge was withdrawn because ${user.displayName} went offline.`;
    closeChallenge(io, challenge, { from: message, to: message });
  }
}

// ---------- Battle state ----------

function otherSide(live: LiveBattle, userId: number): BattleSide {
  const [first, second] = live.battle.sides;
  return first.userId === userId ? second : first;
}

function appendLog(live: LiveBattle, line: string) {
  live.battle = { ...live.battle, log: [...live.battle.log, line].slice(-40) };
}

function spectatorCount(live: LiveBattle): number {
  return new Set([...live.spectators.values()].map((user) => user.id)).size;
}

function viewInputs(live: LiveBattle) {
  return {
    chosen: new Set(live.choices.keys()),
    timing: {
      turnEndsAt: live.turnEndsAt,
      awayUntil: new Map([...live.away].map(([userId, entry]) => [userId, entry.until])),
    },
    extras: { chatModes: live.chatModes, spectators: spectatorCount(live) },
  };
}

function spectatorStateOf(live: LiveBattle): SpectatorView {
  const { chosen, timing, extras } = viewInputs(live);
  return spectatorView(live.battle, chosen, timing, extras);
}

function sendState(io: AppServer, live: LiveBattle) {
  const { chosen, timing, extras } = viewInputs(live);
  for (const side of live.battle.sides) {
    io.to(userRoom(side.userId)).emit("battle:state", viewFor(live.battle, side.userId, chosen, timing, extras));
  }
  io.to(watchRoom(live.battle.id)).emit("battle:spectate-state", spectatorStateOf(live));
}

function isPlayer(live: LiveBattle, userId: number): boolean {
  return live.battle.sides.some((side) => side.userId === userId);
}

function playerIds(live: LiveBattle): number[] {
  return live.battle.sides.map((side) => side.userId);
}

function visibleChat(live: LiveBattle, viewerId: number): ChatMessage[] {
  return live.chat.filter((message) => canSeeChat(message, viewerId, playerIds(live), live.chatModes));
}

function sendChatHistory(io: AppServer, live: LiveBattle, userId: number) {
  io.to(userRoom(userId)).emit("battle:chat-history", {
    battleId: live.battle.id,
    messages: visibleChat(live, userId),
  });
}

export function liveBattles(): LiveBattleInfo[] {
  return [...battles.values()]
    .filter((live) => live.battle.winner === null)
    .map((live) => {
      const [a, b] = live.battle.sides;
      return {
        id: live.battle.id,
        players: [
          { id: a.userId, displayName: a.displayName },
          { id: b.userId, displayName: b.displayName },
        ],
        ruleset: rulesetOf(live.battle.ruleset),
        turn: live.battle.turn,
        spectators: spectatorCount(live),
      };
    });
}

function broadcastBattles(io: AppServer) {
  io.to("lobby").emit("lobby:battles", liveBattles());
}

function removeSpectator(io: AppServer, live: LiveBattle, socket: AppSocket) {
  if (!live.spectators.delete(socket.id)) return;
  socket.leave(watchRoom(live.battle.id));
  sendState(io, live);
  broadcastBattles(io);
}

function activeBattleOf(userId: number): LiveBattle | undefined {
  return [...battles.values()].find(
    (live) => live.battle.winner === null && live.battle.sides.some((side) => side.userId === userId)
  );
}

function isBusy(userId: number): boolean {
  const inChallenge = [...challenges.values()].some(
    (c) => c.info.from.id === userId || c.info.to.id === userId
  );
  return inChallenge || activeBattleOf(userId) !== undefined;
}

// ---------- Timers ----------

function clearTurnTimer(live: LiveBattle) {
  if (live.turnTimer) clearTimeout(live.turnTimer);
  live.turnTimer = null;
  live.turnEndsAt = null;
}

function startTurnTimer(io: AppServer, live: LiveBattle) {
  clearTurnTimer(live);
  if (live.battle.winner !== null || live.away.size > 0) return;
  live.turnEndsAt = Date.now() + TURN_LIMIT_MS;
  live.turnTimer = setTimeout(() => onTurnTimeout(io, live), TURN_LIMIT_MS);
}

function stopBattle(io: AppServer, live: LiveBattle) {
  clearTurnTimer(live);
  for (const entry of live.away.values()) clearTimeout(entry.timer);
  live.away.clear();
  broadcastBattles(io);
  setTimeout(() => {
    battles.delete(live.battle.id);
    io.in(watchRoom(live.battle.id)).socketsLeave(watchRoom(live.battle.id));
  }, FINISHED_BATTLE_LIFETIME_MS);
}

function endBattle(io: AppServer, live: LiveBattle, winnerId: number, line: string) {
  live.battle = { ...live.battle, winner: winnerId };
  appendLog(live, line);
  live.choices.clear();
  stopBattle(io, live);
  sendState(io, live);
}

/** Players who still have to decide: both in a normal turn, only those replacing a fainted Pokémon otherwise */
function deciders(live: LiveBattle): BattleSide[] {
  const { battle } = live;
  return battle.sides.filter((_, index) => !battle.replacing || isReplacing(battle, index as SideIndex));
}

/** Per-slot choices for the engine, out of each player's per-position choices */
function bySlot<T>(live: LiveBattle, pick: (side: SideIndex, choices: PositionChoices | undefined, position: number) => T | null): (T | null)[] {
  const slots: (T | null)[] = [];
  live.battle.sides.forEach((side, index) => {
    const choices = live.choices.get(side.userId);
    const positions = side.actives?.length ?? 1;
    for (let position = 0; position < positions; position++) slots[slotOf(index as SideIndex, position)] = pick(index as SideIndex, choices, position);
  });
  return slots;
}

/** What a player's Pokémon do when the player runs out of time: the first usable move, or the first healthy replacements */
function defaultChoices(battle: Battle, side: SideIndex): PositionChoices {
  const positions = battle.sides[side].actives?.length ?? 1;
  if (battle.replacing) {
    const bench = healthyBench(battle.sides[side]);
    const replacing = replacingPositions(battle, side);
    return Array.from({ length: positions }, (_, position) => {
      const order = replacing.indexOf(position);
      return order === -1 ? null : { kind: "switch" as const, index: bench[order] };
    });
  }
  return Array.from({ length: positions }, (_, position) => {
    const slot = slotOf(side, position);
    return slotActs(battle, slot) ? defaultChoice(battle, slot) : null;
  });
}

function everyoneDecided(live: LiveBattle): boolean {
  return deciders(live).every((side) => live.choices.has(side.userId));
}

function resolveAndAdvance(io: AppServer, live: LiveBattle) {
  if (live.battle.replacing) {
    const picks = bySlot(live, (_, choices, position) => {
      const choice = choices?.[position];
      return choice?.kind === "switch" ? choice.index : null;
    });
    live.battle = resolveReplacements(live.battle, picks);
  } else {
    const choices = bySlot(live, (side, choices, position) => (choices ?? defaultChoices(live.battle, side))[position] ?? null);
    live.battle = resolveTurn(live.battle, choices, Math.random);
  }
  live.choices.clear();
  if (live.battle.winner !== null) stopBattle(io, live);
  else startTurnTimer(io, live);
  sendState(io, live);
}

function onTurnTimeout(io: AppServer, live: LiveBattle) {
  live.turnTimer = null;
  live.turnEndsAt = null;

  for (const side of deciders(live)) {
    if (live.choices.has(side.userId)) continue;
    const count = (live.timeouts.get(side.userId) ?? 0) + 1;
    live.timeouts.set(side.userId, count);

    if (count >= MAX_TIMEOUTS) {
      const winner = otherSide(live, side.userId);
      endBattle(
        io,
        live,
        winner.userId,
        `${side.displayName} ran out of time twice and forfeits. ${winner.displayName} wins the battle!`
      );
      return;
    }

    const index = live.battle.sides.indexOf(side) as SideIndex;
    if (live.battle.replacing) {
      appendLog(live, `${side.displayName} ran out of time, so their next Pokémon was picked for them.`);
    } else {
      appendLog(live, `${side.displayName} ran out of time, so their Pokémon used its first usable move.`);
    }
    live.choices.set(side.userId, defaultChoices(live.battle, index));
  }

  resolveAndAdvance(io, live);
}

export function handleBattleDisconnect(io: AppServer, user: OnlineUser) {
  const live = activeBattleOf(user.id);
  if (!live || live.away.has(user.id)) return;

  clearTurnTimer(live);
  const opponent = otherSide(live, user.id);
  const timer = setTimeout(() => {
    endBattle(
      io,
      live,
      opponent.userId,
      `${user.displayName} didn't come back. ${opponent.displayName} wins the battle!`
    );
  }, RECONNECT_WINDOW_MS);

  live.away.set(user.id, { until: Date.now() + RECONNECT_WINDOW_MS, timer });
  appendLog(live, `${user.displayName} lost their connection.`);
  sendState(io, live);
}

// ---------- Socket handlers ----------

export function registerBattleHandlers(io: AppServer, socket: AppSocket) {
  const me = socket.data.user;

  for (const challenge of challenges.values()) {
    if (challenge.info.from.id === me.id || challenge.info.to.id === me.id) {
      socket.emit("battle:challenged", challenge.info);
    }
  }

  const current = activeBattleOf(me.id);
  const away = current?.away.get(me.id);
  if (current && away) {
    clearTimeout(away.timer);
    current.away.delete(me.id);
    appendLog(current, `${me.displayName} is back.`);
    startTurnTimer(io, current);
    sendState(io, current);
  } else if (current) {
    sendState(io, current);
  }
  if (current) {
    socket.emit("battle:chat-history", { battleId: current.battle.id, messages: visibleChat(current, me.id) });
  }

  socket.on("battle:challenge", (input, reply) =>
    respond(reply, async () => {
      const { toUserId, teamId, rulesetId } = battleChallengeInputSchema.parse(input);
      const ruleset = rulesetOf(rulesetId);
      if (toUserId === me.id) throw new HttpError(400, "You can't battle yourself");
      const opponent = onlineUser(toUserId);
      if (!opponent) throw new HttpError(400, "That trainer is no longer online");

      const fromTeam = await loadCombatants(me.id, teamId, ruleset);

      if (isBusy(me.id)) throw new HttpError(409, "Finish your current challenge or battle first");
      if (isBusy(toUserId)) throw new HttpError(409, `${opponent.displayName} is busy right now`);

      const info: ChallengeInfo = {
        id: randomUUID(),
        from: me,
        to: opponent,
        ruleset,
        expiresAt: new Date(Date.now() + CHALLENGE_LIFETIME_MS).toISOString(),
      };
      const challenge: PendingChallenge = {
        info,
        fromTeam,
        timer: setTimeout(() => {
          closeChallenge(io, challenge, {
            from: `${opponent.displayName} didn't answer your challenge.`,
            to: `The challenge from ${me.displayName} expired.`,
          });
        }, CHALLENGE_LIFETIME_MS),
      };
      challenges.set(info.id, challenge);

      io.to(userRoom(me.id)).to(userRoom(opponent.id)).emit("battle:challenged", info);
      return info;
    })
  );

  socket.on("battle:respond", (input, reply) =>
    respond(reply, async () => {
      const { challengeId, accept, teamId } = battleRespondInputSchema.parse(input);
      const challenge = challenges.get(challengeId);
      if (!challenge || challenge.info.to.id !== me.id) {
        throw new HttpError(404, "This challenge is no longer available");
      }
      const challenger = challenge.info.from;

      if (!accept) {
        closeChallenge(io, challenge, {
          from: `${me.displayName} declined your challenge.`,
          to: "You declined the challenge.",
        });
        return null;
      }
      if (teamId === undefined) throw new HttpError(400, "Choose a team to battle with");

      const myTeam = await loadCombatants(me.id, teamId, challenge.info.ruleset);

      if (challenges.get(challengeId) !== challenge) {
        throw new HttpError(404, "This challenge is no longer available");
      }
      clearTimeout(challenge.timer);
      challenges.delete(challengeId);
      // In a double battle the first two team members lead (each side gets its own array)
      const leads = () => (activePerSide(challenge.info.ruleset.format) === 2 ? { actives: [0, 1] } : {});

      const live: LiveBattle = {
        battle: {
          id: randomUUID(),
          ruleset: challenge.info.ruleset.id,
          turn: 0,
          winner: null,
          log: [
            `${challenger.displayName} and ${me.displayName} start a battle!`,
            `Rules: ${challenge.info.ruleset.name}. ${challenge.info.ruleset.description}`,
          ],
          sides: [
            { userId: challenger.id, displayName: challenger.displayName, team: challenge.fromTeam, active: 0, ...leads() },
            { userId: me.id, displayName: me.displayName, team: myTeam, active: 0, ...leads() },
          ],
        },
        choices: new Map(),
        turnEndsAt: null,
        turnTimer: null,
        timeouts: new Map(),
        away: new Map(),
        spectators: new Map(),
        chat: [],
        chatModes: new Map(),
      };
      battles.set(live.battle.id, live);
      broadcastBattles(io);

      io.to(userRoom(challenger.id))
        .to(userRoom(me.id))
        .emit("battle:challenge-closed", { challengeId, message: "The battle has started." });
      startTurnTimer(io, live);
      sendState(io, live);
      return null;
    })
  );

  socket.on("battle:action", (input, reply) =>
    respond(reply, async () => {
      const { battleId, choices } = battleActionInputSchema.parse(input);
      const live = battles.get(battleId);
      const side = live?.battle.sides.find((s) => s.userId === me.id);
      if (!live || !side) throw new HttpError(404, "This battle isn't available");
      if (live.battle.winner !== null) throw new HttpError(409, "The battle is over");
      if (live.choices.has(me.id)) throw new HttpError(409, "You've already chosen what to do this turn");
      const index = live.battle.sides.indexOf(side) as SideIndex;
      if (live.battle.replacing) {
        if (!deciders(live).includes(side)) {
          throw new HttpError(409, "Wait for your opponent to send out their next Pokémon");
        }
        const picks = choices.map((choice) => (choice?.kind === "switch" ? choice.index : null));
        const error = replacementsError(live.battle, index, picks);
        if (error) throw new HttpError(400, error);
      } else {
        const error = sideChoicesError(live.battle, index, choices);
        if (error) throw new HttpError(400, error);
      }

      live.choices.set(me.id, choices);
      live.timeouts.set(me.id, 0);
      if (everyoneDecided(live)) resolveAndAdvance(io, live);
      else sendState(io, live);
      return null;
    })
  );

  socket.on("battle:forfeit", (input) => {
    const parsed = battleForfeitInputSchema.safeParse(input);
    const live = parsed.success ? battles.get(parsed.data.battleId) : undefined;
    if (!live || live.battle.winner !== null) return;
    if (!live.battle.sides.some((side) => side.userId === me.id)) return;

    const opponent = otherSide(live, me.id);
    endBattle(io, live, opponent.userId, `${me.displayName} forfeited. ${opponent.displayName} wins the battle!`);
  });

  // ---------- Spectators ----------

  socket.on("lobby:battles", (reply) => {
    if (typeof reply === "function") reply(liveBattles());
  });

  socket.on("battle:watch", (input, reply) =>
    respond(reply, async () => {
      const { battleId } = battleIdInputSchema.parse(input);
      const live = battles.get(battleId);
      if (!live) throw new HttpError(404, "This battle is over or doesn't exist");
      if (isPlayer(live, me.id)) throw new HttpError(409, "You're playing in this battle");

      live.spectators.set(socket.id, me);
      socket.join(watchRoom(battleId));
      sendState(io, live);
      broadcastBattles(io);
      return { view: spectatorStateOf(live), chat: visibleChat(live, me.id) };
    })
  );

  socket.on("battle:unwatch", (input) => {
    const parsed = battleIdInputSchema.safeParse(input);
    const live = parsed.success ? battles.get(parsed.data.battleId) : undefined;
    if (live) removeSpectator(io, live, socket);
  });

  socket.on("disconnect", () => {
    for (const live of battles.values()) removeSpectator(io, live, socket);
  });

  // ---------- Chat ----------

  socket.on("battle:chat", (input, reply) =>
    respond(reply, async () => {
      const { battleId, text } = battleChatInputSchema.parse(input);
      const live = battles.get(battleId);
      if (!live) throw new HttpError(404, "This battle isn't available");

      const player = isPlayer(live, me.id);
      const watching = [...live.spectators.values()].some((user) => user.id === me.id);
      if (!player && !watching) throw new HttpError(403, "Watch the battle to chat");

      const now = Date.now();
      const recent = (recentChats.get(me.id) ?? []).filter((time) => now - time < CHAT_WINDOW_MS);
      if (recent.length >= CHAT_BURST) {
        throw new HttpError(429, "You're sending messages too quickly");
      }
      recentChats.set(me.id, [...recent, now]);

      const message: ChatMessage = {
        id: randomUUID(),
        battleId,
        from: me,
        role: player ? "player" : "spectator",
        text,
        sentAt: new Date(now).toISOString(),
      };
      live.chat = [...live.chat, message].slice(-CHAT_HISTORY);

      const players = playerIds(live);
      const rooms = [
        watchRoom(battleId),
        ...players
          .filter((userId) => canSeeChat(message, userId, players, live.chatModes))
          .map((userId) => userRoom(userId)),
      ];
      io.to(rooms).emit("battle:chat-message", message);
      return null;
    })
  );

  socket.on("battle:chat-mode", (input, reply) =>
    respond(reply, async () => {
      const { battleId, mode } = battleChatModeInputSchema.parse(input);
      const live = battles.get(battleId);
      if (!live || !isPlayer(live, me.id)) throw new HttpError(404, "This battle isn't available");

      live.chatModes.set(me.id, mode);
      sendChatHistory(io, live, me.id);
      sendState(io, live);
      return null;
    })
  );
}
