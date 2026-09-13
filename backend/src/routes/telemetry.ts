import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { events, visits } from "../db/schema.js";
import { safeReferrer, visitorHash } from "../lib/visitor.js";
import * as stats from "../services/stats.js";

const visitBody = z.object({
  path: z.string().max(512).default("/"),
  referrer: z.string().max(2048).optional(),
});

const eventBody = z.object({
  type: z.enum(["project_open", "link_click", "theme_toggle"]),
  projectSlug: z.string().max(128).optional(),
  detail: z.string().max(256).optional(),
});

export default async function telemetryRoutes(app: FastifyInstance) {
  /**
   * Records a page view.
   *
   * Rate limited per IP because this is an unauthenticated write endpoint — without a cap,
   * anyone could inflate the numbers or fill the table. Responds 204 and never returns an error
   * to the caller: analytics failing must not produce a visible error on a page someone is
   * trying to read.
   */
  app.post(
    "/api/telemetry/visit",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = visitBody.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(204).send();

      try {
        await db.insert(visits).values({
          path: parsed.data.path,
          referrer: safeReferrer(parsed.data.referrer ?? req.headers.referer),
          visitorHash: visitorHash(req),
        });
      } catch (err) {
        req.log.error({ err }, "failed to record visit");
      }
      return reply.code(204).send();
    },
  );

  app.post(
    "/api/telemetry/event",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = eventBody.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(204).send();

      try {
        await db.insert(events).values({
          type: parsed.data.type,
          projectSlug: parsed.data.projectSlug ?? null,
          detail: parsed.data.detail ?? null,
          visitorHash: visitorHash(req),
        });
      } catch (err) {
        req.log.error({ err }, "failed to record event");
      }
      return reply.code(204).send();
    },
  );

  /** Public aggregates — the numbers the dashboard tiles display. */
  app.get("/api/stats/overview", async () => stats.overview());

  app.get<{ Querystring: { days?: string } }>("/api/stats/timeseries", async (req) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 7), 90);
    return { points: await stats.timeseries(days) };
  });
}
