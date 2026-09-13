import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

/**
 * Neon terminates idle connections, and a free-tier instance has a modest connection ceiling,
 * so the pool is kept small with an idle timeout rather than holding connections open.
 */
export const sql = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 5 : 2,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(sql, { schema });

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
