/** The logo's checkmark, used as the "done / verified" glyph. */
export function Check({ className = 'h-4 w-4 text-green-700' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className}`}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
