'use client';
/**
 * RESULT LIST — OWNER: Tamal Deb Nath [TDN]
 */
import SlotCard from './SlotCard';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';

export default function ResultList({ results, summary, isLoading, error, selectedId, onSelect, onWiden }) {
  if (error) {
    return <Alert tone="danger" title="Search failed">{error}</Alert>;
  }

  if (isLoading && !results.length) {
    return (
      <div className="py-10">
        <Spinner label="Finding spaces near you" />
      </div>
    );
  }

  if (!results.length) {
    return (
      <EmptyState
        title="No spaces in this radius"
        description="Try widening the search radius, switching category, or removing the charger filter."
        action={
          onWiden && (
            <button
              type="button"
              onClick={onWiden}
              className="text-caption font-medium text-ink-brand underline"
            >
              Widen the search
            </button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summary && (
        <p className="text-caption text-ink-muted">
          <span className="numeric font-medium text-ink">{summary.total}</span> space
          {summary.total === 1 ? '' : 's'} ·{' '}
          <span className="numeric">{summary.residential}</span> residential ·{' '}
          <span className="numeric">{summary.mall}</span> mall ·{' '}
          <span className="numeric">{summary.withCharger}</span> with charging
        </p>
      )}

      {results.map((property) => (
        <SlotCard
          key={property._id}
          property={property}
          isSelected={String(property._id) === String(selectedId)}
          onSelect={onSelect}
        />
      ))}

      {isLoading && <p className="py-2 text-center text-caption text-ink-subtle">Updating…</p>}
    </div>
  );
}
