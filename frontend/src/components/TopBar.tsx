import { useEffect, useState } from "react";
import { trackEvent } from "../lib/telemetry";

type Theme = "dark" | "light";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("sys-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* private mode — fall through to the OS preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function TopBar() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB"));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sys-theme", theme);
    } catch {
      /* nothing we can do, and nothing the reader needs to know */
    }
  }, [theme]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          siddharth<b>.sys</b>
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-meta">
          <div className="meta-item">
            <span className="lbl">Clock</span>
            <span className="v num">{clock}</span>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              trackEvent("theme_toggle", undefined, next);
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
