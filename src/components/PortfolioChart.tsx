'use client';

interface Props {
  data: { date: string; value: number }[];
  isLoading?: boolean;
}

export default function PortfolioChart({ data, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>0.0003</span>
          <span>0.0002</span>
          <span>0.0001</span>
          <span>0</span>
        </div>
        <div className="ml-10 h-full w-[calc(100%-2.5rem)] animate-pulse">
          <div className="h-full w-full rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>0.0003</span>
          <span>0.0002</span>
          <span>0.0001</span>
          <span>0</span>
        </div>
        <div className="ml-10 h-full w-[calc(100%-2.5rem)] flex items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No transaction data available
          </p>
        </div>
      </div>
    );
  }

  // Calculate min and max values for scaling
  const values = data.map(d => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  
  // Add 10% padding
  const padding = Math.max((maxVal - minVal) * 0.1, 0.00001);
  const chartMin = Math.max(0, minVal - padding);
  const chartMax = maxVal + padding;
  const range = chartMax - chartMin || 0.0001;

  // Calculate points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.value - chartMin) / range) * 85;
    return { x, y: Math.min(Math.max(y, 5), 95) };
  });

  // Build smooth path for the line
  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cp1x = prev.x + (curr.x - prev.x) * 0.4;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) * 0.4;
      const cp2y = curr.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
    return path;
  };

  const smoothPath = getSmoothPath(points);

  // Build polygon points for area fill
  const polygonPoints = points.map(p => `${p.x} ${p.y}`).join(' ');
  const allPolygonPoints = `${polygonPoints} ${points[points.length - 1].x} 100 ${points[0].x} 100`;

  // Format Y-axis labels
  const formatValue = (val: number) => {
    if (val === 0) return '0';
    if (val < 0.0001) return val.toFixed(6);
    if (val < 0.01) return val.toFixed(5);
    if (val < 1) return val.toFixed(4);
    return val.toFixed(2);
  };

  // Generate Y-axis labels
  const yLabels = [
    chartMax,
    chartMin + range * 0.75,
    chartMin + range * 0.5,
    chartMin + range * 0.25,
    chartMin
  ];

  return (
    <div className="relative w-full h-full">
      {/* Y-axis Labels */}
      <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-[10px] text-gray-500 dark:text-gray-400">
        {yLabels.map((label, i) => (
          <span key={i}>${formatValue(label)}</span>
        ))}
      </div>

      {/* Chart Area */}
      <div className="ml-12 h-full w-[calc(100%-3rem)]">
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(71, 124, 255, 0.25)" />
              <stop offset="100%" stopColor="rgba(71, 124, 255, 0.01)" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[20, 40, 60, 80].map((line) => (
            <line
              key={line}
              x1="0"
              y1={`${line}%`}
              x2="100%"
              y2={`${line}%`}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="dark:stroke-gray-700"
            />
          ))}

          {/* Area Fill */}
          <polygon
            points={allPolygonPoints}
            fill="url(#areaGradient)"
          />

          {/* ✅ Smooth Line - NO DOTS */}
          <path
            d={smoothPath}
            fill="none"
            stroke="#477cff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis Labels */}
          <text x="0" y="98" className="text-[10px] fill-gray-500 dark:fill-gray-400">
            {data[0]?.date?.slice(5) || ''}
          </text>
          <text x="50%" y="98" className="text-[10px] fill-gray-500 dark:fill-gray-400 text-center">
            {data[Math.floor(data.length / 2)]?.date?.slice(5) || ''}
          </text>
          <text x="100%" y="98" className="text-[10px] fill-gray-500 dark:fill-gray-400 text-right">
            {data[data.length - 1]?.date?.slice(5) || ''}
          </text>
        </svg>
      </div>
    </div>
  );
}