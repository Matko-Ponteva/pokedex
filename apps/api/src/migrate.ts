import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db/client.ts";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied");
await pool.end();