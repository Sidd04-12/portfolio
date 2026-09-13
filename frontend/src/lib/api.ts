const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface ProjectMetrics {
  stars: number | null;
  forks: number | null;
  primaryLanguage: string | null;
  lastPushedAt: string | null;
  commitActivity: number[] | null;
  syncedAt: string | null;
}

export interface Project {
  slug: string;
  name: string;
  kind: string;
  status: "running" | "archived";
  blurb: string;
  topology: string | null;
  stack: string[];
  meta: [string, string][];
  findings: [string, string, string][];
  repoUrl: string | null;
  liveUrl: string | null;
  sortOrder: number;
  metrics: ProjectMetrics | null;
}

export interface Overview {
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

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) {
    throw new ApiError(`Request failed: ${path}`, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  projects: (signal?: AbortSignal) =>
    get<{ projects: Project[] }>("/api/projects", signal).then((r) => r.projects),

  overview: (signal?: AbortSignal) => get<Overview>("/api/stats/overview", signal),

  timeseries: (days = 30, signal?: AbortSignal) =>
    get<{ points: TimeseriesPoint[] }>(`/api/stats/timeseries?days=${days}`, signal).then(
      (r) => r.points,
    ),

  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new ApiError(
        res.status === 429 ? "Too many attempts. Wait 15 minutes." : "Incorrect email or password",
        res.status,
      );
    }
    return (await res.json()) as { token: string; expiresIn: number };
  },

  adminProjects: (token: string) =>
    fetch(`${BASE}/api/admin/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) throw new ApiError("Could not load projects", r.status);
      return r.json() as Promise<{ projects: Project[] }>;
    }),

  adminEngagement: (token: string) =>
    fetch(`${BASE}/api/admin/engagement`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) throw new ApiError("Could not load engagement", r.status);
      return r.json() as Promise<{ projects: { slug: string; opens: number }[] }>;
    }),

  adminSync: (token: string) =>
    fetch(`${BASE}/api/admin/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) throw new ApiError("Sync failed", r.status);
      return r.json() as Promise<{ synced: number; failed: number; errors: unknown[] }>;
    }),
};

export { ApiError, BASE as API_BASE };
