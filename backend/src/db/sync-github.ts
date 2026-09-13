import { closeDb } from "./client.js";
import { syncGithubMetrics } from "../services/github.js";

/**
 * Runs the GitHub metrics sync once and exits.
 *
 * The server runs this on a six-hour schedule, but a fresh deployment starts with no metrics
 * and shouldn't sit empty until the first cron tick. Also useful after adding a project, and
 * for reproducing sync failures without going through the admin UI.
 */
async function main() {
  console.log("Syncing GitHub metrics...");
  const result = await syncGithubMetrics();

  console.log(`  synced: ${result.synced}`);
  console.log(`  failed: ${result.failed}`);
  for (const e of result.errors) {
    console.log(`    ${e.repo}: ${e.error}`);
  }

  await closeDb();
  // A partial sync is still a failure worth surfacing to a caller or CI step.
  if (result.failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("Sync failed:", err);
  await closeDb();
  process.exit(1);
});
