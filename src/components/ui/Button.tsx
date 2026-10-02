import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

// Same button system as vachiservices.com (src/components/Button.tsx there).
type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-60';
const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-11 px-4 text-[0.9375rem]',
  lg: 'min-h-12 px-6 text-base',
};
const variants: Record<Variant, string> = {
  primary: 'bg-navy-700 text-white hover:bg-navy-800 shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]',
  secondary: 'border border-line-strong bg-white text-ink hover:border-navy-700 hover:text-navy-700',
  ghost: 'text-navy-700 hover:bg-navy-50',
  inverse: 'bg-white text-navy-900 hover:bg-teal-50',
  danger: 'border border-danger-700/40 bg-white text-danger-700 hover:bg-danger-50',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}

export function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />;
}

export function Arrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-200 group-hover:translate-x-0.5">
      <path d="M3 8h9m-3.5-4L12.5 8 8.5 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  busyLabel?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<'button'>, 'className' | 'children'>;

/** A button that shows a spinner and a "…ing" label while its action runs. */
export function Button({ variant = 'primary', size = 'md', busy = false, busyLabel, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || busy} aria-disabled={disabled || busy} className={buttonClass(variant, size, className)} {...rest}>
      {busy ? (
        <>
          <Spinner />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

type LinkButtonProps = { href: string; variant?: Variant; size?: Size; arrow?: boolean; className?: string; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  'href' | 'className'
>;

export function LinkButton({ href, variant = 'primary', size = 'md', arrow = false, className = '', children, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} className={`group ${buttonClass(variant, size, className)}`} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}
