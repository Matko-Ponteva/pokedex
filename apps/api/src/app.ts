import express from "express";
import { pokemonRouter } from "./routes/pokemon.ts";
import { requestLogger } from "./middleware/requestLogger.ts";
import { errorHandler } from "./middleware/errorHandler.ts";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/pokemon", pokemonRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}