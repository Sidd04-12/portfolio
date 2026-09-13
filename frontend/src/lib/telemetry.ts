import { API_BASE } from "./api";

/**
 * Fire-and-forget analytics.
 *
 * Two rules: it never blocks rendering, and it never surfaces an error. If the backend is
 * asleep on a free tier or blocked by an ad blocker, the page must behave exactly as if nothing
 * happened — analytics failing is not the reader's problem.
 */
function send(path: string, body: unknown): void {
  const payload = JSON.stringify(body);

  // sendBeacon survives page unload, which a fetch() can't, and doesn't compete with the
  // page's own requests for connections.
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const ok = navigator.sendBeacon(
        `${API_BASE}${path}`,
        new Blob([payload], { type: "application/json" }),
      );
      if (ok) return;
    } catch {
      /* fall through to fetch */
    }
  }

  void fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* deliberately ignored */
  });
}

export function trackVisit(path: string): void {
  send("/api/telemetry/visit", { path, referrer: document.referrer || undefined });
}

export function trackEvent(
  type: "project_open" | "link_click" | "theme_toggle",
  projectSlug?: string,
  detail?: string,
): void {
  send("/api/telemetry/event", { type, projectSlug, detail });
}
