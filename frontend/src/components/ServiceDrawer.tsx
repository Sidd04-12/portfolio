import type { Project } from "../lib/api";
import { trackEvent } from "../lib/telemetry";

interface Props {
  project: Project;
  onClose: () => void;
}

export function ServiceDrawer({ project, onClose }: Props) {
  const archived = project.status === "archived";

  return (
    <article className="drawer">
      <div className="drawer-head">
        <span className={`dot${archived ? " idle" : ""}`} aria-hidden="true" />
        <h3>{project.name}</h3>
        {archived ? (
          <span className="pill arch">Archived</span>
        ) : (
          <span className="pill ok">Healthy</span>
        )}
        <span className="topbar-spacer" />
        <button type="button" className="ghost-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="drawer-body">
        <div className="drawer-main">
          <div className="lbl">Overview</div>
          <p>{project.blurb}</p>

          {project.topology && (
            <div className="topo">
              <pre>{project.topology}</pre>
            </div>
          )}

          <div className="links">
            {project.repoUrl ? (
              <a
                className="link-btn"
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("link_click", project.slug, "repo")}
              >
                View source
              </a>
            ) : (
              <span className="link-btn sec is-off">Not yet published</span>
            )}
            {project.liveUrl && (
              <a
                className="link-btn sec"
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("link_click", project.slug, "live")}
              >
                Live demo
              </a>
            )}
          </div>
        </div>

        <div className="drawer-side">
          <div className="lbl">Runtime</div>
          <dl className="kv">
            {project.meta.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {project.findings.length > 0 && (
            <>
              <div className="lbl" style={{ marginTop: 20 }}>
                Notes
              </div>
              <ul className="findings">
                {project.findings.map(([sev, tag, text], i) => (
                  <li key={`${tag}-${i}`}>
                    <span className={`sev ${sev}`}>{tag}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
