import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import dotenv from 'dotenv'
import crypto from 'crypto'
import { XMLParser } from 'fast-xml-parser'

dotenv.config()

const TMDB_API_KEY =
  process.env.TMDB_API_KEY ||
  'd7d6f05500f868564751a589e219be96'

async function fetchTMDBPoster(title) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(
        title
      )}`
    )

    const data = await response.json()

    if (!data.results || data.results.length === 0) return null

    const movie = data.results[0]

    return {
      poster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : '',
      banner: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
        : '',
      overview: movie.overview || '',
      year: movie.release_date
        ? movie.release_date.substring(0, 4)
        : ''
    }
  } catch (err) {
    console.log('TMDB ERROR:', err.message)
    return null
  }
}

const { Pool } = pg

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = 'iptv_panel_secret_2026'

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '200mb' }))

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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS watching TEXT DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS watching_type TEXT DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS watching_updated_at TIMESTAMP
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_seen TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON user_sessions(user_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id
    ON user_sessions(session_id)
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      channel_id INTEGER
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_streams (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER,
      name TEXT,
      url TEXT UNIQUE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS epg_now (
      id SERIAL PRIMARY KEY,
      channel_name TEXT,
      title TEXT,
      description TEXT,
      start_time TIMESTAMP,
      end_time TIMESTAMP
    )
  `)

  console.log('BANCO OK')
}

initDb()

async function auth(req, res, next) {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({
      error: 'token inválido'
    })
  }

  const token = header.replace('Bearer ', '')

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    const result = await pool.query(
      `
      SELECT
        users.*,
        user_sessions.session_id
      FROM users
      LEFT JOIN user_sessions
        ON user_sessions.user_id = users.id
        AND user_sessions.session_id = $2
      WHERE users.id = $1
      LIMIT 1
      `,
      [
        decoded.id,
        decoded.session_id || ''
      ]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'usuário não encontrado'
      })
    }

    const user = result.rows[0]

    if (!user.session_id) {
      return res.status(401).json({
        error: 'sessão expirada por novo login'
      })
    }

    if (String(user.status).trim() !== 'active') {
      return res.status(403).json({
        error: 'usuário bloqueado'
      })
    }

    if (
      user.expires_at &&
      new Date(user.expires_at).getTime() < Date.now()
    ) {
      return res.status(403).json({
        error: 'assinatura vencida'
      })
    }

    await pool.query(
      `
      UPDATE user_sessions
      SET last_seen = NOW()
      WHERE session_id = $1
      `,
      [decoded.session_id]
    )

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      session_id: decoded.session_id
    }

    next()
  } catch (err) {
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

function generateRandomLogin(customName = '') {
  const number = Math.floor(
    100000 + Math.random() * 900000
  )

  const password = Math.random()
    .toString(36)
    .slice(2, 10)

  return {
    name:
      customName?.trim() ||
      `Cliente ${number}`,

    email: `cliente${number}@iptv.local`,

    password
  }
}

function normalizeGithubUrl(url) {
  if (!url) return ''

  if (url.includes('raw.githubusercontent.com')) return url

  if (url.includes('github.com') && url.includes('/blob/')) {
    return url
      .replace('https://github.com/', 'https://raw.githubusercontent.com/')
      .replace('/blob/', '/')
  }

  return url
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function fetchM3UText(playlistUrl) {
  console.log('M3U URL RECEBIDA:', playlistUrl)
  const fixedUrl =
    normalizeGithubUrl(playlistUrl)

  const controller =
    new AbortController()

  const timeout =
    setTimeout(() => {
      controller.abort()
    }, 90000)

  try {
    const response =
      await fetch(fixedUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: '*/*',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'
        }
      })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      )
    }

    const text =
      await response.text()

    if (!text.includes('#EXTINF')) {
      console.log(
        'RETORNO INVALIDO:',
        text.slice(0, 500)
      )

      throw new Error(
        'M3U inválida ou lista expirada'
      )
    }

    return text
  } catch (err) {
    clearTimeout(timeout)

    console.log(
      'ERRO FETCH M3U:',
      err.message
    )

    throw err
  }
}

function parseM3U(text) {
  const lines = text.split('\n')
  const channels = []
  let current = null

  for (let line of lines) {
    line = line.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF')) {
      const nameMatch =
        line.match(/,(.*)$/)

      const logoMatch =
        line.match(/tvg-logo="([^"]*)"/)

      const groupMatch =
        line.match(/group-title="([^"]*)"/)

      current = {
        name: nameMatch
          ? nameMatch[1].trim()
          : 'Canal IPTV',

        logo: logoMatch
          ? logoMatch[1].trim()
          : '',

        category: groupMatch
          ? groupMatch[1].trim()
          : 'Outros'
      }

      continue
    }

    if (current && line.startsWith('http')) {
      channels.push({
        ...current,
        url: line
      })

      current = null
    }
  }

  return channels
}

async function importM3UFromUrl(playlistUrl) {
  const text =
    await fetchM3UText(playlistUrl)

  return parseM3U(text)
}

async function saveChannels(channels) {
  let added = 0

  for (const channel of channels) {
    try {
      const result =
        await pool.query(
          `
          INSERT INTO channels
          (
            name,
            url,
            category,
            logo,
            is_online
          )
          VALUES ($1,$2,$3,$4,true)
          ON CONFLICT (url)
          DO NOTHING
          RETURNING id
          `,
          [
            channel.name,
            channel.url,
            channel.category,
            channel.logo
          ]
        )

      if (result.rows.length > 0) added++
    } catch (err) {
      console.log(err.message)
    }
  }

  return added
}

