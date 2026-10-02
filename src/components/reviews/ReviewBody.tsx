import type { ReactNode } from 'react';

export interface ReviewContent {
  rating: number | null;
  strengths: string | null;
  areasForImprovement: string | null;
  goals: string | null;
}

export const RATING_OPTIONS = [
  { value: '5', label: '5: Exceptional' },
  { value: '4', label: '4: Exceeds expectations' },
  { value: '3', label: '3: Meets expectations' },
  { value: '2', label: '2: Partly meets expectations' },
  { value: '1', label: '1: Below expectations' },
];

export function ratingLabel(rating: number | null) {
  return RATING_OPTIONS.find((o) => o.value === String(rating))?.label ?? 'Not rated';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="t-label text-muted">{title}</h3>
      <div className="mt-1.5 whitespace-pre-wrap break-words text-ink">{children || <span className="text-muted">—</span>}</div>
    </div>
  );
}

/** The written review: rating, then the three sections. */
export function ReviewBody({ review }: { review: ReviewContent }) {
  return (
    <div className="grid gap-5">
      <Section title="Overall rating">
        {review.rating ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="tracking-widest text-navy-700">
              {'●'.repeat(review.rating)}
              <span className="text-line-strong">{'●'.repeat(5 - review.rating)}</span>
            </span>
            {ratingLabel(review.rating)}
          </span>
        ) : null}
      </Section>
      <Section title="Strengths">{review.strengths}</Section>
      <Section title="Areas for improvement">{review.areasForImprovement}</Section>
      <Section title="Goals">{review.goals}</Section>
    </div>
  );
}
