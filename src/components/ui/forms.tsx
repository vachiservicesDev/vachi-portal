'use client';

import { useEffect, useRef } from 'react';
import { Check } from './Check';

/**
 * The result of a save, under the form's title. Errors take focus so keyboard and screen reader
 * users land on them; field errors link to their field.
 */
export function FormStatus({
  error,
  success,
  fieldErrors = {},
  labels = {},
}: {
  error?: string | null;
  success?: string | null;
  fieldErrors?: Record<string, string>;
  labels?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error, fieldErrors]);

  if (success) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-green-700/25 bg-green-50 px-4 py-3 text-ink">
        <Check className="mt-1 h-4 w-4 shrink-0 text-green-700" />
        <p>{success}</p>
      </div>
    );
  }
  if (!error) return null;
  const entries = Object.entries(fieldErrors);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg border border-danger-700/30 bg-danger-50 px-4 py-3 text-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-700/40"
    >
      <p className="font-semibold">{error}</p>
      {entries.length > 0 && (
        <ul className="mt-2 grid gap-1 text-sm">
          {entries.map(([name, msg]) => (
            <li key={name}>
              <a className="underline underline-offset-2" href={`#f-${name}`}>
                {labels[name] ? `${labels[name]}: ` : ''}
                {msg}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
