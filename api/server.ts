import express from 'express'
import createLink from './createLink.js'
import getLink from './getLink.js'
import { getPool } from './db/index.js'
import { initDb } from './init-db.js'

const app = express()
const port = process.env.PORT || 3000

app.disable('x-powered-by')
app.use(express.json({ limit: '50mb' }))

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'diff-api' })
})

app.post('/createLink', async (req, res) => {
  try {
    await createLink(req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/getLink', async (req, res) => {
  try {
    await getLink(req, res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' })
  }
})

initDb()
  .then(() => {
    const server = app.listen(port, () => {
      console.log('Diff API listening on port ' + port)
    })
    process.on('SIGTERM', () => {
      server.close(() => getPool().end().finally(() => process.exit(0)))
    })
  })
  .catch((err) => {
    console.error('Fatal error during DB init:', err)
    process.exit(1)
  })
