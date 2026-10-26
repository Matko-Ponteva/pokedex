import type { LogInInput, SignUpInput, User } from "@pokedex/shared";
import { apiRequest, HttpError } from "./client";

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiRequest<User>("/auth/me");
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null;
    throw error;
  }
}

export function logIn(input: LogInInput) {
  return apiRequest<User>("/auth/login", { method: "POST", body: input });
}

export function signUp(input: SignUpInput) {
  return apiRequest<User>("/auth/signup", { method: "POST", body: input });
}

export function logOut() {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}