import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ServiceCard } from "../components/ServiceCard";
import { ServiceDrawer } from "../components/ServiceDrawer";
import { TopBar } from "../components/TopBar";
import { TrafficPanel } from "../components/TrafficPanel";
import { api } from "../lib/api";
import { trackEvent, trackVisit } from "../lib/telemetry";

export function Dashboard() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    trackVisit(window.location.pathname);
  }, []);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => api.projects(signal),
    staleTime: 60_000,
  });

  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: ({ signal }) => api.overview(signal),
    staleTime: 60_000,
  });

  const traffic = useQuery({
    queryKey: ["timeseries"],
    queryFn: ({ signal }) => api.timeseries(30, signal),
    staleTime: 60_000,
  });

  const open = projects.data?.find((p) => p.slug === openSlug) ?? null;

  function toggle(slug: string) {
    const next = openSlug === slug ? null : slug;
    setOpenSlug(next);
    if (next) trackEvent("project_open", next);
  }

  const running = projects.data?.filter((p) => p.status === "running").length ?? 0;
  const archived = projects.data?.filter((p) => p.status === "archived").length ?? 0;

  return (
    <>
      <TopBar />
      <div className="wrap">
        <section className="masthead">
          <div>
            <div className="lbl">Siddharth Pandey / Backend &amp; Distributed Systems</div>
            <h1>
              I build systems that <span className="accent">stay up</span> when parts of them fall
              over.
            </h1>
            <p>
              Java, Python and Node services wired together with Kafka, Postgres and Redis —
              designed around the failure cases, not just the happy path. Everything below is
              something I actually built and ran. Click a service to inspect it.
            </p>
          </div>
        </section>

        <section className="tiles">
          <div className="tile">
            <div className="lbl">Services deployed</div>
            <div className="val">
              {overview.data?.servicesDeployed ?? "—"} <small>live</small>
            </div>
          </div>
          <div className="tile">
            <div className="lbl">Page views</div>
            <div className="val">
              {overview.data?.totalViews ?? "—"} <small>all time</small>
            </div>
          </div>
          <div className="tile">
            <div className="lbl">Unique today</div>
            <div className="val">{overview.data?.uniqueVisitorsToday ?? "—"}</div>
          </div>
          <div className="tile">
            <div className="lbl">Most opened</div>
            <div className="val" style={{ fontSize: 15, marginTop: 10 }}>
              {overview.data?.topProject?.slug ?? <span className="val-none">no data yet</span>}
            </div>
          </div>
        </section>

        <div className="sec-head">
          <h2>Services</h2>
          <span className="rule" />
          <span className="count">
            {projects.isLoading
              ? "loading…"
              : `${running} running · ${archived} archived`}
          </span>
        </div>

        {projects.isError ? (
          <div className="note">
            <b>// API UNREACHABLE —</b> the backend is on a free tier that sleeps when idle, so
            the first request after a quiet spell can take up to a minute. The page itself is
            fine; only the live figures are waiting.
          </div>
        ) : (
          <div className="services">
            {projects.data?.map((p) => (
              <ServiceCard
                key={p.slug}
                project={p}
                expanded={openSlug === p.slug}
                onToggle={toggle}
              />
            ))}
          </div>
        )}

        {open && <ServiceDrawer project={open} onClose={() => setOpenSlug(null)} />}

        <div className="sec-head">
          <h2>Telemetry</h2>
          <span className="rule" />
        </div>

        <div className="split">
          <TrafficPanel points={traffic.data} loading={traffic.isLoading} />

          <div className="panel">
            <div className="panel-head">
              <span className="lbl">Operator</span>
            </div>
            <div className="op-body">
              <p>
                Backend engineer working mostly in Java and Python. Most of what I build is
                event-driven — services that talk through a broker rather than calling each other
                directly, so one of them going down doesn&apos;t take the rest with it.
              </p>
              <p>
                This page is itself one of the systems: a React frontend, a Fastify API, and
                Postgres. The traffic chart is real visits, not a seeded animation.
              </p>
              <div className="contact">
                <a href="mailto:sidddelta@gmail.com">
                  <span className="k">Email</span>
                  <span>sidddelta@gmail.com</span>
                </a>
                <a href="https://github.com/Sidd04-12" target="_blank" rel="noopener noreferrer">
                  <span className="k">GitHub</span>
                  <span>Sidd04-12</span>
                </a>
                <div className="todo">
                  <span className="k">LinkedIn</span>
                  <span>awaiting handle</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer>
          <span>Siddharth Pandey — ops console</span>
          <span>React · Fastify · Postgres</span>
        </footer>
      </div>
    </>
  );
}
