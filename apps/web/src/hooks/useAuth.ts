import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, logIn, logOut, signUp } from "../api/auth";

export const currentUserKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserKey, queryFn: fetchCurrentUser });
}

export function useLogIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logIn,
    onSuccess: (user) => queryClient.setQueryData(currentUserKey, user),
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signUp,
    onSuccess: (user) => queryClient.setQueryData(currentUserKey, user),
  });
}

export function useLogOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logOut,
    onSuccess: () => {
      queryClient.setQueryData(currentUserKey, null);
      queryClient.removeQueries({ queryKey: ["teams"] });
    },
  });
}