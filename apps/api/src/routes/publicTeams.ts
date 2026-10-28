import { Router } from "express";
import { z } from "zod";
import { PUBLIC_TEAM_SORTS } from "@pokedex/shared";
import { getPublicTeam, listPublicTeams, setLike } from "../services/teamService.ts";
import { decodeCursor } from "../lib/cursor.ts";
import { currentUser, requireAuth } from "../middleware/auth.ts";

export const publicTeamsRouter = Router();

const listQuery = z.object({
  search: z.string().trim().max(40).optional(),
  sort: z.enum(PUBLIC_TEAM_SORTS).default("newest"),
  cursor: z.string().max(500).optional(),
});

const shareParams = z.object({
  shareId: z.uuid(),
});

publicTeamsRouter.get("/", async (req, res) => {
  const { search, sort, cursor } = listQuery.parse(req.query);
  res.json(
    await listPublicTeams({
      search: search || undefined,
      sort,
      cursor: cursor ? decodeCursor(cursor) : undefined,
      viewerId: req.user?.id,
    })
  );
});

publicTeamsRouter.get("/:shareId", async (req, res) => {
  const { shareId } = shareParams.parse(req.params);
  res.json(await getPublicTeam(shareId, req.user?.id));
});

publicTeamsRouter.put("/:shareId/like", requireAuth, async (req, res) => {
  const { shareId } = shareParams.parse(req.params);
  res.json(await setLike(currentUser(req).id, shareId, true));
});

publicTeamsRouter.delete("/:shareId/like", requireAuth, async (req, res) => {
  const { shareId } = shareParams.parse(req.params);
  res.json(await setLike(currentUser(req).id, shareId, false));
});