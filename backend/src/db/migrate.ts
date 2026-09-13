import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "./client.js";

/** Applies any pending SQL migrations from ./drizzle, then exits. Safe to re-run. */
async function main() {
  console.log("Applying migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await closeDb();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await closeDb();
  process.exit(1);
});
