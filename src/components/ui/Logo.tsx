import Image from 'next/image';
import Link from 'next/link';
import lockup from '../../../public/brand/vachi-logo-lockup.png';
import full from '../../../public/brand/vachi-logo-full.png';

type Props = { variant?: 'lockup' | 'full'; className?: string; priority?: boolean; href?: string | null; label?: string };

/** The Vachi Services logo, used as supplied (same files as the website). */
export function Logo({ variant = 'lockup', className = 'h-9 w-auto', priority = false, href = '/', label = 'Vachi Portal home' }: Props) {
  const img = (
    <Image
      src={variant === 'full' ? full : lockup}
      alt="Vachi Services LLC"
      priority={priority}
      className={className}
      sizes={variant === 'full' ? '280px' : '180px'}
    />
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label={label} className="inline-flex shrink-0 items-center rounded-sm">
      {img}
    </Link>
  );
}
