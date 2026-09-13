import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Neon connection string)"),
  /** Signs admin JWTs. Rotating it logs everyone out, which is the intended lever. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  /** Comma-separated list of allowed frontend origins. */
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /** Optional: raises the GitHub rate limit from 60/hr to 5000/hr. */
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_USER: z.string().default("Sidd04-12"),
  /** Salted into the visitor hash so it can't be recomputed from public information. */
  VISITOR_HASH_SECRET: z.string().min(16, "VISITOR_HASH_SECRET must be at least 16 characters"),
  SYNC_CRON: z.string().default("0 */6 * * *"),
  ROLLUP_CRON: z.string().default("15 0 * * *"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail at startup with a readable list rather than throwing somewhere deep in a request.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  console.error("Invalid environment configuration:\n" + issues.join("\n"));
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
