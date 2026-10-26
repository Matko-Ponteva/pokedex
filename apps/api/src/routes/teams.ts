import { Router } from "express";
import { z } from "zod";
import { teamInputSchema } from "@pokedex/shared";
import { currentUser, requireAuth } from "../middleware/auth.ts";
import {
  createTeam, deleteTeam, getTeam, listTeams, updateTeam,
} from "../services/teamService.ts";

export const teamsRouter = Router();

teamsRouter.use(requireAuth);

const idParams = z.object({
  id: z.coerce.number().int().positive(),
});

teamsRouter.get("/", async (req, res) => {
  res.json(await listTeams(currentUser(req).id));
});

teamsRouter.post("/", async (req, res) => {
  const input = teamInputSchema.parse(req.body);
  res.status(201).json(await createTeam(currentUser(req).id, input));
});

teamsRouter.get("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await getTeam(currentUser(req).id, id));
});

teamsRouter.put("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = teamInputSchema.parse(req.body);
  res.json(await updateTeam(currentUser(req).id, id, input));
});

teamsRouter.delete("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  await deleteTeam(currentUser(req).id, id);
  res.status(204).end();
});