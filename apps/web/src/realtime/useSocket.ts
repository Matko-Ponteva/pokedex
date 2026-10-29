import { useEffect, useState, useSyncExternalStore } from "react";
import type { OnlineUser } from "@pokedex/shared";
import { useCurrentUser } from "../hooks/useAuth";
import { socket } from "./socket";

export function useSocketConnection() {
  const { data: user } = useCurrentUser();
  const userId = user?.id;

  useEffect(() => {
    if (userId === undefined) return;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [userId]);
}

function subscribeToStatus(onChange: () => void) {
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
  };
}

export function useSocketConnected(): boolean {
  return useSyncExternalStore(subscribeToStatus, () => socket.connected);
}

export function useOnlineUsers(): OnlineUser[] | null {
  const [users, setUsers] = useState<OnlineUser[] | null>(null);
  const connected = useSocketConnected();

  useEffect(() => {
    if (!connected) return;
    socket.emit("lobby:join", setUsers);
    socket.on("lobby:users", setUsers);
    return () => {
      socket.off("lobby:users", setUsers);
      socket.emit("lobby:leave");
    };
  }, [connected]);

  return users;
}