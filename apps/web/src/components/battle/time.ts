import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function secondsUntil(time: string | null, now: number): number | null {
  return time === null ? null : Math.max(0, Math.ceil((Date.parse(time) - now) / 1000));
}
