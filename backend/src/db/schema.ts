import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Projects are rows rather than hardcoded constants so they can be edited through the admin
 * API without a redeploy.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    /** running | archived — drives the status pill and whether the sparkline animates. */
    status: text("status").notNull().default("running"),
    blurb: text("blurb").notNull(),
    /** ASCII architecture diagram shown in the drill-down panel. */
    topology: text("topology"),
    stack: jsonb("stack").$type<string[]>().notNull().default([]),
    /** [[label, value], ...] shown in the runtime panel. */
    meta: jsonb("meta").$type<[string, string][]>().notNull().default([]),
    /** [[severity, tag, text], ...] — the findings list. */
    findings: jsonb("findings").$type<[string, string, string][]>().notNull().default([]),
    repoUrl: text("repo_url"),
    liveUrl: text("live_url"),
    /** owner/name, used by the GitHub sync job. Null means "don't sync this one". */
    githubRepo: text("github_repo"),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sortIdx: index("idx_projects_sort").on(t.sortOrder),
  }),
);

/**
 * GitHub statistics, refreshed on a schedule rather than fetched per request — GitHub's
 * unauthenticated rate limit is 60 requests/hour, which a burst of visitors would exhaust in
 * seconds. Serving from here means the page stays fast and never rate-limits.
 */
export const projectMetrics = pgTable("project_metrics", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  stars: integer("stars").notNull().default(0),
  forks: integer("forks").notNull().default(0),
  openIssues: integer("open_issues").notNull().default(0),
  primaryLanguage: text("primary_language"),
  lastPushedAt: timestamp("last_pushed_at", { withTimezone: true }),
  /** Commit counts for the last 52 weeks, oldest first — drives the sparkline. */
  commitActivity: jsonb("commit_activity").$type<number[]>().notNull().default([]),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  syncError: text("sync_error"),
});

/**
 * Page views.
 *
 * Deliberately no IP address and no cookie. Unique visitors are counted with
 * `sha256(ip + user-agent + daily-rotating salt)`, truncated — enough to distinguish two
 * visitors on the same day, useless for identifying anyone, and unlinkable across days because
 * the salt rotates. Aggregate analytics without building a tracking database.
 */
export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    /** Rotating pseudonymous id — see note above. Never reversible to a person. */
    visitorHash: text("visitor_hash").notNull(),
    country: text("country"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("idx_visits_created").on(t.createdAt),
    visitorIdx: index("idx_visits_visitor").on(t.visitorHash),
  }),
);

/** Interactions worth knowing about: which project cards actually get opened. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** project_open | link_click | theme_toggle */
    type: text("type").notNull(),
    projectSlug: text("project_slug"),
    detail: text("detail"),
    visitorHash: text("visitor_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("idx_events_created").on(t.createdAt),
    typeIdx: index("idx_events_type").on(t.type),
  }),
);

/**
 * Pre-aggregated daily counts. Rolling these up nightly means the dashboard's time series is a
 * 90-row scan instead of counting millions of raw rows on every page load.
 */
export const dailyStats = pgTable(
  "daily_stats",
  {
    day: date("day").notNull(),
    path: text("path").notNull().default("*"),
    views: integer("views").notNull().default(0),
    uniqueVisitors: integer("unique_visitors").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.day, t.path] }),
  }),
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMetrics = typeof projectMetrics.$inferSelect;