function cleanTitle(title = '') {
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b(1080p|720p|480p|4k|fhd|hd|sd|dub|dublado|legendado)\b/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBadMovieItem(movie) {
  const title =
    normalizeText(movie.title || '')

  const category =
    normalizeText(movie.category || '')

  const image =
    normalizeText(movie.image || '')

  const video =
    normalizeText(movie.video || '')

  const rawTitle =
    String(movie.title || '').trim()

  const badWords = [
    'tv',
    'channel',
    'canal',
    'live',
    'ao vivo',
    '24h',
    '24/7',
    'news',
    'sports',
    'sport',
    'music',
    'radio',
    'record',
    'globo',
    'sbt',
    'band',
    'cnn',
    'fox',
    'pbs',
    'nbc',
    'abc',
    'cbs',
    'pluto',
    'rakuten',
    'vix',
    'plex',
    'free tv',
    'iptv',
    'vo',
    'ivs',
    'test',
    'teste',
    'demo',
    'backup',
    'camera',
    'webcam',
    'web cam',
    'cam girl',
    'camgirl',
    'camtv',
    'mycamtv',
    'xxx',
    'adult',
    'adults',
    'porn',
    'porno',
    'sexo',
    'sex',
    'sexy',
    'hot',
    'nude',
    'naked',
    'onlyfans',
    'fansly',
    'bonga',
    'livejasmin',
    'strip',
    'escort',
    'model',
    'webmodel',
    'private',
    'erotic'
  ]

  const blockedWords = [
    'arab',
    'al ',
    'quran',
    'islam',
    'urdu',
    'hindi',
    'bangla',
    'turk',
    'russia',
    'russian',
    'kurd',
    'pakistan',
    'india',
    'indonesia',
    'africa',
    'persian',
    'punjabi',
    'tamil',
    'telugu',
    'marathi',
    'bengali',
    'egypt',
    'kuwait',
    'saudi',
    'muslim',
    'koran',
    'mosque',
    'tv5monde',
    'france 24',
    'sharia',
    'quran tv',
    'alquran',
    'islamic',
    'aljazeera',
    'makkah',
    'madinah'
  ]

  const adultNames = [
    'erin',
    'nessa',
    'imeliana',
    'marina',
    'aoki',
    'danna',
    'gingercherry',
    'grace',
    'holly',
    'jade',
    'jessy',
    'katrinka',
    'lovely',
    'luna',
    'hinata',
    'scarlet',
    'sweetness',
    'taylorblack',
    'valery',
    'yomoy',
    'baramurava',
    'karolina',
    'lana',
    'locomoco'
  ]

  const badExact =
    title === 'vo' ||
    title === 'vod' ||
    title === 'tv' ||
    title === 'hd' ||
    title === 'fhd' ||
    title === '4k' ||
    title.length <= 2

  const badTitle =
    badWords.some(word =>
      title.includes(word)
    )

  const blockedLanguage =
    blockedWords.some(word =>
      title.includes(word)
    )

  const badAdultName =
    adultNames.some(word =>
      title.includes(word)
    )

  const badUsernameTitle =
    rawTitle.startsWith('_') ||
    rawTitle.endsWith('_') ||
    rawTitle.includes('__') ||
    /^[_a-z0-9.-]{3,30}$/i.test(rawTitle)

  const badImage =
    !image ||
    image.includes('ui-avatars') ||
    image.includes('placeholder') ||
    image.includes('no-image') ||
    image.includes('undefined')

  const badCategory =
    category.includes('news') ||
    category.includes('sports') ||
    category.includes('radio') ||
    category.includes('music') ||
    category.includes('live') ||
    category.includes('adult') ||
    category.includes('xxx') ||
    category.includes('porn') ||
    category.includes('webcam') ||
    category.includes('cam')

  const badVideo =
    !video ||
    video.includes('udp://') ||
    video.includes('rtmp://') ||
    video.includes('xxx') ||
    video.includes('adult') ||
    video.includes('porn') ||
    video.includes('webcam') ||
    video.includes('cam') ||
    video.includes('mycamtv') ||
    video.includes('camtv') ||
    video.includes('onlyfans') ||
    video.includes('fansly') ||
    video.includes('bonga') ||
    video.includes('livejasmin')

  return (
    badExact ||
    badTitle ||
    blockedLanguage ||
    badAdultName ||
    badUsernameTitle ||
    badImage ||
    badCategory ||
    badVideo
  )
}

async function createSessionForUser(user) {
  const maxConnections =
    Math.max(
      1,
      Number(user.max_connections || 1)
    )

  const sessionId =
    crypto.randomUUID()

  await pool.query(
    `
    INSERT INTO user_sessions
    (
      user_id,
      session_id,
      created_at,
      last_seen
    )
    VALUES ($1,$2,NOW(),NOW())
    `,
    [
      user.id,
      sessionId
    ]
  )

  await pool.query(
    `
    DELETE FROM user_sessions
    WHERE id IN (
      SELECT id
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      OFFSET $2
    )
    `,
    [
      user.id,
      maxConnections
    ]
  )

  return sessionId
}

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
        max_connections,
        expires_at
      )
      VALUES ($1,$2,$3,'client','active','free',1,NULL)
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

    if (user.status && user.status !== 'active') {
      return res.status(403).json({
        error: 'conta bloqueada'
      })
    }

    if (
      user.expires_at &&
      new Date(user.expires_at) < new Date()
    ) {
      return res.status(403).json({
        error: 'login expirado'
      })
    }

    const sessionId =
      await createSessionForUser(user)

    const token =
      jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          session_id: sessionId
        },
        JWT_SECRET,
        {
          expiresIn: '7d'
        }
      )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan,
        max_connections: user.max_connections,
        expires_at: user.expires_at,
        credits: user.credits,
        watching: user.watching,
        watching_type: user.watching_type,
        watching_updated_at: user.watching_updated_at
      }
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro login'
    })
  }
})

