import pg from "pg";
import { env } from "./env";

const globalForPg = globalThis;

export const pool =
  globalForPg.sportPgPool ||
  new pg.Pool({
    connectionString: env.databaseUrl,
  });

if (env.nodeEnv !== "production") {
  globalForPg.sportPgPool = pool;
}

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
