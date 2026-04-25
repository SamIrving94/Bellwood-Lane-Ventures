// Lightweight inline-SVG sparkline. No deps, server-safe.

type SparklineProps = {
  points: number[];
  color?: string;
  fillColor?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
};

export function Sparkline({
  points,
  color = '#0A2540',
  fillColor,
  width = 120,
  height = 32,
  strokeWidth = 1.5,
  fill = false,
}: SparklineProps) {
  if (points.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(' ');

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const computedFillColor =
    fillColor ?? (fill ? `${color}1F` : 'transparent');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{ display: 'block' }}
    >
      {fill && (
        <path d={areaPath} fill={computedFillColor} stroke="none" />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coords[coords.length - 1]![0]}
        cy={coords[coords.length - 1]![1]}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}
