'use client';
/**
 * LIVE POWER CHART — OWNER: Maidul Islam [MI]
 *
 * Hand-drawn SVG rather than a charting library: the dependency budget is
 * already tight for a course project, and a sparkline over a rolling window is
 * about forty lines of path maths.
 *
 * The pulsing cursor at the leading edge is one of the three sanctioned uses
 * of the charge pulse — it means energy is flowing right now.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/formatters';

const WIDTH = 600;
const HEIGHT = 160;
const PAD = { top: 12, right: 8, bottom: 18, left: 34 };

export default function LivePowerChart({ readings = [], isRunning, metric = 'kw' }) {
  const { path, areaPath, points, maxValue, cursor } = useMemo(() => {
    if (!readings.length) return { path: '', areaPath: '', points: [], maxValue: 0, cursor: null };

    const values = readings.map((r) => Number(r[metric]) || 0);
    const max = Math.max(...values, metric === 'kw' ? 1 : 1) * 1.15;

    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const pts = values.map((value, i) => ({
      x: PAD.left + (i / Math.max(values.length - 1, 1)) * innerW,
      y: PAD.top + innerH - (value / max) * innerH,
      value,
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

    return { path: line, areaPath: area, points: pts, maxValue: max, cursor: pts[pts.length - 1] };
  }, [readings, metric]);

  const unit = metric === 'kw' ? 'kW' : metric === 'voltage' ? 'V' : 'A';

  if (!readings.length) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-line bg-surface-sunken">
        <p className="text-caption text-ink-muted">
          {isRunning ? 'Waiting for the first meter reading…' : 'No telemetry yet'}
        </p>
      </div>
    );
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[160px] w-full"
        role="img"
        aria-label={`Live ${unit} chart, currently ${points[points.length - 1]?.value.toFixed(2)} ${unit}`}
      >
        {gridLines.map((t) => {
          const y = PAD.top + (HEIGHT - PAD.top - PAD.bottom) * t;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                className="stroke-line"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-ink-subtle"
                style={{ fontSize: '9px' }}
              >
                {(maxValue * (1 - t)).toFixed(maxValue > 50 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} className="fill-brand-primary" opacity="0.12" />
        <path
          d={path}
          className="stroke-brand-primary"
          fill="none"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {cursor && (
          <circle
            cx={cursor.x}
            cy={cursor.y}
            r="4"
            className={cn('fill-brand-primary', isRunning && 'animate-charge-pulse')}
          />
        )}
      </svg>

      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-caption text-ink-subtle">
          last {readings.length} reading{readings.length === 1 ? '' : 's'}
        </span>
        <span className="numeric text-caption text-ink">
          {points[points.length - 1]?.value.toFixed(2)} {unit}
        </span>
      </div>
    </div>
  );
}
