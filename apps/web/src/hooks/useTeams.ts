import { useInfiniteQuery, useMutation, useQuery, useQueryClient, keepPreviousData, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { PublicTeamSort, Team, TeamInput, PublicTeam, PublicTeamListResponse } from "@pokedex/shared";
import { createTeam, deleteTeam, fetchTeam, fetchTeams, updateTeam, fetchPublicTeam, fetchPublicTeams, likeTeam } from "../api/teams";

const teamsKey = ["teams"] as const;
const teamKey = (id: number) => ["teams", id] as const;

export function useTeams() {
  return useQuery({ queryKey: teamsKey, queryFn: fetchTeams });
}

export function useTeam(id: number | null) {
  return useQuery({
    queryKey: teamKey(id ?? 0),
    queryFn: () => fetchTeam(id!),
    enabled: id !== null,
  });
}

export function useSaveTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: TeamInput }) =>
      id === null ? createTeam(input) : updateTeam(id, input),
    onSuccess: (team) => {
      queryClient.setQueryData(teamKey(team.id), team);
      queryClient.setQueryData<Team[]>(teamsKey, (teams) => {
        if (!teams) return teams;
        return teams.some((t) => t.id === team.id)
          ? teams.map((t) => (t.id === team.id ? team : t))
          : [...teams, team];
      });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTeam,
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: teamsKey, exact: true });
      const previous = queryClient.getQueryData<Team[]>(teamsKey);
      queryClient.setQueryData<Team[]>(teamsKey, (teams) => teams?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(teamsKey, context.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: teamKey(id), exact: true });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamsKey, exact: true });
    },
  });
}

export function usePublicTeam(shareId: string) {
  return useQuery({
    queryKey: ["public-teams", shareId],
    queryFn: () => fetchPublicTeam(shareId),
  });
}

export function usePublicTeams(search: string, sort: PublicTeamSort) {
  return useInfiniteQuery({
    queryKey: ["public-teams", "list", { search, sort }],
    queryFn: ({ pageParam }) => fetchPublicTeams({ search, sort, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

const publicTeamsKey = ["public-teams"] as const;

function updatePublicTeam(
  queryClient: QueryClient,
  shareId: string,
  change: (team: PublicTeam) => PublicTeam
) {
  queryClient.setQueryData<PublicTeam>([...publicTeamsKey, shareId], (team) =>
    team ? change(team) : team
  );
  queryClient.setQueriesData<InfiniteData<PublicTeamListResponse>>(
    { queryKey: [...publicTeamsKey, "list"] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((team) => (team.shareId === shareId ? change(team) : team)),
        })),
      }
  );
}

export function useLikeTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, liked }: { shareId: string; liked: boolean }) =>
      likeTeam(shareId, liked),
    onMutate: async ({ shareId, liked }) => {
      await queryClient.cancelQueries({ queryKey: publicTeamsKey });
      const snapshot = queryClient.getQueriesData({ queryKey: publicTeamsKey });
      updatePublicTeam(queryClient, shareId, (team) => ({
        ...team,
        likedByMe: liked,
        likeCount: team.likeCount + (liked ? 1 : -1),
      }));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (state, { shareId }) => {
      updatePublicTeam(queryClient, shareId, (team) => ({ ...team, ...state }));
    },
  });
}