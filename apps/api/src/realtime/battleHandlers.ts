import { randomUUID } from "node:crypto";
import {
  battleChallengeInputSchema, battleForfeitInputSchema, battleMoveInputSchema, battleRespondInputSchema,
  resolveTurn, viewFor,
  type Battle, type ChallengeInfo, type Combatant, type OnlineUser,
} from "@pokedex/shared";
import { HttpError } from "../lib/errors.ts";
import { loadCombatants } from "../services/battleService.ts";
import { onlineUser } from "./presence.ts";
import { respond } from "./respond.ts";
import { userRoom, type AppServer, type AppSocket } from "./types.ts";

const CHALLENGE_LIFETIME_MS = 60_000;
const FINISHED_BATTLE_LIFETIME_MS = 5 * 60_000;

type PendingChallenge = {
  info: ChallengeInfo;
  fromTeam: Combatant[];
  timer: ReturnType<typeof setTimeout>;
};

type LiveBattle = {
  battle: Battle;
  choices: Map<number, number>;
};

const challenges = new Map<string, PendingChallenge>();
const battles = new Map<string, LiveBattle>();

function closeChallenge(io: AppServer, challenge: PendingChallenge, messages: { from: string; to: string }) {
  const challengeId = challenge.info.id;
  clearTimeout(challenge.timer);
  challenges.delete(challengeId);
  io.to(userRoom(challenge.info.from.id)).emit("battle:challenge-closed", { challengeId, message: messages.from });
  io.to(userRoom(challenge.info.to.id)).emit("battle:challenge-closed", { challengeId, message: messages.to });
}

function sendState(io: AppServer, live: LiveBattle) {
  const chosen = new Set(live.choices.keys());
  for (const side of live.battle.sides) {
    io.to(userRoom(side.userId)).emit("battle:state", viewFor(live.battle, side.userId, chosen));
  }
}

function finish(live: LiveBattle) {
  setTimeout(() => battles.delete(live.battle.id), FINISHED_BATTLE_LIFETIME_MS);
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

export function cancelChallengesFor(io: AppServer, user: OnlineUser) {
  for (const challenge of [...challenges.values()]) {
    if (challenge.info.from.id !== user.id && challenge.info.to.id !== user.id) continue;
    const message = `The challenge was withdrawn because ${user.displayName} went offline.`;
    closeChallenge(io, challenge, { from: message, to: message });
  }
}

export function registerBattleHandlers(io: AppServer, socket: AppSocket) {
  const me = socket.data.user;

  for (const challenge of challenges.values()) {
    if (challenge.info.from.id === me.id || challenge.info.to.id === me.id) {
      socket.emit("battle:challenged", challenge.info);
    }
  }
  const current = activeBattleOf(me.id);
  if (current) {
    socket.emit("battle:state", viewFor(current.battle, me.id, new Set(current.choices.keys())));
  }

  socket.on("battle:challenge", (input, reply) =>
    respond(reply, async () => {
      const { toUserId, teamId } = battleChallengeInputSchema.parse(input);
      if (toUserId === me.id) throw new HttpError(400, "You can't battle yourself");
      const opponent = onlineUser(toUserId);
      if (!opponent) throw new HttpError(400, "That trainer is no longer online");

      const fromTeam = await loadCombatants(me.id, teamId);

      if (isBusy(me.id)) throw new HttpError(409, "Finish your current challenge or battle first");
      if (isBusy(toUserId)) throw new HttpError(409, `${opponent.displayName} is busy right now`);

      const info: ChallengeInfo = {
        id: randomUUID(),
        from: me,
        to: opponent,
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

      const myTeam = await loadCombatants(me.id, teamId);

      if (challenges.get(challengeId) !== challenge) {
        throw new HttpError(404, "This challenge is no longer available");
      }
      clearTimeout(challenge.timer);
      challenges.delete(challengeId);

      const battle: Battle = {
        id: randomUUID(),
        turn: 0,
        winner: null,
        log: [`${challenger.displayName} and ${me.displayName} start a battle!`],
        sides: [
          { userId: challenger.id, displayName: challenger.displayName, team: challenge.fromTeam, active: 0 },
          { userId: me.id, displayName: me.displayName, team: myTeam, active: 0 },
        ],
      };
      const live: LiveBattle = { battle, choices: new Map() };
      battles.set(battle.id, live);

      io.to(userRoom(challenger.id))
        .to(userRoom(me.id))
        .emit("battle:challenge-closed", { challengeId, message: "The battle has started." });
      sendState(io, live);
      return null;
    })
  );

  socket.on("battle:move", (input, reply) =>
    respond(reply, async () => {
      const { battleId, moveIndex } = battleMoveInputSchema.parse(input);
      const live = battles.get(battleId);
      const side = live?.battle.sides.find((s) => s.userId === me.id);
      if (!live || !side) throw new HttpError(404, "This battle isn't available");
      if (live.battle.winner !== null) throw new HttpError(409, "The battle is over");
      if (live.choices.has(me.id)) throw new HttpError(409, "You've already chosen a move this turn");
      if (moveIndex >= side.team[side.active].moves.length) {
        throw new HttpError(400, "That move doesn't exist");
      }

      live.choices.set(me.id, moveIndex);
      if (live.choices.size === 2) {
        const [first, second] = live.battle.sides.map((s) => live.choices.get(s.userId) ?? 0);
        live.battle = resolveTurn(live.battle, [first, second], Math.random);
        live.choices.clear();
        if (live.battle.winner !== null) finish(live);
      }

      sendState(io, live);
      return null;
    })
  );

  socket.on("battle:forfeit", (input) => {
    const parsed = battleForfeitInputSchema.safeParse(input);
    const live = parsed.success ? battles.get(parsed.data.battleId) : undefined;
    if (!live || live.battle.winner !== null) return;
    if (!live.battle.sides.some((side) => side.userId === me.id)) return;

    const opponent = live.battle.sides.find((side) => side.userId !== me.id);
    if (!opponent) return;
    live.battle = {
      ...live.battle,
      winner: opponent.userId,
      log: [...live.battle.log, `${me.displayName} forfeited. ${opponent.displayName} wins the battle!`],
    };
    live.choices.clear();
    finish(live);
    sendState(io, live);
  });
}