'use client';
/**
 * TURN LIST — OWNER: Maidul Islam [MI]
 * The current instruction is emphasised; the rest are dimmed so the driver's
 * eye lands on the right line at a glance.
 */
import { formatDistance, cn } from '@/lib/formatters';

const ICONS = {
  depart: '▲',
  turn: '↱',
  'turn-left': '↰',
  'turn-right': '↱',
  continue: '↑',
  merge: '⤳',
  roundabout: '↻',
  fork: '⑂',
  arrive: '◉',
};

export default function TurnList({ steps = [], activeIndex = 0, entranceNote }) {
  if (!steps.length) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-raised">
      <ol className="divide-y divide-line">
        {steps.map((step, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <li
              key={`${step.instruction}-${i}`}
              className={cn(
                'flex items-start gap-3 px-4 py-3 transition-colors duration-fast',
                isActive && 'bg-brand-primary-subtle'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 text-h3 leading-none',
                  isActive ? 'text-ink-brand' : isPast ? 'text-ink-subtle' : 'text-ink-muted'
                )}
                aria-hidden="true"
              >
                {ICONS[step.maneuver] || ICONS.continue}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    isActive ? 'text-body font-medium text-ink' : 'text-body',
                    isPast ? 'text-ink-subtle line-through' : 'text-ink-muted'
                  )}
                >
                  {step.instruction}
                </p>
                <p className="numeric mt-0.5 text-caption text-ink-subtle">
                  {formatDistance(step.distanceMeters || 0)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {entranceNote && (
        <div className="border-t border-line bg-surface-sunken px-4 py-3">
          <p className="text-caption font-medium text-ink">Entrance note from the host</p>
          <p className="mt-0.5 text-caption text-ink-muted">{entranceNote}</p>
        </div>
      )}
    </div>
  );
}