app.post('/logout', auth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM user_sessions
      WHERE session_id = $1
      `,
      [
        req.user.session_id
      ]
    )

    res.json({
      success: true
    })
  } catch (err) {
    res.json({
      success: true
    })
  }
})

app.get('/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const result =
      await pool.query(`
        SELECT
          users.id,
          users.name,
          users.email,
          users.role,
          users.status,
          users.plan,
          users.max_connections,
          users.expires_at,
          users.credits,
          users.watching,
          users.watching_type,
          users.watching_updated_at,
          COUNT(user_sessions.id)::INTEGER AS active_connections
        FROM users
        LEFT JOIN user_sessions
          ON user_sessions.user_id = users.id
        GROUP BY users.id
        ORDER BY users.id DESC
      `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao buscar usuarios'
    })
  }
})

app.patch('/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const {
      role,
      status,
      plan,
      max_connections,
      expires_at,
      credits
    } = req.body

    const { id } = req.params

    const result =
      await pool.query(
        `
        UPDATE users
        SET
          role = COALESCE($1, role),
          status = COALESCE($2, status),
          plan = COALESCE($3, plan),
          max_connections = COALESCE($4, max_connections),
          expires_at = COALESCE($5, expires_at),
          credits = COALESCE($6, credits)
        WHERE id = $7
        RETURNING id, name, email, role, status, plan, max_connections, expires_at, credits
        `,
        [
          role,
          status,
          plan,
          max_connections,
          expires_at,
          credits,
          id
        ]
      )

    await pool.query(
      `
      DELETE FROM user_sessions
      WHERE id IN (
        SELECT user_sessions.id
        FROM user_sessions
        JOIN users ON users.id = user_sessions.user_id
        WHERE user_sessions.user_id = $1
        ORDER BY user_sessions.created_at DESC
        OFFSET GREATEST(1, COALESCE((SELECT max_connections FROM users WHERE id = $1), 1))
      )
      `,
      [
        id
      ]
    )

    res.json(result.rows[0])
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao atualizar usuário'
    })
  }
})

app.patch('/admin/users/:id/add-30-days', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params

    const result =
      await pool.query(
        `
        UPDATE users
        SET expires_at =
          CASE
            WHEN expires_at IS NULL OR expires_at < NOW()
            THEN NOW() + INTERVAL '30 days'
            ELSE expires_at + INTERVAL '30 days'
          END
        WHERE id = $1
        RETURNING id, name, email, expires_at
        `,
        [id]
      )

    res.json(result.rows[0])
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao adicionar 30 dias'
    })
  }
})

app.get('/admin/credits', auth, adminOnly, async (req, res) => {
  try {
    const result =
      await pool.query(
        `
        SELECT credits
        FROM users
        WHERE id = $1
        `,
        [req.user.id]
      )

    res.json({
      credits: result.rows[0]?.credits || 0
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao buscar créditos'
    })
  }
})

app.post('/admin/credits/add', auth, adminOnly, async (req, res) => {
  try {
    const { amount } = req.body

    const value =
      Number(amount || 0)

    if (value <= 0) {
      return res.status(400).json({
        error: 'quantidade inválida'
      })
    }

    const result =
      await pool.query(
        `
        UPDATE users
        SET credits = credits + $1
        WHERE id = $2
        RETURNING credits
        `,
        [
          value,
          req.user.id
        ]
      )

    res.json({
      credits: result.rows[0].credits
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao adicionar créditos'
    })
  }
})

app.post('/admin/users/create-random', auth, adminOnly, async (req, res) => {
  try {
    const admin =
      await pool.query(
        `
        SELECT credits
        FROM users
        WHERE id = $1
        `,
        [req.user.id]
      )

    const credits =
      Number(admin.rows[0]?.credits || 0)

    if (credits <= 0) {
      return res.status(400).json({
        error: 'sem créditos disponíveis'
      })
    }

    const login =
      generateRandomLogin(
        req.body.name
      )

    const result =
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
          max_connections,
          expires_at
        )
        VALUES ($1,$2,$3,'client','active','premium',1,NOW() + INTERVAL '30 days')
        RETURNING id, name, email, role, status, plan, max_connections, expires_at
        `,
        [
          login.name,
          login.email,
          login.password
        ]
      )

    await pool.query(
      `
      UPDATE users
      SET credits = credits - 1
      WHERE id = $1
      `,
      [req.user.id]
    )

    res.json({
      success: true,
      user: result.rows[0],
      login: {
        email: login.email,
        password: login.password
      }
    })
  } catch (err) {
    console.log('ERRO CREATE RANDOM:', err)

    res.status(500).json({
      error:
        err.message ||
        'erro ao criar login aleatório'
    })
  }
})

app.delete('/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        error: 'não pode excluir o próprio admin'
      })
    }

    await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      `,
      [id]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao excluir usuário'
    })
  }
})

app.get('/me', auth, async (req, res) => {
  try {
    const result =
      await pool.query(
        `
        SELECT
          id,
          name,
          email,
          role,
          status,
          plan,
          max_connections,
          expires_at,
          credits
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [req.user.id]
      )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'usuario nao encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro usuario'
    })
  }
})

