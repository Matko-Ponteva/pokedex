import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { User } from "@pokedex/shared";
import { fetchCurrentUser, logIn, logOut, signUp } from "../api/auth";

export const currentUserKey = ["auth", "me"] as const;

function setCurrentUser(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData(currentUserKey, user);
  queryClient.resetQueries({ queryKey: ["public-teams"] });
}

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserKey, queryFn: fetchCurrentUser });
}

export function useLogIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logIn,
    onSuccess: (user) => setCurrentUser(queryClient, user),
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signUp,
    onSuccess: (user) => setCurrentUser(queryClient, user),
  });
}

export function useLogOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logOut,
    onSuccess: () => {
      setCurrentUser(queryClient, null);
      queryClient.removeQueries({ queryKey: ["teams"] });
    },
  });
}