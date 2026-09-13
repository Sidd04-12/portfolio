import type { TimeseriesPoint } from "../lib/api";
import { Sparkline } from "./Sparkline";

interface Props {
  points: TimeseriesPoint[] | undefined;
  loading: boolean;
}

/**
 * Real traffic to this page, which is the thing that makes the dashboard conceit honest — it's
 * monitoring itself rather than animating invented numbers.
 */
export function TrafficPanel({ points, loading }: Props) {
  const views = points?.map((p) => p.views) ?? [];
  const uniques = points?.map((p) => p.uniques) ?? [];
  const totalViews = views.reduce((a, b) => a + b, 0);
  const peak = views.length ? Math.max(...views) : 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="dot" aria-hidden="true" />
        <span className="lbl">Traffic — last 30 days</span>
        <span className="topbar-spacer" />
        <span className="lbl">{loading ? "loading" : `${totalViews} views`}</span>
      </div>

      <div style={{ padding: "14px 15px 16px" }}>
        {loading ? (
          <div className="lbl">Waking the API…</div>
        ) : totalViews === 0 ? (
          <div className="lbl" style={{ lineHeight: 1.8 }}>
            No traffic recorded yet.
            <br />
            This chart fills in from real visits — it isn&apos;t seeded.
          </div>
        ) : (
          <>
            <Sparkline values={views} height={64} />
            <div className="svc-stats" style={{ marginTop: 12, border: "none" }}>
              <div style={{ paddingLeft: 0 }}>
                <div className="lbl">Views</div>
                <div className="v">{totalViews}</div>
              </div>
              <div>
                <div className="lbl">Peak day</div>
                <div className="v">{peak}</div>
              </div>
              <div style={{ borderRight: "none" }}>
                <div className="lbl">Uniques</div>
                <div className="v">{uniques.reduce((a, b) => a + b, 0)}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
