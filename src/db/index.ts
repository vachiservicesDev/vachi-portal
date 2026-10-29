import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Server-only. Uses the Supabase Postgres connection string directly
// (transaction-mode pooler recommended for serverless: port 6543).
// Never import this file from a client component.
const connectionString = process.env.DATABASE_URL;
// `next build` imports every route to collect page data, and preview builds have no database
// configured. postgres() doesn't connect until the first query, so a build without
// DATABASE_URL can still finish; at runtime a missing value is still an error.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
if (!connectionString && !isBuild) {
  throw new Error('DATABASE_URL is not set — see .env.example');
}

const client = postgres(connectionString ?? 'postgres://build-without-database@localhost/none', { prepare: false });
export const db = drizzle(client, { schema });
