import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { createSocketServer } from "./realtime/socketServer.ts";

const port = Number(process.env.PORT ?? 3000);

const httpServer = createServer(createApp());
createSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});