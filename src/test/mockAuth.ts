/** Mutable current-test-user state, read by the mocked supabase/server client in setup.ts. */
export const authState: { userId: string | null } = { userId: null };

export function setCurrentUser(id: string | null): void {
  authState.userId = id;
}
