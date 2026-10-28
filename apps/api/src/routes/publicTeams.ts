import { Router } from "express";
import { z } from "zod";
import { getPublicTeam } from "../services/teamService.ts";

export const publicTeamsRouter = Router();

const shareParams = z.object({
  shareId: z.uuid(),
});

publicTeamsRouter.get("/:shareId", async (req, res) => {
  const { shareId } = shareParams.parse(req.params);
  res.json(await getPublicTeam(shareId));
});