import { SQL } from 'bun'

/**
 * Bun SQL client configured from environment variables.
 * This mirrors your existing bootstrap in index.ts.
 */
export const db = new SQL({
  adapter: 'mysql',
  hostname: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,
  database: process.env.MYSQL_DATABASE,
  username: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  tls: true,
})

export async function initDb() {
  // Optional: run a quick sanity check and migrations
  const test = await db`SELECT 1 + 1 AS result`
  await db`SOURCE ./apps/migrations/create_tables.sql`
  return test
}

export default db