import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, OnlineUser, ServerToClientEvents } from "@pokedex/shared";
import { SESSION_COOKIE, validateSession } from "../lib/sessions.ts";
import { addConnection, onlineUsers, removeConnection } from "./presence.ts";

type SocketData = { user: OnlineUser };

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

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
    if (addConnection(user)) broadcastLobby();

    socket.on("lobby:join", (reply) => {
      socket.join("lobby");
      reply(onlineUsers());
    });

    socket.on("lobby:leave", () => {
      socket.leave("lobby");
    });

    socket.on("disconnect", () => {
      if (removeConnection(user.id)) broadcastLobby();
    });
  });

  return io;
}