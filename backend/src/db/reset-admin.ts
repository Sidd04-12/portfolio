import { closeDb, db } from "./client.js";
import { adminUsers } from "./schema.js";

/**
 * Removes every admin account.
 *
 * With no rows here, `/api/admin/login` rejects every credential, so the admin surface is
 * closed until an account is deliberately recreated by running the seed with a real
 * ADMIN_PASSWORD set.
 */
async function main() {
  const deleted = await db.delete(adminUsers).returning({ email: adminUsers.email });
  if (deleted.length === 0) {
    console.log("No admin accounts existed.");
  } else {
    for (const row of deleted) {
      console.log(`  removed admin account: ${row.email}`);
    }
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error("Failed to reset admin accounts:", err);
  await closeDb();
  process.exit(1);
});
