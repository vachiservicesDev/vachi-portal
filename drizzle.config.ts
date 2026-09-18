import { defineConfig } from 'drizzle-kit';

// DATABASE_URL must point at the Supabase Postgres connection string
// (Project Settings -> Database -> Connection string -> URI, "Session" mode
// for drizzle-kit push/generate). This schema is the source of truth for
// this project from day one — see README.md.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  strict: true,
  verbose: true,
});
