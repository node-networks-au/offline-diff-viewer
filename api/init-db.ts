import { DB_SCHEMA } from './db/dbConstants.js'
import { getPool } from './db/index.js'

// Idempotent schema bootstrap, run once before the server starts listening.
export async function initDb() {
  const pool = getPool()
  const schema = DB_SCHEMA || 'public'

  console.log('Creating schema if not exists:', schema)
  await pool.query('CREATE SCHEMA IF NOT EXISTS "' + schema + '"')

  console.log('Creating e2e_data table if not exists')
  await pool.query(
    'CREATE TABLE IF NOT EXISTS "' +
      schema +
      '".e2e_data (' +
      '  id VARCHAR(255) PRIMARY KEY,' +
      '  data TEXT NOT NULL,' +
      '  "creationTimestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
      ')'
  )

  const columnCheck = await pool.query(
    'SELECT column_name FROM information_schema.columns' +
      " WHERE table_schema = $1 AND table_name = 'e2e_data'" +
      " AND column_name = 'created_at'",
    [schema]
  )
  if (columnCheck.rows.length > 0) {
    console.log('Migrating created_at column to creationTimestamp')
    await pool.query('ALTER TABLE "' + schema + '".e2e_data RENAME COLUMN created_at TO "creationTimestamp"')
  }

  console.log('Database initialization complete')
}
