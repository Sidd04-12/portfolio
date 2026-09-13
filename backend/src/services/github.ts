import { eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { projectMetrics, projects } from "../db/schema.js";
import { env } from "../lib/env.js";

const API = "https://api.github.com";

interface RepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  pushed_at: string;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "portfolio-sync",
  };
  // Unauthenticated is 60 requests/hour; a token raises it to 5,000.
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() });

  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    const when = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
    throw new Error(`GitHub rate limit hit; resets at ${when}`);
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * Weekly commit counts for the last year.
 *
 * GitHub computes this asynchronously and answers 202 with an empty body while it builds the
 * cache. That isn't an error — the correct response is to leave the existing data alone and
 * pick it up on the next run.
 */
async function commitActivity(repo: string): Promise<number[] | null> {
  const res = await fetch(`${API}/repos/${repo}/stats/commit_activity`, { headers: headers() });

  if (res.status === 202) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for commit_activity of ${repo}`);

  const weeks = (await res.json()) as { total: number }[];
  return Array.isArray(weeks) ? weeks.map((w) => w.total) : [];
}

export interface SyncResult {
  synced: number;
  failed: number;
  errors: { repo: string; error: string }[];
}

/**
 * Refreshes stored GitHub statistics for every project that names a repo.
 *
 * One repo failing must not abort the rest, so each is handled independently and its error is
 * recorded on its own row. A project whose sync fails keeps its last known good numbers and
 * carries a `syncError` the admin view can surface — stale data beats a blank dashboard.
 */
export async function syncGithubMetrics(): Promise<SyncResult> {
  const rows = await db
    .select({ id: projects.id, repo: projects.githubRepo })
    .from(projects)
    .where(isNotNull(projects.githubRepo));

  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  for (const row of rows) {
    const repo = row.repo!;
    try {
      const meta = await getJson<RepoResponse>(`/repos/${repo}`);
      const activity = await commitActivity(repo);

      const values = {
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        openIssues: meta.open_issues_count,
        primaryLanguage: meta.language,
        lastPushedAt: new Date(meta.pushed_at),
        syncedAt: new Date(),
        syncError: null,
        ...(activity ? { commitActivity: activity } : {}),
      };

      await db
        .insert(projectMetrics)
        .values({ projectId: row.id, ...values })
        .onConflictDoUpdate({ target: projectMetrics.projectId, set: values });

      result.synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.errors.push({ repo, error: message });

      await db
        .insert(projectMetrics)
        .values({ projectId: row.id, syncError: message, syncedAt: new Date() })
        .onConflictDoUpdate({
          target: projectMetrics.projectId,
          set: { syncError: message, syncedAt: new Date() },
        });
    }
  }

  return result;
}
