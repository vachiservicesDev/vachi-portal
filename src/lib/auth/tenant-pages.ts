/** The only pages a tenant login may open; everything else in the portal is for staff. */
export function tenantMayOpen(pathname: string) {
  return ['/rental', '/messages', '/notifications'].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
