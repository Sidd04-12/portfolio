import { and, desc, eq, gte, sql as raw } from "drizzle-orm";
import { db } from "../db/client.js";
import { dailyStats, events, projects, visits } from "../db/schema.js";

export interface OverviewStats {
  servicesDeployed: number;
  totalViews: number;
  viewsLast7Days: number;
  uniqueVisitorsToday: number;
  topProject: { slug: string; opens: number } | null;
}

export interface TimeseriesPoint {
  day: string;
  views: number;
  uniques: number;
}

/**
 * The numbers behind the summary tiles. Counted from raw tables for "today" (small, current)
 * and from the pre-aggregated daily table for anything historical.
 */
export async function overview(): Promise<OverviewStats> {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [deployed, allViews, recentViews, uniquesToday, top] = await Promise.all([
    db.select({ n: raw<number>`count(*)::int` }).from(projects).where(eq(projects.published, true)),

    db.select({ n: raw<number>`count(*)::int` }).from(visits),

    db.select({ n: raw<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, since7)),

    db
      .select({ n: raw<number>`count(distinct ${visits.visitorHash})::int` })
      .from(visits)
      .where(gte(visits.createdAt, startOfToday)),

    db
      .select({
        slug: events.projectSlug,
        opens: raw<number>`count(*)::int`,
      })
      .from(events)
      .where(and(eq(events.type, "project_open"), gte(events.createdAt, since7)))
      .groupBy(events.projectSlug)
      .orderBy(desc(raw`count(*)`))
      .limit(1),
  ]);

  const topRow = top[0];

  return {
    servicesDeployed: deployed[0]?.n ?? 0,
    totalViews: allViews[0]?.n ?? 0,
    viewsLast7Days: recentViews[0]?.n ?? 0,
    uniqueVisitorsToday: uniquesToday[0]?.n ?? 0,
    topProject: topRow?.slug ? { slug: topRow.slug, opens: topRow.opens } : null,
  };
}

/**
 * Daily views for the sparklines.
 *
 * Historical days come from the rolled-up table; today comes from the raw `visits` table,
 * because the rollup only runs overnight. Without that second query a freshly deployed site
 * reports "no traffic" for up to 24 hours while actually receiving visitors — the chart would
 * be wrong exactly when someone is most likely to be looking at it.
 *
 * Gaps are filled with zeroes so a quiet day renders as a flat segment rather than a missing
 * point that would distort the line.
 */
export async function timeseries(days = 30): Promise<TimeseriesPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceDay = since.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [rows, live] = await Promise.all([
    db
      .select({
        day: dailyStats.day,
        views: dailyStats.views,
        uniques: dailyStats.uniqueVisitors,
      })
      .from(dailyStats)
      .where(and(eq(dailyStats.path, "*"), gte(dailyStats.day, sinceDay)))
      .orderBy(dailyStats.day),

    db
      .select({
        views: raw<number>`count(*)::int`,
        uniques: raw<number>`count(distinct ${visits.visitorHash})::int`,
      })
      .from(visits)
      .where(gte(visits.createdAt, startOfToday)),
  ]);

  const byDay = new Map(rows.map((r) => [String(r.day), { views: r.views, uniques: r.uniques }]));

  // Today's live counts win over any partial rollup row for the same date.
  const todayLive = live[0];
  if (todayLive && (todayLive.views > 0 || !byDay.has(today))) {
    byDay.set(today, { views: todayLive.views, uniques: todayLive.uniques });
  }

  const out: TimeseriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hit = byDay.get(d);
    out.push({ day: d, views: hit?.views ?? 0, uniques: hit?.uniques ?? 0 });
  }
  return out;
}

/**
 * Collapses yesterday's raw rows into one aggregate row per path.
 *
 * Run nightly. Without it, the timeseries query would scan every visit ever recorded on every
 * page load; with it, that becomes a bounded scan of one row per day.
 */
export async function rollupDay(day?: string): Promise<number> {
  const target = day ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const result = await db.execute(raw`
    INSERT INTO daily_stats (day, path, views, unique_visitors)
    SELECT
      ${target}::date AS day,
      '*' AS path,
      count(*)::int AS views,
      count(distinct visitor_hash)::int AS unique_visitors
    FROM visits
    WHERE created_at >= ${target}::date
      AND created_at <  (${target}::date + interval '1 day')
    ON CONFLICT (day, path) DO UPDATE
      SET views = EXCLUDED.views,
          unique_visitors = EXCLUDED.unique_visitors
  `);

  return Array.isArray(result) ? result.length : 1;
}

/** Which project cards actually get opened — the question the analytics exist to answer. */
export async function projectEngagement(): Promise<{ slug: string; opens: number }[]> {
  const rows = await db
    .select({ slug: events.projectSlug, opens: raw<number>`count(*)::int` })
    .from(events)
    .where(eq(events.type, "project_open"))
    .groupBy(events.projectSlug)
    .orderBy(desc(raw`count(*)`));

  return rows.filter((r): r is { slug: string; opens: number } => r.slug !== null);
}
