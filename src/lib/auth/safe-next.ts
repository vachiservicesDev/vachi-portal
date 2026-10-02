/**
 * Keeps a post-sign-in `next` value to a path on this site. Rejects protocol-relative targets
 * ("//evil.example") and backslashes, which browsers treat as "/" ("/\evil.example").
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const base = 'https://portal.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
