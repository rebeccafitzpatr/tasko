// One-off migration runner: executes a .sql file statement by statement
// using the same connection settings as the API (apps/backend/.env).
//
//   cd apps/backend
//   bun runMigration.ts ..\..\migrations\20261120_user_accounts.sql
//
// Back up the database first: MySQL DDL is not rollback-safe, and these
// migration files are intended to be applied exactly once.
import { readFileSync } from 'node:fs'
import { db } from './db.js'

const file = process.argv[2]
if (!file) {
  console.error('Usage: bun runMigration.ts <path-to-sql-file>')
  process.exit(1)
}

const statements = readFileSync(file, 'utf8')
  .split(/;[ \t]*(?:\r?\n|$)/)
  .map(statement => statement.trim())
  .filter(statement => statement.length > 0)

console.log(`Applying ${statements.length} statements from ${file}\n`)
for (const [index, statement] of statements.entries()) {
  const label = statement.replace(/\s+/g, ' ').replace(/^(-- [^\n]*\s*)+/g, '').slice(0, 90)
  try {
    await db.unsafe(statement)
    console.log(`  ${index + 1}/${statements.length} OK      ${label}`)
  } catch (error) {
    console.error(`  ${index + 1}/${statements.length} FAILED  ${label}`)
    console.error(`\n${(error as Error).message}`)
    console.error('\nNo further statements were run. Fix the cause and apply the remaining statements, or restore from backup.')
    process.exit(1)
  }
}

const tables: { [key: string]: string }[] = await db.unsafe('SHOW TABLES')
console.log(`\nMigration applied. Tables now present: ${tables.map(row => Object.values(row)[0]).join(', ')}`)
process.exit(0)