app.get('/channels', auth, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10)

    if (isNaN(limit) || limit <= 0) {
      limit = 1000
    }

    if (limit > 1000) {
      limit = 1000
    }

    const result =
      await pool.query(
        `
        SELECT
          id,
          name,
          url,
          category,
          logo,
          is_online,
          created_at
        FROM channels
        ORDER BY name ASC
        LIMIT $1
        `,
        [limit]
      )

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro canais'
    })
  }
})

app.post('/channels', auth, async (req, res) => {
  try {
    const {
      name,
      url,
      category,
      logo
    } = req.body

    await pool.query(
      `
      INSERT INTO channels
      (
        name,
        url,
        category,
        logo,
        is_online
      )
      VALUES ($1,$2,$3,$4,true)
      ON CONFLICT (url)
      DO NOTHING
      `,
      [
        name,
        url,
        category,
        logo
      ]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao adicionar canal'
    })
  }
})

app.delete('/channels/clean-bad', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM channels
      WHERE
        LOWER(name) LIKE '%xxx%'
        OR LOWER(name) LIKE '%korea%'
        OR LOWER(name) LIKE '%korean%'
        OR LOWER(name) LIKE '%japan%'
        OR LOWER(name) LIKE '%japanese%'
        OR LOWER(name) LIKE '%china%'
        OR LOWER(name) LIKE '%chinese%'
        OR LOWER(name) LIKE '%arab%'
        OR LOWER(name) LIKE '%turk%'
        OR LOWER(name) LIKE '%india%'
        OR LOWER(name) LIKE '%hindi%'
        OR LOWER(name) LIKE '%pakistan%'
        OR LOWER(name) LIKE '%bangla%'
        OR LOWER(name) LIKE '%russia%'
        OR LOWER(name) LIKE '%persian%'
        OR LOWER(name) LIKE '%thai%'
        OR LOWER(name) LIKE '%vietnam%'
        OR LOWER(name) LIKE '%indonesia%'
        OR LOWER(name) LIKE '%adult%'
        OR LOWER(name) LIKE '%porn%'
        OR LOWER(name) LIKE '%porno%'
        OR LOWER(name) LIKE '%sexo%'
        OR LOWER(name) LIKE '%webcam%'
        OR LOWER(name) LIKE '%camgirl%'
        OR LOWER(name) LIKE '%camtv%'
        OR LOWER(name) LIKE '%mycamtv%'
        OR LOWER(name) LIKE '%onlyfans%'
        OR LOWER(name) LIKE '%fansly%'
        OR LOWER(name) LIKE '%bonga%'
        OR LOWER(name) LIKE '%livejasmin%'
        OR LOWER(name) LIKE '%erin%'
        OR LOWER(name) LIKE '%nessa%'
        OR LOWER(name) LIKE '%imeliana%'
        OR LOWER(name) LIKE '%marina%'
        OR LOWER(name) LIKE '%aoki%'
        OR LOWER(name) LIKE '%danna%'
        OR LOWER(name) LIKE '%gingercherry%'
        OR LOWER(name) LIKE '%holly%'
        OR LOWER(name) LIKE '%hinata%'
        OR LOWER(name) LIKE '%scarlet%'
        OR LOWER(name) LIKE '%sweetness%'
        OR LOWER(name) LIKE '%taylorblack%'
        OR LOWER(name) LIKE '%valery%'
        OR LOWER(name) LIKE '%yomoy%'
        OR LOWER(name) LIKE '%karolina%'
        OR LOWER(name) LIKE '%lana%'
        OR LOWER(name) LIKE '%locomoco%'
        OR name LIKE '\\_%' ESCAPE '\\'
        OR name LIKE '%\\_' ESCAPE '\\'
        OR name LIKE '%__%'
      RETURNING id
    `)

    res.json({
      success: true,
      removed: result.rowCount || 0
    })
  } catch (err) {
    console.log('ERRO CLEAN CHANNELS:', err)

    res.status(500).json({
      error: 'erro ao limpar canais suspeitos'
    })
  }
})
app.delete('/channels/:id', auth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM channels
      WHERE id = $1
      `,
      [req.params.id]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao remover canal'
    })
  }
})

app.delete('/channels-clear', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(`
      TRUNCATE TABLE channels RESTART IDENTITY CASCADE
    `)

    res.json({
      success: true,
      message: 'todos os canais foram removidos'
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao limpar canais'
    })
  }
})

