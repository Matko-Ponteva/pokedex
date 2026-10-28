import express from "express";
import cookieParser from "cookie-parser";
import { pokemonRouter } from "./routes/pokemon.ts";
import { authRouter } from "./routes/auth.ts";
import { teamsRouter } from "./routes/teams.ts";
import { requestLogger } from "./middleware/requestLogger.ts";
import { loadSession } from "./middleware/auth.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { pool } from "./db/client.ts";
import { movesRouter } from "./routes/moves.ts";
import { publicTeamsRouter } from "./routes/publicTeams.ts";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());
  app.use(loadSession);

  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/pokemon", pokemonRouter);
  app.use("/api/teams", teamsRouter);
  app.use("/api/moves", movesRouter);
  app.use("/api/public/teams", publicTeamsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}