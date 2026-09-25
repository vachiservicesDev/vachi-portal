import { vi } from 'vitest';
import { authState } from './mockAuth';

if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error(
    'DATABASE_URL must point at a database with "test" in its name to run the test suite - ' +
      'refusing to run against anything that could be a real/prod database.',
  );
}

// Real Supabase Auth isn't reachable from this test run (no network access
// to *.supabase.co here) and isn't what these tests are for anyway - they
// exercise the app's own authorization/business logic. This mock stands in
// for supabase.auth.getUser() only; every DB read/write below it still
// goes through the real Drizzle client against the local test Postgres.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: authState.userId ? { id: authState.userId } : null },
      }),
    },
  }),
}));

// No real Supabase Storage locally - these no-op so the surrounding
// business logic (DB writes, status transitions) is still exercised for
// real without needing a network call.
vi.mock('@/lib/storage/onboarding', () => ({
  ONBOARDING_BUCKET: 'onboarding-documents',
  uploadOnboardingFile: vi.fn(async () => undefined),
  downloadOnboardingFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  getOnboardingFileSignedUrl: vi.fn(async () => 'https://example.test/signed'),
}));

vi.mock('@/lib/storage/i9', () => ({
  I9_BUCKET: 'i9-records',
  uploadI9Snapshot: vi.fn(async () => undefined),
}));

// No real Dropbox Sign API key/network access locally.
vi.mock('@/lib/esignature', () => ({
  getESignatureProvider: () => ({
    name: 'dropbox_sign',
    createSignatureRequest: vi.fn(async () => ({ requestId: 'test-request-id' })),
    downloadSignedFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  }),
}));
