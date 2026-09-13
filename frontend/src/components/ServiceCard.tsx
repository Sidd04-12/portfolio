import type { Project } from "../lib/api";
import { Sparkline } from "./Sparkline";

interface Props {
  project: Project;
  expanded: boolean;
  onToggle: (slug: string) => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

export function ServiceCard({ project, expanded, onToggle }: Props) {
  const archived = project.status === "archived";
  const m = project.metrics;
  const commits = m?.commitActivity ?? [];

  // Card stats come from GitHub where it has data, and fall back to the project's own
  // declared metadata otherwise — never to an invented number.
  const stats: { k: string; v: string; none?: boolean }[] = [
    { k: "Last push", v: relativeTime(m?.lastPushedAt ?? null), none: !m?.lastPushedAt },
    { k: "Language", v: m?.primaryLanguage ?? "—", none: !m?.primaryLanguage },
    {
      k: "Commits/yr",
      v: commits.length ? String(commits.reduce((a, b) => a + b, 0)) : "—",
      none: commits.length === 0,
    },
  ];

  return (
    <button
      type="button"
      className={`svc${archived ? " is-arch" : ""}`}
      aria-expanded={expanded}
      onClick={() => onToggle(project.slug)}
    >
      <div className="svc-head">
        <div>
          <div className="svc-name">{project.name}</div>
          <div className="svc-kind">{project.kind}</div>
        </div>
        {archived ? (
          <span className="pill arch">
            <span className="dot idle" />
            Archived
          </span>
        ) : (
          <span className="pill ok">
            <span className="dot" />
            Healthy
          </span>
        )}
      </div>

      <Sparkline values={commits} archived={archived} />

      <div className="svc-stats">
        {stats.map((s) => (
          <div key={s.k}>
            <div className="lbl">{s.k}</div>
            <div className={`v${s.none ? " val-none" : ""}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="stack-row">
        {project.stack.slice(0, 6).map((t) => (
          <span className="chip" key={t}>
            {t}
          </span>
        ))}
        {project.stack.length > 6 && <span className="chip">+{project.stack.length - 6}</span>}
      </div>
    </button>
  );
}
