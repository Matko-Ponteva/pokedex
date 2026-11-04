import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SESSION_COOKIE, validateSession } from "../lib/sessions.ts";
import { addConnection, onlineUsers, removeConnection, onlineUser } from "./presence.ts";
import { cancelTradesFor, registerTradeHandlers } from "./tradeHandlers.ts";
import { userRoom, type AppServer } from "./types.ts";
import { cancelChallengesFor, handleBattleDisconnect, liveBattles, registerBattleHandlers } from "./battleHandlers.ts";

const OFFLINE_GRACE_MS = 5000;

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function createSocketServer(httpServer: HttpServer): AppServer {
  const io: AppServer = new Server(httpServer);

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.request.headers.cookie, SESSION_COOKIE);
      const session = token ? await validateSession(token) : null;
      if (!session) return next(new Error("unauthorized"));
      socket.data.user = { id: session.user.id, displayName: session.user.displayName };
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("server error"));
    }
  });

  function broadcastLobby() {
    io.to("lobby").emit("lobby:users", onlineUsers());
  }

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));
    if (addConnection(user)) broadcastLobby();

    registerTradeHandlers(io, socket);
    registerBattleHandlers(io, socket);

    socket.on("lobby:join", (reply) => {
      socket.join("lobby");
      reply(onlineUsers());
      socket.emit("lobby:battles", liveBattles());
    });

    socket.on("lobby:leave", () => {
      socket.leave("lobby");
    });

    socket.on("disconnect", () => {
      if (!removeConnection(user.id)) return;
      setTimeout(() => {
        if (onlineUser(user.id)) return;
        cancelTradesFor(io, user);
        cancelChallengesFor(io, user);
        handleBattleDisconnect(io, user);
        broadcastLobby();
      }, OFFLINE_GRACE_MS);
    });
  });

  return io;
}