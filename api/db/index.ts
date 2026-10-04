import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool() {
  if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PASSWORD) {
    throw new Error('Missing database environment variables')
  }
  if (!pool) {
    // if ssl is true then port number is not needed
    pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      max: 5, // Maximum number of connections in the pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // How long to wait for a connection from the pool
      // Hosted Postgres needs TLS; the in-cluster diff-db sets DB_SSL=false.
      ssl: process.env.DB_SSL !== 'false',
    })
  }
  return pool
}
