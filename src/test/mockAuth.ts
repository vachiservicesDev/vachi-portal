/** Mutable current-test-user state, read by the mocked supabase/server client in setup.ts. */
export const authState: { userId: string | null; userMetadata: Record<string, unknown> } = { userId: null, userMetadata: {} };

export function setCurrentUser(id: string | null, userMetadata: Record<string, unknown> = {}): void {
  authState.userId = id;
  authState.userMetadata = userMetadata;
}
