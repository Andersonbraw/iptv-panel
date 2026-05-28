import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import dotenv from 'dotenv'
import { XMLParser } from 'fast-xml-parser'

dotenv.config()

const TMDB_API_KEY =
  process.env.TMDB_API_KEY ||
  'd7d6f05500f868564751a589e219be96'

const { Pool } = pg

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = 'iptv_panel_secret_2026'

app.use(
  cors({
    origin: '*'
  })
)

app.use(express.json({ limit: '50mb' }))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'client',
      status TEXT DEFAULT 'active'
    )
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS watching TEXT DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS watching_type TEXT DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS watching_updated_at TIMESTAMP
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      name TEXT,
      url TEXT UNIQUE,
      category TEXT,
      logo TEXT,
      is_online BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movies (
      id SERIAL PRIMARY KEY,
      title TEXT,
      year TEXT,
      category TEXT,
      image TEXT,
      banner TEXT,
      video TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  console.log('BANCO OK')
}

initDb()

function auth(req, res, next) {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({
      error: 'token inválido'
    })
  }

  const token = header.replace('Bearer ', '')

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({
      error: 'token inválido'
    })
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'somente admin'
    })
  }

  next()
}

app.post('/watching', auth, async (req, res) => {
  try {
    const {
      title,
      type
    } = req.body

    await pool.query(
      `
      UPDATE users
      SET
        watching = $1,
        watching_type = $2,
        watching_updated_at = NOW()
      WHERE id = $3
      `,
      [
        title || '',
        type || '',
        req.user.id
      ]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro watching'
    })
  }
})

app.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password
    } = req.body

    await pool.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        role,
        status,
        plan,
        max_connections
      )
      VALUES ($1,$2,$3,'client','active','free',1)
      `,
      [
        name,
        email,
        password
      ]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao criar conta'
    })
  }
})

app.post('/login', async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body

    const result =
      await pool.query(
        `
        SELECT *
        FROM users
        WHERE email = $1
        `,
        [email]
      )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'login inválido'
      })
    }

    const user = result.rows[0]

    if (user.password !== password) {
      return res.status(401).json({
        error: 'senha inválida'
      })
    }

    const token =
      jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        {
          expiresIn: '7d'
        }
      )

    res.json({
      token,
      user
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro login'
    })
  }
})

app.get(
  '/admin/users',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            email,
            role,
            status,
            plan,
            max_connections,
            expires_at,
            credits,
            watching,
            watching_type,
            watching_updated_at
          FROM users
          ORDER BY id DESC
        `)

      res.json(result.rows)
    } catch (err) {
      console.log(err)

      res.status(500).json({
        error: 'erro usuarios'
      })
    }
  }
)

app.get('/channels', auth, async (req, res) => {
  try {
    const result =
      await pool.query(`
        SELECT *
        FROM channels
        ORDER BY name ASC
      `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro canais'
    })
  }
})

app.get('/movies', auth, async (req, res) => {
  try {
    const result =
      await pool.query(`
        SELECT *
        FROM movies
        ORDER BY id DESC
      `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro filmes'
    })
  }
})

app.get('/', (req, res) => {
  res.send('IPTV SERVER ONLINE')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER ON ${PORT}`)
})