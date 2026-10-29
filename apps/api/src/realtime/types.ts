import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, OnlineUser, ServerToClientEvents } from "@pokedex/shared";

export type SocketData = { user: OnlineUser };

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function userRoom(userId: number): string {
  return `user:${userId}`;
}