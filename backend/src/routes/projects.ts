import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { projectMetrics, projects } from "../db/schema.js";

export default async function projectRoutes(app: FastifyInstance) {
  /** Everything the dashboard needs to render, in one request. */
  app.get("/api/projects", async () => {
    const rows = await db
      .select({
        slug: projects.slug,
        name: projects.name,
        kind: projects.kind,
        status: projects.status,
        blurb: projects.blurb,
        topology: projects.topology,
        stack: projects.stack,
        meta: projects.meta,
        findings: projects.findings,
        repoUrl: projects.repoUrl,
        liveUrl: projects.liveUrl,
        sortOrder: projects.sortOrder,
        metrics: {
          stars: projectMetrics.stars,
          forks: projectMetrics.forks,
          primaryLanguage: projectMetrics.primaryLanguage,
          lastPushedAt: projectMetrics.lastPushedAt,
          commitActivity: projectMetrics.commitActivity,
          syncedAt: projectMetrics.syncedAt,
        },
      })
      .from(projects)
      .leftJoin(projectMetrics, eq(projects.id, projectMetrics.projectId))
      .where(eq(projects.published, true))
      .orderBy(asc(projects.sortOrder));

    return { projects: rows };
  });

  app.get<{ Params: { slug: string } }>("/api/projects/:slug", async (req, reply) => {
    const rows = await db
      .select()
      .from(projects)
      .leftJoin(projectMetrics, eq(projects.id, projectMetrics.projectId))
      .where(eq(projects.slug, req.params.slug))
      .limit(1);

    const row = rows[0];
    if (!row || !row.projects.published) {
      return reply.code(404).send({ error: "not_found", message: "No such project" });
    }
    return { project: row.projects, metrics: row.project_metrics };
  });
}