app.post('/import-m3u-file', auth, adminOnly, async (req, res) => {
  try {
    const { text } = req.body

    if (!text || !text.includes('#EXTM3U')) {
      return res.status(400).json({
        error: 'Arquivo M3U inválido'
      })
    }

    const lines = text.split('\n')

    let current = null
    let canais = 0
    let filmes = 0
    let series = 0
    let ignorados = 0

    function isSeriesTitle(title = '') {
      const t = normalizeText(title)

      return (
        /s\d{1,2}e\d{1,3}/i.test(title) ||
        t.includes('temporada') ||
        t.includes('episodio') ||
        t.includes('episódio') ||
        t.includes('episode') ||
        t.includes('ep ')
      )
    }

    function isBadContent(title = '', group = '', streamUrl = '') {
      const t = normalizeText(`${title} ${group} ${streamUrl}`)

      const blocked = [
        'xxx',
        'adult',
        'adults',
        'porn',
        'porno',
        'sexo',
        'sex ',
        'sexy',
        'nude',
        'naked',
        'webcam',
        'camgirl',
        'camtv',
        'mycamtv',
        'onlyfans',
        'fansly',
        'bonga',
        'livejasmin',
        'erotic'
      ]

      return blocked.some(word => t.includes(word))
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (line.startsWith('#EXTINF')) {
        const nameMatch = line.match(/,(.*)$/)
        const logoMatch = line.match(/tvg-logo="([^"]*)"/)
        const groupMatch = line.match(/group-title="([^"]*)"/)

        current = {
          title: nameMatch ? nameMatch[1].trim() : 'IPTV',
          logo: logoMatch ? logoMatch[1].trim() : '',
          group: groupMatch ? groupMatch[1].trim() : 'Outros'
        }

        continue
      }

      if (current && line.startsWith('http')) {
        const streamUrl = line
        const lowerUrl = streamUrl.toLowerCase()
        const lowerGroup = normalizeText(current.group || '')
        const lowerTitle = normalizeText(current.title || '')

        try {
          if (isBadContent(current.title, current.group, streamUrl)) {
            ignorados++
            current = null
            continue
          }

          if (
            lowerUrl.includes('/series/') ||
            lowerGroup.includes('series') ||
            lowerGroup.includes('serie') ||
            lowerGroup.includes('série') ||
            isSeriesTitle(current.title)
          ) {
            await pool.query(
              `
              INSERT INTO movies
              (
                title,
                year,
                category,
                image,
                banner,
                video,
                description
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7)
              `,
              [
                current.title,
                '',
                'Series',
                current.logo,
                current.logo,
                streamUrl,
                `Importado M3U - ${current.group}`
              ]
            )

            series++
          } else if (
            lowerUrl.includes('/movie/') ||
            lowerUrl.includes('/vod/') ||
            lowerGroup.includes('filme') ||
            lowerGroup.includes('movie') ||
            lowerGroup.includes('vod') ||
            lowerUrl.match(/\.(mp4|mkv|avi|mov)$/)
          ) {
            await pool.query(
              `
              INSERT INTO movies
              (
                title,
                year,
                category,
                image,
                banner,
                video,
                description
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7)
              `,
              [
                current.title,
                '',
                'Filmes',
                current.logo,
                current.logo,
                streamUrl,
                `Importado M3U - ${current.group}`
              ]
            )

            filmes++
          } else if (
            lowerUrl.includes('/live/') ||
            lowerGroup.includes('canais') ||
            lowerGroup.includes('canal') ||
            lowerGroup.includes('tv') ||
            lowerTitle.includes('tv')
          ) {
            const result = await pool.query(
              `
              INSERT INTO channels
              (
                name,
                url,
                category,
                logo,
                is_online
              )
              VALUES ($1,$2,$3,$4,true)
              ON CONFLICT (url)
              DO NOTHING
              RETURNING id
              `,
              [
                current.title,
                streamUrl,
                current.group,
                current.logo
              ]
            )

            if (result.rows.length > 0) canais++
          } else {
            ignorados++
          }
        } catch (err) {
          ignorados++
          console.log('ERRO IMPORT ITEM M3U:', err.message)
        }

        current = null
      }
    }

    res.json({
      success: true,
      canais,
      filmes,
      series,
      ignorados,
      encontrados: canais + filmes + series + ignorados,
      adicionados: canais + filmes + series
    })
  } catch (err) {
    console.log('ERRO IMPORT FILE M3U:', err)

    res.status(500).json({
      error: 'erro ao importar arquivo M3U'
    })
  }
})
app.post('/import-m3u', auth, async (req, res) => {
  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({
        error: 'url obrigatória'
      })
    }

    const channels =
      await importM3UFromUrl(url)

    const added =
      await saveChannels(channels)

    res.json({
      success: true,
      encontrados: channels.length,
      adicionados: added
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error:
        err.message ||
        'erro ao importar M3U'
    })
  }
})

app.get('/movies', auth, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10)

    if (isNaN(limit) || limit <= 0) {
      limit = 1000
    }

    if (limit > 1000) {
      limit = 1000
    }

    const result =
      await pool.query(
        `
        SELECT
          id,
          title,
          year,
          category,
          image,
          banner,
          video,
          description,
          created_at
        FROM movies
        ORDER BY id DESC
        LIMIT $1
        `,
        [limit]
      )

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro filmes'
    })
  }
})

