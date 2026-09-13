import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { adminUsers, projects } from "../db/schema.js";
import { syncGithubMetrics } from "../services/github.js";
import * as stats from "../services/stats.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const projectBody = z.object({
  slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/, "slug must be lowercase kebab-case"),
  name: z.string().min(1).max(200),
  kind: z.string().min(1).max(200),
  status: z.enum(["running", "archived"]).default("running"),
  blurb: z.string().min(1),
  topology: z.string().nullish(),
  stack: z.array(z.string()).default([]),
  meta: z.array(z.tuple([z.string(), z.string()])).default([]),
  findings: z.array(z.tuple([z.string(), z.string(), z.string()])).default([]),
  repoUrl: z.string().url().nullish(),
  liveUrl: z.string().url().nullish(),
  githubRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).nullish(),
  sortOrder: z.number().int().default(0),
  published: z.boolean().default(true),
});

async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "unauthorized", message: "Valid token required" });
  }
}

export default async function adminRoutes(app: FastifyInstance) {
  /**
   * Login. Rate limited hard — this is the one endpoint worth brute-forcing, and the response
   * is deliberately identical whether the email is unknown or the password is wrong, so it
   * can't be used to enumerate accounts.
   */
  app.post(
    "/api/admin/login",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, parsed.data.email.toLowerCase()))
        .limit(1);

      // Compare against a dummy hash when the user doesn't exist, so both paths take
      // comparable time and timing can't reveal which emails are registered.
      const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
      const ok = await bcrypt.compare(parsed.data.password, hash);

      if (!user || !ok) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      await db
        .update(adminUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminUsers.id, user.id));

      const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "12h" });
      return { token, expiresIn: 43200 };
    },
  );

  app.get("/api/admin/me", { preHandler: requireAuth }, async (req) => ({ user: req.user }));

  /** Admin listing includes unpublished projects, unlike the public route. */
  app.get("/api/admin/projects", { preHandler: requireAuth }, async () => ({
    projects: await db.select().from(projects).orderBy(asc(projects.sortOrder)),
  }));

  app.post("/api/admin/projects", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = projectBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }
    const [created] = await db.insert(projects).values(parsed.data).returning();
    return reply.code(201).send({ project: created });
  });

  app.put<{ Params: { slug: string } }>(
    "/api/admin/projects/:slug",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = projectBody.partial().safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
      }
      const [updated] = await db
        .update(projects)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(projects.slug, req.params.slug))
        .returning();

      if (!updated) return reply.code(404).send({ error: "not_found" });
      return { project: updated };
    },
  );

  app.delete<{ Params: { slug: string } }>(
    "/api/admin/projects/:slug",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [deleted] = await db
        .delete(projects)
        .where(eq(projects.slug, req.params.slug))
        .returning({ slug: projects.slug });

      if (!deleted) return reply.code(404).send({ error: "not_found" });
      return { deleted: deleted.slug };
    },
  );

  /** Manual trigger for the GitHub sync, so the admin doesn't have to wait for the schedule. */
  app.post("/api/admin/sync", { preHandler: requireAuth }, async () => syncGithubMetrics());

  app.get("/api/admin/engagement", { preHandler: requireAuth }, async () => ({
    projects: await stats.projectEngagement(),
  }));
}
