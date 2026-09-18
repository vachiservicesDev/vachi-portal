import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Server-only. Uses the Supabase Postgres connection string directly
// (transaction-mode pooler recommended for serverless: port 6543).
// Never import this file from a client component.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — see .env.example');
}

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