app.post('/movies', auth, adminOnly, async (req, res) => {
  try {
    const {
      title,
      year,
      category,
      image,
      banner,
      video,
      description
    } = req.body

    if (!title || !video) {
      return res.status(400).json({
        error: 'titulo e video obrigatorios'
      })
    }

    await pool.query(
      `
      INSERT INTO movies
      (
        title,
        year,
        category,
        image,
        banner,
        video,
        description
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        title,
        year || '',
        category || 'Filmes',
        image || '',
        banner || '',
        video,
        description || ''
      ]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro criar filme'
    })
  }
})

app.post('/movies/import-m3u', auth, adminOnly, async (req, res) => {
  try {
    const { url, type } = req.body

    if (!url) {
      return res.status(400).json({
        error: 'url obrigatória'
      })
    }

    const targetType = type === 'Series' ? 'Series' : 'Filmes'

    const text = await fetchM3UText(url)
    const lines = text.split('\n')

    let current = null
    let added = 0
    let skipped = 0

    function isVideoUrl(streamUrl = '') {
      const url = normalizeText(streamUrl)

      return (
        url.includes('.mp4') ||
        url.includes('.mkv') ||
        url.includes('.avi') ||
        url.includes('.mov') ||
        url.includes('.m3u8') ||
        url.includes('/movie/') ||
        url.includes('/series/') ||
        url.includes('/vod/')
      )
    }

    function isBlocked(title = '', group = '', streamUrl = '', logo = '') {
      const text = normalizeText(`${title} ${group} ${streamUrl} ${logo}`)
      const rawTitle = String(title || '').trim()

      const blockedWords = [
        'xxx',
        'adult',
        'adults',
        'porn',
        'porno',
        'sexo',
        'sex',
        'sexy',
        'hot',
        'nude',
        'naked',
        'camera',
        'webcam',
        'web cam',
        'camgirl',
        'cam girl',
        'camtv',
        'mycamtv',
        'onlyfans',
        'fansly',
        'bonga',
        'livejasmin',
        'strip',
        'escort',
        'model',
        'webmodel',
        'erotic',
        'radio',
        'udp://',
        'rtmp://'
      ]

      const adultNames = [
        'erin',
        'nessa',
        'imeliana',
        'marina',
        'aoki',
        'danna',
        'gingercherry',
        'grace',
        'holly',
        'jade',
        'jessy',
        'katrinka',
        'lovely',
        'luna',
        'hinata',
        'scarlet',
        'sweetness',
        'taylorblack',
        'valery',
        'yomoy',
        'baramurava',
        'karolina',
        'lana',
        'locomoco'
      ]

      const badUsernameTitle =
        rawTitle.startsWith('_') ||
        rawTitle.endsWith('_') ||
        rawTitle.includes('__') ||
        /^[_a-z0-9.-]{3,30}$/i.test(rawTitle)

      return (
        blockedWords.some(word => text.includes(word)) ||
        adultNames.some(word => text.includes(word)) ||
        badUsernameTitle
      )
    }

    function looksLikeSeries(title = '', group = '', streamUrl = '') {
      const text = normalizeText(`${title} ${group} ${streamUrl}`)

      return (
        /s\d{1,2}e\d{1,3}/i.test(title) ||
        text.includes('/series/') ||
        text.includes('series') ||
        text.includes('serie') ||
        text.includes('seriado') ||
        text.includes('temporada') ||
        text.includes('episodio') ||
        text.includes('episode')
      )
    }

    for (const lineRaw of lines) {
      const line = lineRaw.trim()
      if (!line) continue

      if (line.startsWith('#EXTINF')) {
        const titleMatch = line.match(/,(.*)$/)
        const logoMatch = line.match(/tvg-logo="([^"]*)"/)
        const groupMatch = line.match(/group-title="([^"]*)"/)

        const rawTitle = titleMatch ? titleMatch[1].trim() : 'VOD'
        const title = cleanTitle(rawTitle)

        current = {
          title: title || rawTitle || 'VOD',
          rawTitle,
          group: groupMatch ? groupMatch[1].trim() : '',
          logo: logoMatch ? logoMatch[1].trim() : ''
        }

        continue
      }

      if (current && line.startsWith('http')) {
        const streamUrl = line.trim()

        try {
          if (!isVideoUrl(streamUrl)) {
            skipped++
            current = null
            continue
          }

          if (
            isBlocked(
              current.rawTitle || current.title,
              current.group,
              streamUrl,
              current.logo
            )
          ) {
            skipped++
            current = null
            continue
          }

          const isSeries = looksLikeSeries(
            current.title,
            current.group,
            streamUrl
          )

          if (targetType === 'Series' && !isSeries) {
            skipped++
            current = null
            continue
          }

          if (targetType === 'Filmes' && isSeries) {
            skipped++
            current = null
            continue
          }

          const exists = await pool.query(
            `
            SELECT id
            FROM movies
            WHERE video = $1
            LIMIT 1
            `,
            [streamUrl]
          )

          if (exists.rows.length > 0) {
            skipped++
            current = null
            continue
          }

          await pool.query(
            `
            INSERT INTO movies
            (
              title,
              year,
              category,
              image,
              banner,
              video,
              description
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            `,
            [
              current.title,
              '',
              targetType,
              current.logo,
              current.logo,
              streamUrl,
              `Importado M3U - ${current.group || targetType}`
            ]
          )

          added++
        } catch (err) {
          skipped++
          console.log('ERRO ITEM M3U:', err.message)
        }

        current = null
      }
    }

    res.json({
      success: true,
      added,
      skipped
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: err.message || 'erro importar filmes'
    })
  }
})

app.delete('/movies/clean-bad', auth, adminOnly, async (req, res) => {
  try {
    const beforeResult =
      await pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM movies
      `)

    const duplicateResult =
      await pool.query(`
        DELETE FROM movies
        WHERE id IN (
          SELECT id
          FROM (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY LOWER(TRIM(title))
                ORDER BY id ASC
              ) AS rn
            FROM movies
          ) duplicated
          WHERE duplicated.rn > 1
        )
        RETURNING id
      `)

    const badResult =
      await pool.query(`
        DELETE FROM movies
        WHERE
          title IS NULL
          OR TRIM(title) = ''
          OR video IS NULL
          OR TRIM(video) = ''
          OR image IS NULL
          OR TRIM(image) = ''
          OR LOWER(title) IN ('vo','vod','tv','hd','fhd','4k')
          OR LENGTH(TRIM(title)) <= 2
          OR LOWER(title) LIKE '%xxx%'
          OR LOWER(title) LIKE '%adult%'
          OR LOWER(title) LIKE '%porn%'
          OR LOWER(title) LIKE '%porno%'
          OR LOWER(title) LIKE '%sexo%'
          OR LOWER(title) LIKE '%sexy%'
          OR LOWER(title) LIKE '%nude%'
          OR LOWER(title) LIKE '%naked%'
          OR LOWER(title) LIKE '%webcam%'
          OR LOWER(title) LIKE '%web cam%'
          OR LOWER(title) LIKE '%camgirl%'
          OR LOWER(title) LIKE '%cam girl%'
          OR LOWER(title) LIKE '%camtv%'
          OR LOWER(title) LIKE '%mycamtv%'
          OR LOWER(title) LIKE '%onlyfans%'
          OR LOWER(title) LIKE '%fansly%'
          OR LOWER(title) LIKE '%bonga%'
          OR LOWER(title) LIKE '%livejasmin%'
          OR LOWER(title) LIKE '%strip%'
          OR LOWER(title) LIKE '%escort%'
          OR LOWER(title) LIKE '%webmodel%'
          OR LOWER(title) LIKE '%erotic%'
          OR LOWER(title) LIKE '%erin%'
          OR LOWER(title) LIKE '%nessa%'
          OR LOWER(title) LIKE '%imeliana%'
          OR LOWER(title) LIKE '%marina%'
          OR LOWER(title) LIKE '%aoki%'
          OR LOWER(title) LIKE '%danna%'
          OR LOWER(title) LIKE '%gingercherry%'
          OR LOWER(title) LIKE '%holly%'
          OR LOWER(title) LIKE '%hinata%'
          OR LOWER(title) LIKE '%scarlet%'
          OR LOWER(title) LIKE '%sweetness%'
          OR LOWER(title) LIKE '%taylorblack%'
          OR LOWER(title) LIKE '%valery%'
          OR LOWER(title) LIKE '%yomoy%'
          OR LOWER(title) LIKE '%karolina%'
          OR LOWER(title) LIKE '%lana%'
          OR LOWER(title) LIKE '%locomoco%'
          OR title LIKE '\\_%' ESCAPE '\\'
          OR title LIKE '%\\_' ESCAPE '\\'
          OR title LIKE '%__%'
          OR LOWER(category) LIKE '%adult%'
          OR LOWER(category) LIKE '%xxx%'
          OR LOWER(category) LIKE '%porn%'
          OR LOWER(category) LIKE '%webcam%'
          OR LOWER(category) LIKE '%cam%'
          OR LOWER(category) LIKE '%radio%'
          OR LOWER(category) LIKE '%news%'
          OR LOWER(category) LIKE '%sports%'
          OR LOWER(category) LIKE '%music%'
          OR LOWER(category) LIKE '%live%'
          OR LOWER(video) LIKE '%xxx%'
          OR LOWER(video) LIKE '%adult%'
          OR LOWER(video) LIKE '%porn%'
          OR LOWER(video) LIKE '%webcam%'
          OR LOWER(video) LIKE '%camtv%'
          OR LOWER(video) LIKE '%mycamtv%'
          OR LOWER(video) LIKE '%onlyfans%'
          OR LOWER(video) LIKE '%fansly%'
          OR LOWER(video) LIKE '%bonga%'
          OR LOWER(video) LIKE '%livejasmin%'
          OR LOWER(video) LIKE '%udp://%'
          OR LOWER(video) LIKE '%rtmp://%'
          OR LOWER(image) LIKE '%placeholder%'
          OR LOWER(image) LIKE '%no-image%'
          OR LOWER(image) LIKE '%undefined%'
          OR LOWER(image) LIKE '%ui-avatars%'
        RETURNING id
      `)

    const afterResult =
      await pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM movies
      `)

    const removedDuplicates = duplicateResult.rowCount || 0
    const removedBad = badResult.rowCount || 0
    const removed = removedDuplicates + removedBad

    res.json({
      success: true,
      removed,
      removedDuplicates,
      removedBad,
      totalBefore: beforeResult.rows[0]?.total || 0,
      totalAfter: afterResult.rows[0]?.total || 0
    })
  } catch (err) {
    console.log('ERRO CLEAN BAD:', err)

    res.status(500).json({
      error: 'erro ao limpar lixo'
    })
  }
})

app.delete('/movies/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM movies
      WHERE id = $1
      `,
      [req.params.id]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro remover filme'
    })
  }
})

