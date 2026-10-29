import type { OnlineUser } from "@pokedex/shared";

const connections = new Map<number, { user: OnlineUser; count: number }>();

export function addConnection(user: OnlineUser): boolean {
  const entry = connections.get(user.id);
  if (entry) {
    entry.count += 1;
    return false;
  }
  connections.set(user.id, { user, count: 1 });
  return true;
}

export function removeConnection(userId: number): boolean {
  const entry = connections.get(userId);
  if (!entry) return false;
  entry.count -= 1;
  if (entry.count > 0) return false;
  connections.delete(userId);
  return true;
}

export function onlineUsers(): OnlineUser[] {
  return [...connections.values()]
    .map((entry) => entry.user)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}