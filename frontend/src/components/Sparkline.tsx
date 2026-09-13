interface Props {
  /** Raw values, oldest first. Rendered normalised to their own min/max. */
  values: number[];
  archived?: boolean;
  height?: number;
}

const W = 300;

/**
 * A small area chart.
 *
 * Normalises to the series' own range rather than a fixed scale, so low-traffic days still show
 * shape instead of a flat line at the bottom. A completely flat series is drawn as a centred
 * line, which is honest: no variation to show.
 */
export function Sparkline({ values, archived = false, height = 40 }: Props) {
  const h = height;

  if (values.length < 2) {
    return (
      <svg className="spark" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <line
          x1="0"
          y1={h / 2}
          x2={W}
          y2={h / 2}
          stroke="var(--rule-2)"
          strokeWidth="1.2"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = W / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const line = `M${points.join(" L")}`;
  const area = `${line} L${W} ${h} L0 ${h} Z`;
  const stroke = archived ? "var(--dim)" : "var(--accent)";

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={archived ? "transparent" : "var(--glow)"} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
