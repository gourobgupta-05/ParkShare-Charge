'use client';
/**
 * STAR RATING — OWNER: Gourob Gupta [GG]
 * Interactive when onChange is passed, read-only otherwise.
 * The numeric value is always rendered alongside, because stars alone are not
 * accessible to screen readers or to anyone who cannot distinguish the fill.
 */
import { useState } from 'react';
import { cn } from '@/lib/formatters';

const SIZES = { sm: 'text-body', md: 'text-h2', lg: 'text-display' };

export default function StarRating({
  value = 0, onChange, size = 'md', showValue = true, count, label,
}) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  const shown = hover || value;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn('flex', SIZES[size])}
        role={interactive ? 'radiogroup' : 'img'}
        aria-label={interactive ? (label || 'Star rating') : `Rated ${value} out of 5`}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(shown);
          const Tag = interactive ? 'button' : 'span';
          return (
            <Tag
              key={star}
              {...(interactive
                ? {
                    type: 'button',
                    role: 'radio',
                    'aria-checked': star === value,
                    'aria-label': `${star} star${star === 1 ? '' : 's'}`,
                    onClick: () => onChange(star),
                    onMouseEnter: () => setHover(star),
                    onMouseLeave: () => setHover(0),
                  }
                : { 'aria-hidden': 'true' })}
              className={cn(
                'leading-none transition-colors duration-fast',
                filled ? 'text-warning' : 'text-ink-subtle',
                interactive && 'cursor-pointer hover:scale-110'
              )}
            >
              ★
            </Tag>
          );
        })}
      </div>

      {showValue && value > 0 && (
        <span className="numeric text-caption text-ink-muted">
          {Number(value).toFixed(1)}
          {Number.isFinite(count) && ` (${count})`}
        </span>
      )}
    </div>
  );
}
