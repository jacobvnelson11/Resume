import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
}

/**
 * Hosted Postgres providers (Neon, Supabase, Render, etc.) require TLS and
 * commonly present a cert `pg` won't validate against a default trust store.
 * A plain localhost/docker-compose connection needs no TLS at all, so only
 * turn it on for anything that isn't local.
 */
const isLocal = /localhost|127\.0\.0\.1|postgres:5432/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
