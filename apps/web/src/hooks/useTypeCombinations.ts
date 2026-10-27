import { useQuery } from "@tanstack/react-query";
import { fetchTypeCombinations } from "../api/pokemon";

export function useTypeCombinations() {
  return useQuery({
    queryKey: ["pokemon", "type-combinations"],
    queryFn: fetchTypeCombinations,
  });
}