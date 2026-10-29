export type OnlineUser = {
  id: number;
  displayName: string;
};

export interface ServerToClientEvents {
  "lobby:users": (users: OnlineUser[]) => void;
}

export interface ClientToServerEvents {
  "lobby:join": (reply: (users: OnlineUser[]) => void) => void;
  "lobby:leave": () => void;
}