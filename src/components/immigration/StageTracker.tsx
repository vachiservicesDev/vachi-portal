import { Check } from '@/components/ui/Check';
import { GREEN_CARD_STAGES } from '@/lib/status';

const PATH = GREEN_CARD_STAGES.filter((s) => s.value !== 'denied');

/** The green card stages as a numbered list: done, current, and still to come. */
export function StageTracker({ stage }: { stage: string }) {
  if (stage === 'denied') {
    return <p className="rounded-lg border border-danger-700/30 bg-danger-50 px-4 py-3 font-medium text-danger-700">This case was denied. HR will talk to you about next steps.</p>;
  }
  const at = PATH.findIndex((s) => s.value === stage);
  return (
    <ol className="grid gap-0 sm:grid-cols-7" aria-label="Green card stages">
      {PATH.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'todo';
        return (
          <li key={s.value} className="relative flex items-center gap-3 py-2 sm:flex-col sm:items-start sm:gap-2 sm:py-0 sm:pr-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                state === 'done' ? 'border-green-700 bg-green-700 text-white' : state === 'current' ? 'border-navy-700 bg-navy-700 text-white' : 'border-line-strong bg-white text-muted'
              }`}
            >
              {state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm leading-snug ${state === 'current' ? 'font-semibold text-ink' : state === 'done' ? 'text-ink-2' : 'text-muted'}`}>
              {s.label}
              <span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current stage)' : ' (not yet)'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
