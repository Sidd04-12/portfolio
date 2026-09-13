import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError } from "fastify";
import cron from "node-cron";
import { closeDb, sql } from "./db/client.js";
import { corsOrigins, env } from "./lib/env.js";
import adminRoutes from "./routes/admin.js";
import projectRoutes from "./routes/projects.js";
import telemetryRoutes from "./routes/telemetry.js";
import { syncGithubMetrics } from "./services/github.js";
import { rollupDay } from "./services/stats.js";

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
  },
  // Render and Vercel sit in front of this; without trustProxy the client IP would always be
  // the proxy's, which would collapse every visitor into one hash.
  trustProxy: true,
});

await app.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

await app.register(rateLimit, {
  global: false,
  max: 200,
  timeWindow: "1 minute",
});

await app.register(jwt, { secret: env.JWT_SECRET });

/**
 * Health check.
 *
 * Actually touches the database rather than just returning 200 — a process that's up but can't
 * reach Postgres is not healthy, and reporting otherwise defeats the point of a health check.
 */
app.get("/health", async (_req, reply) => {
  try {
    await sql`SELECT 1`;
    return { status: "ok", db: "up", uptime: Math.floor(process.uptime()) };
  } catch (err) {
    app.log.error({ err }, "health check failed");
    return reply.code(503).send({ status: "degraded", db: "down" });
  }
});

/**
 * Must be registered BEFORE the route plugins.
 *
 * `register()` creates an encapsulated child context that inherits the error handler as it
 * exists at registration time. Setting this afterwards leaves every route on Fastify's default
 * handler, which serialises the raw error — so a failed query answered callers with the
 * Postgres error code and table name ("relation \"projects\" does not exist"). Ordering is the
 * whole fix; the handler itself was always correct.
 */
app.setErrorHandler((error: FastifyError, req, reply) => {
  req.log.error({ err: error }, "unhandled error");
  const status = error.statusCode ?? 500;
  // Never leak internals to the client on a 500; log the detail instead.
  reply.code(status).send({
    error: status === 500 ? "internal_error" : (error.code ?? "error"),
    message: status === 500 ? "Something went wrong" : error.message,
  });
});

await app.register(projectRoutes);
await app.register(telemetryRoutes);
await app.register(adminRoutes);

/**
 * Scheduled work. Only runs in production so a local dev server doesn't spend GitHub rate limit
 * or race the deployed instance for the same rollup.
 */
if (env.NODE_ENV === "production") {
  cron.schedule(env.SYNC_CRON, async () => {
    app.log.info("running scheduled GitHub sync");
    try {
      const result = await syncGithubMetrics();
      app.log.info(result, "GitHub sync finished");
    } catch (err) {
      app.log.error({ err }, "GitHub sync failed");
    }
  });

  cron.schedule(env.ROLLUP_CRON, async () => {
    app.log.info("rolling up yesterday's visits");
    try {
      await rollupDay();
    } catch (err) {
      app.log.error({ err }, "daily rollup failed");
    }
  });
}

/** Finish in-flight requests and release the pool before exiting. */
async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  try {
    await app.close();
    await closeDb();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error({ err }, "failed to start");
  process.exit(1);
}
