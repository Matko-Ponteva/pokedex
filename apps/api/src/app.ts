import express from "express";
import { pokemonRouter } from "./routes/pokemon.ts";
import { requestLogger } from "./middleware/requestLogger.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { pool } from "./db/client.ts";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", database: "ok" });
  });
  app.use("/api/pokemon", pokemonRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}