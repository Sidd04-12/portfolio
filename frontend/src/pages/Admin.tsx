import { useState } from "react";
import { api, type Project } from "../lib/api";

/**
 * Minimal admin console: sign in, see what visitors actually clicked, and trigger a GitHub
 * resync without waiting for the schedule.
 *
 * The token is held in component state rather than localStorage, so it doesn't survive a
 * refresh and can't be read by any script that manages to run on the page. For a single-admin
 * tool the extra sign-in is a fair price.
 */
export function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [engagement, setEngagement] = useState<{ slug: string; opens: number }[]>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token: t } = await api.login(email, password);
      setToken(t);
      const [p, eng] = await Promise.all([api.adminProjects(t), api.adminEngagement(t)]);
      setProjects(p.projects);
      setEngagement(eng.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    if (!token) return;
    setBusy(true);
    setSyncMsg(null);
    try {
      const r = await api.adminSync(token);
      setSyncMsg(`Synced ${r.synced} repo(s), ${r.failed} failed.`);
      setProjects((await api.adminProjects(token)).projects);
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="wrap" style={{ maxWidth: 420, paddingBlock: "80px 40px" }}>
        <div className="lbl">Restricted</div>
        <h1 style={{ fontSize: 24, margin: "8px 0 22px", fontWeight: 600 }}>Admin sign-in</h1>

        <form onSubmit={login} className="panel" style={{ padding: 18 }}>
          <label className="lbl" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <label className="lbl" htmlFor="admin-password" style={{ marginTop: 14, display: "block" }}>
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <div className="sev crit" style={{ display: "block", marginTop: 14, padding: "8px 10px" }}>
              {error}
            </div>
          )}

          <button type="submit" className="link-btn" disabled={busy} style={{ marginTop: 18 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingBlock: "40px 60px" }}>
      <div className="sec-head" style={{ marginTop: 0 }}>
        <h2>Admin</h2>
        <span className="rule" />
        <button type="button" className="ghost-btn" onClick={runSync} disabled={busy}>
          {busy ? "Working…" : "Sync GitHub"}
        </button>
      </div>

      {syncMsg && <div className="note">{syncMsg}</div>}

      <div className="split" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="lbl">Projects ({projects.length})</span>
          </div>
          <div style={{ padding: "10px 15px 16px" }}>
            {projects.map((p) => (
              <div
                key={p.slug}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--rule)",
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 12,
                }}
              >
                <span>{p.slug}</span>
                <span style={{ color: "var(--dim)" }}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="lbl">What visitors opened</span>
          </div>
          <div style={{ padding: "10px 15px 16px" }}>
            {engagement.length === 0 ? (
              <div className="lbl">No opens recorded yet.</div>
            ) : (
              engagement.map((e) => (
                <div
                  key={e.slug}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--rule)",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 12,
                  }}
                >
                  <span>{e.slug}</span>
                  <span style={{ color: "var(--accent)" }}>{e.opens}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "9px 11px",
  background: "var(--ground)",
  border: "1px solid var(--rule-2)",
  borderRadius: 3,
  color: "var(--text)",
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 13,
};