app.delete('/movies-clear', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(`
      TRUNCATE TABLE movies RESTART IDENTITY
    `)

    res.json({
      success: true,
      message: 'todos os filmes e séries foram removidos'
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro ao limpar filmes'
    })
  }
})

app.get('/series', auth, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10)

    if (isNaN(limit) || limit <= 0) {
      limit = 1000
    }

    if (limit > 1000) {
      limit = 1000
    }

    const result =
      await pool.query(
        `
        SELECT
          id,
          title,
          year,
          category,
          image,
          banner,
          video,
          description,
          created_at
        FROM movies
        WHERE category = 'Series'
        ORDER BY id DESC
        LIMIT $1
        `,
        [limit]
      )

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro series'
    })
  }
})

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
    console.log('ERRO WATCHING:', err)

    res.status(500).json({
      error: 'erro ao atualizar assistindo'
    })
  }
})

app.post('/xtream/import', auth, adminOnly, async (req, res) => {
  try {
    let { server, username, password } = req.body

    if (!server || !username || !password) {
      return res.status(400).json({
        error: 'Servidor, usuário e senha são obrigatórios'
      })
    }

    server = String(server).trim().replace(/\/+$/, '')
    username = String(username).trim()
    password = String(password).trim()

    function makeApiUrl(action = '') {
      const params = new URLSearchParams()
      params.set('username', username)
      params.set('password', password)

      if (action) {
        params.set('action', action)
      }

      return `${server}/player_api.php?${params.toString()}`
    }

    async function getJson(url) {
      const r = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: '*/*',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'
          }
      })

      const text = await r.text()

      if (!r.ok) {
        console.log('XTREAM URL ERROR:', url)
        console.log('XTREAM RESPONSE:', text.slice(0, 300))

        throw new Error(`HTTP ${r.status}`)
      }

      try {
        return JSON.parse(text)
      } catch {
        console.log('XTREAM JSON INVALIDO:', text.slice(0, 300))
        throw new Error('Resposta Xtream inválida')
      }
    }

    const authData = await getJson(makeApiUrl())

    if (!authData?.user_info || Number(authData.user_info.auth) !== 1) {
      return res.status(400).json({
        error: 'Login Xtream inválido ou expirado'
      })
    }

    const live = await getJson(makeApiUrl('get_live_streams'))
    const vod = await getJson(makeApiUrl('get_vod_streams'))
    const seriesList = await getJson(makeApiUrl('get_series'))

    let channels = 0
    let movies = 0
    let series = 0
    let skipped = 0

    for (const item of Array.isArray(live) ? live : []) {
      try {
        if (!item.stream_id) {
          skipped++
          continue
        }

        const streamUrl = `${server}/live/${username}/${password}/${item.stream_id}.m3u8`

        const result = await pool.query(
          `
          INSERT INTO channels
          (
            name,
            url,
            category,
            logo,
            is_online
          )
          VALUES ($1,$2,$3,$4,true)
          ON CONFLICT (url)
          DO NOTHING
          RETURNING id
          `,
          [
            item.name || 'Canal',
            streamUrl,
            item.category_name || `Categoria ${item.category_id || 'TV'}`,
            item.stream_icon || ''
          ]
        )

        if (result.rows.length > 0) channels++
      } catch (err) {
        skipped++
      }
    }

    for (const item of Array.isArray(vod) ? vod : []) {
      try {
        if (!item.stream_id) {
          skipped++
          continue
        }

        const ext = item.container_extension || 'mp4'
        const streamUrl = `${server}/movie/${username}/${password}/${item.stream_id}.${ext}`

        const exists = await pool.query(
          `
          SELECT id
          FROM movies
          WHERE video = $1
          LIMIT 1
          `,
          [streamUrl]
        )

        if (exists.rows.length > 0) {
          skipped++
          continue
        }

        await pool.query(
          `
          INSERT INTO movies
          (
            title,
            year,
            category,
            image,
            banner,
            video,
            description
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            item.name || 'Filme',
            item.year || '',
            'Filmes',
            item.stream_icon || '',
            item.stream_icon || '',
            streamUrl,
            item.plot || 'Importado via Xtream'
          ]
        )

        movies++
      } catch (err) {
        skipped++
      }
    }

    for (const item of Array.isArray(seriesList) ? seriesList : []) {
      try {
        if (!item.series_id) {
          skipped++
          continue
        }

        const streamUrl = `${server}/series/${username}/${password}/${item.series_id}.m3u8`

        const exists = await pool.query(
          `
          SELECT id
          FROM movies
          WHERE title = $1
          AND category = 'Series'
          LIMIT 1
          `,
          [item.name || 'Série']
        )

        if (exists.rows.length > 0) {
          skipped++
          continue
        }

        await pool.query(
          `
          INSERT INTO movies
          (
            title,
            year,
            category,
            image,
            banner,
            video,
            description
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            item.name || 'Série',
            item.year || '',
            'Series',
            item.cover || '',
            item.cover || '',
            streamUrl,
            item.plot || 'Importado via Xtream'
          ]
        )

        series++
      } catch (err) {
        skipped++
      }
    }

    res.json({
      success: true,
      channels,
      movies,
      series,
      skipped
    })
  } catch (err) {
    console.log('XTREAM IMPORT ERROR:', err.message)

    res.status(500).json({
      error: err.message || 'erro ao importar Xtream'
    })
  }
})
app.get('/proxy-stream', async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).send('url obrigatória')
    }

    const streamUrl = decodeURIComponent(String(url))

    if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
      return res.status(400).send('url inválida')
    }

    const response = await fetch(streamUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: '*/*',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: streamUrl,
        Origin: new URL(streamUrl).origin,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return res.status(response.status).send(`stream erro ${response.status}`)
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Cache-Control', 'no-cache')

    const contentType = response.headers.get('content-type') || ''
    const lowerUrl = streamUrl.toLowerCase()

    const isPlaylist =
      contentType.includes('mpegurl') ||
      contentType.includes('application/vnd.apple.mpegurl') ||
      lowerUrl.includes('.m3u8')

    if (isPlaylist) {
      const text = await response.text()

      const fixedText = text
        .split('\n')
        .map(line => {
          const clean = line.trim()

          if (!clean || clean.startsWith('#')) {
            return line
          }

          let absoluteUrl = ''

          try {
            absoluteUrl = new URL(clean, streamUrl).href
          } catch {
            absoluteUrl = clean
          }

          return `https://iptv-backend-cuxf.onrender.com/proxy-stream?url=${encodeURIComponent(
            absoluteUrl
          )}`
        })
        .join('\n')

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      return res.send(fixedText)
    }

    res.setHeader('Content-Type', contentType || 'video/mp2t')

    const buffer = Buffer.from(await response.arrayBuffer())
    return res.send(buffer)
  } catch (err) {
    console.log('PROXY STREAM ERROR:', err.message)
    res.status(500).send('erro proxy stream')
  }
})
app.get('/', (req, res) => {
  res.send('IPTV SERVER ONLINE')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER ON ${PORT}`)
})