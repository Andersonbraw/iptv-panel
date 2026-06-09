import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import dotenv from 'dotenv'
import crypto from 'crypto'
import { XMLParser } from 'fast-xml-parser'
import { Readable } from 'stream'

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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reseller_parent_id INTEGER
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_reseller_parent_id
    ON users(reseller_parent_id)
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_test_ip TEXT DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_test_created_at TIMESTAMP
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
    UPDATE movies
    SET category = 'Series'
    WHERE
      category <> 'Series'
      AND (
        LOWER(COALESCE(video, '')) LIKE '%/series/%'
        OR LOWER(COALESCE(description, '')) LIKE '%série%'
        OR LOWER(COALESCE(description, '')) LIKE '%serie%'
        OR LOWER(COALESCE(description, '')) LIKE '%series%'
        OR LOWER(COALESCE(description, '')) LIKE '%temporada%'
        OR LOWER(COALESCE(description, '')) LIKE '%episodio%'
        OR LOWER(COALESCE(description, '')) LIKE '%episódio%'
        OR LOWER(COALESCE(description, '')) LIKE '%capítulo%'
        OR LOWER(COALESCE(description, '')) LIKE '%capitulo%'
        OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
        OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
        OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
        OR LOWER(COALESCE(title, '')) LIKE '%capítulo%'
        OR LOWER(COALESCE(title, '')) LIKE '%capitulo%'
        OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
        OR LOWER(COALESCE(title, '')) ~ '[0-9]{1,2}x[0-9]{1,3}'
        OR LOWER(COALESCE(title, '')) ~ 't[0-9]{1,2}[[:space:]]*e[0-9]{1,3}'
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reseller_credit_history (
      id SERIAL PRIMARY KEY,
      reseller_id INTEGER,
      admin_id INTEGER,
      type TEXT,
      amount INTEGER DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reseller_credit_history_reseller_id
    ON reseller_credit_history(reseller_id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reseller_sales (
      id SERIAL PRIMARY KEY,
      reseller_id INTEGER,
      client_id INTEGER,
      client_name TEXT,
      client_email TEXT,
      sale_type TEXT,
      sale_value NUMERIC DEFAULT 0,
      commission NUMERIC DEFAULT 0,
      profit NUMERIC DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reseller_sales_reseller_id
    ON reseller_sales(reseller_id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reseller_payments (
      id SERIAL PRIMARY KEY,
      reseller_id INTEGER,
      amount NUMERIC DEFAULT 0,
      method TEXT DEFAULT 'PIX',
      status TEXT DEFAULT 'paid',
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reseller_payments_reseller_id
    ON reseller_payments(reseller_id)
  `)

  await pool.query(`
    UPDATE reseller_sales
    SET
      sale_value = 0,
      commission = 0,
      profit = 0,
      sale_type = 'teste_5h',
      description = 'Teste 5 horas gerado'
    WHERE
      sale_type IN ('teste_24h','teste_5h')
      OR LOWER(COALESCE(description, '')) LIKE '%teste%'
  `)

  await pool.query(`
    UPDATE reseller_sales
    SET
      sale_value = 8,
      commission = 0,
      profit = 8,
      sale_type = 'cliente_30_dias',
      description = 'Cliente 30 dias criado'
    WHERE
      sale_type NOT IN ('teste_5h')
      AND LOWER(COALESCE(description, '')) NOT LIKE '%teste%'
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
        reseller_parent_id: user.reseller_parent_id,
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


function adminOrReseller(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'reseller') {
    return res.status(403).json({
      error: 'somente admin ou revendedor'
    })
  }

  next()
}


function generateSimplePassword() {
  return Math.random()
    .toString(36)
    .slice(2, 10)
}

async function addCreditHistory(resellerId, adminId, type, amount, description) {
  try {
    await pool.query(
      `
      INSERT INTO reseller_credit_history
      (
        reseller_id,
        admin_id,
        type,
        amount,
        description
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        resellerId,
        adminId || null,
        type || '',
        Number(amount || 0),
        description || ''
      ]
    )
  } catch (err) {
    console.log('ERRO CREDIT HISTORY:', err.message)
  }
}

async function addResellerSale(resellerId, client, saleType = 'cliente_30_dias') {
  const saleValue = saleType === 'teste_5h' ? 0 : 8

  let commissionRate = 0

  try {
    const resellerResult = await pool.query(
      `
      SELECT commission_rate
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [resellerId]
    )

    commissionRate = Number(resellerResult.rows[0]?.commission_rate || 0)
  } catch {
    commissionRate = 0
  }

  const commission = saleType === 'teste_5h'
    ? 0
    : Number(((saleValue * commissionRate) / 100).toFixed(2))

  const profit = Number((saleValue - commission).toFixed(2))

  try {
    await pool.query(
      `
      INSERT INTO reseller_sales
      (
        reseller_id,
        client_id,
        client_name,
        client_email,
        sale_type,
        sale_value,
        commission,
        profit,
        description
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        resellerId,
        client.id,
        client.name,
        client.email,
        saleType,
        saleValue,
        commission,
        profit,
        saleType === 'teste_5h'
          ? 'Teste 5 horas gerado'
          : 'Cliente 30 dias criado'
      ]
    )

    if (commission > 0) {
      await pool.query(
        `
        UPDATE users
        SET balance = COALESCE(balance, 0) + $1
        WHERE id = $2
        `,
        [
          commission,
          resellerId
        ]
      )
    }
  } catch (err) {
    console.log('ERRO ADD SALE:', err.message)
  }
}

async function getResellerFinance(resellerId) {
  const [salesResult, todayResult, monthResult, creditResult, paymentsResult] = await Promise.all([
    pool.query(
      `
      SELECT
        COALESCE(SUM(sale_value),0)::NUMERIC AS vendas,
        COALESCE(SUM(commission),0)::NUMERIC AS comissoes,
        COALESCE(SUM(profit),0)::NUMERIC AS lucro,
        COUNT(*)::INTEGER AS total_vendas
      FROM reseller_sales
      WHERE reseller_id = $1
      `,
      [resellerId]
    ),
    pool.query(
      `
      SELECT
        COALESCE(SUM(sale_value),0)::NUMERIC AS vendas_hoje,
        COALESCE(SUM(commission),0)::NUMERIC AS comissoes_hoje,
        COALESCE(SUM(profit),0)::NUMERIC AS lucro_hoje,
        COUNT(*)::INTEGER AS total_hoje
      FROM reseller_sales
      WHERE reseller_id = $1
        AND created_at::DATE = NOW()::DATE
      `,
      [resellerId]
    ),
    pool.query(
      `
      SELECT
        COALESCE(SUM(sale_value),0)::NUMERIC AS vendas_mes,
        COALESCE(SUM(commission),0)::NUMERIC AS comissoes_mes,
        COALESCE(SUM(profit),0)::NUMERIC AS lucro_mes,
        COUNT(*)::INTEGER AS total_mes
      FROM reseller_sales
      WHERE reseller_id = $1
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `,
      [resellerId]
    ),
    pool.query(
      `
      SELECT *
      FROM reseller_credit_history
      WHERE reseller_id = $1
      ORDER BY id DESC
      LIMIT 50
      `,
      [resellerId]
    ),
    pool.query(
      `
      SELECT *
      FROM reseller_payments
      WHERE reseller_id = $1
      ORDER BY id DESC
      LIMIT 30
      `,
      [resellerId]
    )
  ])

  return {
    finance: {
      ...(salesResult.rows[0] || {}),
      ...(todayResult.rows[0] || {}),
      ...(monthResult.rows[0] || {})
    },
    creditHistory: creditResult.rows || [],
    payments: paymentsResult.rows || []
  }
}


async function getResellerNotifications(resellerId) {
  const notifications = []

  try {
    const resellerResult = await pool.query(
      `
      SELECT credits, balance
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [resellerId]
    )

    const reseller = resellerResult.rows[0]

    if (Number(reseller?.credits || 0) <= 2) {
      notifications.push({
        type: 'credits',
        title: 'Créditos acabando',
        message: `Você tem ${Number(reseller?.credits || 0)} crédito(s) disponível(is).`
      })
    }

    if (Number(reseller?.balance || 0) > 0) {
      notifications.push({
        type: 'balance',
        title: 'Saldo disponível',
        message: `Seu saldo de comissão é R$ ${Number(reseller.balance).toFixed(2)}.`
      })
    }

    const expiring = await pool.query(
      `
      SELECT name, email, expires_at
      FROM users
      WHERE reseller_parent_id = $1
        AND role = 'client'
        AND expires_at IS NOT NULL
        AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      ORDER BY expires_at ASC
      LIMIT 10
      `,
      [resellerId]
    )

    for (const client of expiring.rows) {
      notifications.push({
        type: 'expiring',
        title: 'Cliente vencendo',
        message: `${client.name} vence em ${new Date(client.expires_at).toLocaleString('pt-BR')}.`
      })
    }

    const payment = await pool.query(
      `
      SELECT amount, method, created_at
      FROM reseller_payments
      WHERE reseller_id = $1
      ORDER BY id DESC
      LIMIT 3
      `,
      [resellerId]
    )

    for (const item of payment.rows) {
      notifications.push({
        type: 'payment',
        title: 'Novo pagamento',
        message: `Pagamento ${item.method} de R$ ${Number(item.amount).toFixed(2)} registrado.`
      })
    }
  } catch (err) {
    console.log('ERRO NOTIFICATIONS:', err.message)
  }

  return notifications
}


app.get('/reseller/dashboard', auth, adminOrReseller, async (req, res) => {
  try {
    const ownerId = req.user.id

    const [meResult, clientsResult, salesResult, financePack] = await Promise.all([
      pool.query(
        `
        SELECT id, name, email, role, status, credits, commission_rate, balance
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [ownerId]
      ),
      pool.query(
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
          credits,
          watching,
          watching_type,
          watching_updated_at
        FROM users
        WHERE reseller_parent_id = $1
        ORDER BY id DESC
        `,
        [ownerId]
      ),
      pool.query(
        `
        SELECT *
        FROM reseller_sales
        WHERE reseller_id = $1
        ORDER BY id DESC
        LIMIT 80
        `,
        [ownerId]
      ),
      getResellerFinance(ownerId)
    ])

    res.json({
      reseller: meResult.rows[0],
      clients: clientsResult.rows,
      sales: salesResult.rows,
      finance: financePack.finance,
      creditHistory: financePack.creditHistory,
      payments: financePack.payments,
      notifications: await getResellerNotifications(ownerId)
    })
  } catch (err) {
    console.log('ERRO RESELLER DASHBOARD:', err)
    res.status(500).json({
      error: 'erro ao carregar painel revendedor'
    })
  }
})

app.post('/reseller/clients/create-random', auth, adminOrReseller, async (req, res) => {
  try {
    const ownerId = req.user.id

    const ownerResult = await pool.query(
      `
      SELECT id, role, credits, status
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [ownerId]
    )

    const owner = ownerResult.rows[0]

    if (!owner || owner.status !== 'active') {
      return res.status(403).json({
        error: 'revendedor bloqueado'
      })
    }

    const credits = Number(owner.credits || 0)

    if (credits <= 0) {
      return res.status(400).json({
        error: 'sem créditos disponíveis'
      })
    }

    const login = generateRandomLogin(req.body.name)

    const result = await pool.query(
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
        expires_at,
        credits,
        reseller_parent_id
      )
      VALUES ($1,$2,$3,'client','active','premium',1,NOW() + INTERVAL '30 days',0,$4)
      RETURNING id, name, email, role, status, plan, max_connections, expires_at, credits, reseller_parent_id
      `,
      [
        login.name,
        login.email,
        login.password,
        ownerId
      ]
    )

    await pool.query(
      `
      UPDATE users
      SET credits = GREATEST(credits - 1, 0)
      WHERE id = $1
      `,
      [ownerId]
    )

    await addCreditHistory(
      ownerId,
      null,
      'saida',
      -1,
      'Cliente 30 dias criado'
    )

    await addResellerSale(
      ownerId,
      result.rows[0],
      'cliente_30_dias'
    )

    res.json({
      success: true,
      user: result.rows[0],
      login: {
        name: login.name,
        email: login.email,
        password: login.password
      }
    })
  } catch (err) {
    console.log('ERRO CREATE CLIENT BY RESELLER:', err)

    res.status(500).json({
      error: err.message || 'erro ao criar cliente'
    })
  }
})


app.post('/reseller/clients/create-test', auth, adminOrReseller, async (req, res) => {
  try {
    const ownerId = req.user.id
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      ''

    const duplicateIp = await pool.query(
      `
      SELECT id
      FROM users
      WHERE reseller_parent_id = $1
        AND role = 'client'
        AND plan = 'teste'
        AND last_test_ip = $2
        AND last_test_created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
      `,
      [
        ownerId,
        ip
      ]
    )

    if (duplicateIp.rows.length > 0) {
      return res.status(400).json({
        error: 'já existe teste recente para este IP'
      })
    }

    const duplicateName = await pool.query(
      `
      SELECT id
      FROM users
      WHERE reseller_parent_id = $1
        AND role = 'client'
        AND plan = 'teste'
        AND LOWER(name) = LOWER($2)
        AND expires_at > NOW()
      LIMIT 1
      `,
      [
        ownerId,
        req.body.name || 'Teste 5H'
      ]
    )

    if (duplicateName.rows.length > 0) {
      return res.status(400).json({
        error: 'já existe teste ativo com esse nome'
      })
    }

    const login = generateRandomLogin(req.body.name || 'Teste 5H')

    const result = await pool.query(
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
        expires_at,
        credits,
        reseller_parent_id,
        last_test_ip,
        last_test_created_at
      )
      VALUES ($1,$2,$3,'client','active','teste',1,NOW() + INTERVAL '5 hours',0,$4,$5,NOW())
      RETURNING id, name, email, role, status, plan, max_connections, expires_at, credits, reseller_parent_id
      `,
      [
        login.name,
        login.email,
        login.password,
        ownerId,
        ip
      ]
    )

    await addResellerSale(
      ownerId,
      result.rows[0],
      'teste_5h'
    )

    res.json({
      success: true,
      user: result.rows[0],
      login: {
        name: login.name,
        email: login.email,
        password: login.password
      }
    })
  } catch (err) {
    console.log('ERRO CREATE TEST:', err)
    res.status(500).json({
      error: err.message || 'erro ao criar teste 5h'
    })
  }
})


app.patch('/reseller/clients/:id/name', auth, adminOrReseller, async (req, res) => {
  try {
    const { name } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: 'nome obrigatório'
      })
    }

    const result = await pool.query(
      `
      UPDATE users
      SET name = $1
      WHERE id = $2
        AND reseller_parent_id = $3
        AND role = 'client'
      RETURNING id, name, email, status, plan, max_connections, expires_at
      `,
      [
        String(name).trim(),
        req.params.id,
        req.user.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO RENAME CLIENT:', err)
    res.status(500).json({
      error: 'erro ao editar nome'
    })
  }
})

app.post('/reseller/clients/:id/reset-password', auth, adminOrReseller, async (req, res) => {
  try {
    const password = generateSimplePassword()

    const result = await pool.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
        AND reseller_parent_id = $3
        AND role = 'client'
      RETURNING id, name, email
      `,
      [
        password,
        req.params.id,
        req.user.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json({
      success: true,
      login: {
        name: result.rows[0].name,
        email: result.rows[0].email,
        password
      }
    })
  } catch (err) {
    console.log('ERRO RESET PASSWORD:', err)
    res.status(500).json({
      error: 'erro ao resetar senha'
    })
  }
})


app.patch('/reseller/clients/:id', auth, adminOrReseller, async (req, res) => {
  try {
    const { id } = req.params
    const { status, max_connections, expires_at } = req.body

    const result = await pool.query(
      `
      UPDATE users
      SET
        status = COALESCE($1, status),
        max_connections = COALESCE($2, max_connections),
        expires_at = COALESCE($3, expires_at)
      WHERE id = $4
        AND reseller_parent_id = $5
        AND role = 'client'
      RETURNING id, name, email, status, plan, max_connections, expires_at
      `,
      [
        status,
        max_connections,
        expires_at,
        id,
        req.user.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO UPDATE CLIENT RESELLER:', err)

    res.status(500).json({
      error: 'erro ao atualizar cliente'
    })
  }
})


app.post('/reseller/clients/:id/renew-30-days', auth, adminOrReseller, async (req, res) => {
  try {
    const ownerId = req.user.id

    const ownerResult = await pool.query(
      `
      SELECT id, credits, status
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [ownerId]
    )

    const owner = ownerResult.rows[0]

    if (!owner || owner.status !== 'active') {
      return res.status(403).json({
        error: 'revendedor bloqueado'
      })
    }

    if (Number(owner.credits || 0) <= 0) {
      return res.status(400).json({
        error: 'sem créditos disponíveis'
      })
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        plan = 'premium',
        status = 'active',
        expires_at =
          CASE
            WHEN expires_at IS NULL OR expires_at < NOW()
            THEN NOW() + INTERVAL '30 days'
            ELSE expires_at + INTERVAL '30 days'
          END
      WHERE id = $1
        AND reseller_parent_id = $2
        AND role = 'client'
      RETURNING id, name, email, role, status, plan, max_connections, expires_at
      `,
      [
        req.params.id,
        ownerId
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    await pool.query(
      `
      UPDATE users
      SET credits = GREATEST(credits - 1, 0)
      WHERE id = $1
      `,
      [ownerId]
    )

    await addCreditHistory(
      ownerId,
      null,
      'saida',
      -1,
      'Cliente renovado por 30 dias'
    )

    await addResellerSale(
      ownerId,
      result.rows[0],
      'cliente_30_dias'
    )

    res.json({
      success: true,
      user: result.rows[0]
    })
  } catch (err) {
    console.log('ERRO RENEW CLIENT:', err)
    res.status(500).json({
      error: 'erro ao renovar cliente'
    })
  }
})


app.delete('/reseller/clients/:id', auth, adminOrReseller, async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
        AND reseller_parent_id = $2
        AND role = 'client'
      RETURNING id
      `,
      [req.params.id, req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json({
      success: true
    })
  } catch (err) {
    console.log('ERRO DELETE CLIENT RESELLER:', err)

    res.status(500).json({
      error: 'erro ao excluir cliente'
    })
  }
})

app.get('/admin/resellers', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        r.id,
        r.name,
        r.email,
        r.role,
        r.status,
        r.credits,
        r.commission_rate,
        r.balance,
        COUNT(DISTINCT c.id)::INTEGER AS clients_count,
        COALESCE(SUM(s.sale_value),0)::NUMERIC AS vendas,
        COALESCE(SUM(s.commission),0)::NUMERIC AS comissoes,
        COALESCE(SUM(s.profit),0)::NUMERIC AS lucro
      FROM users r
      LEFT JOIN users c
        ON c.reseller_parent_id = r.id
        AND c.role = 'client'
      LEFT JOIN reseller_sales s
        ON s.reseller_id = r.id
      WHERE r.role = 'reseller'
      GROUP BY r.id
      ORDER BY r.id DESC
      `
    )

    res.json(result.rows)
  } catch (err) {
    console.log('ERRO ADMIN RESELLERS:', err)

    res.status(500).json({
      error: 'erro ao buscar revendedores'
    })
  }
})

app.post('/admin/resellers/create', auth, adminOnly, async (req, res) => {
  try {
    const login = generateRandomLogin(req.body.name)
    const credits = Math.max(0, Number(req.body.credits || 0))

    const result = await pool.query(
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
        expires_at,
        credits
      )
      VALUES ($1,$2,$3,'reseller','active','revendedor',1,NULL,$4)
      RETURNING id, name, email, role, status, credits
      `,
      [
        login.name,
        login.email,
        login.password,
        credits
      ]
    )

    if (credits > 0) {
      await addCreditHistory(
        result.rows[0].id,
        req.user.id,
        'entrada',
        credits,
        'Créditos iniciais do revendedor'
      )
    }

    res.json({
      success: true,
      reseller: result.rows[0],
      login: {
        name: login.name,
        email: login.email,
        password: login.password
      }
    })
  } catch (err) {
    console.log('ERRO CREATE RESELLER:', err)

    res.status(500).json({
      error: err.message || 'erro ao criar revendedor'
    })
  }
})

app.patch('/admin/resellers/:id', auth, adminOnly, async (req, res) => {
  try {
    const { status, credits } = req.body

    const result = await pool.query(
      `
      UPDATE users
      SET
        status = COALESCE($1, status),
        credits = COALESCE($2, credits)
      WHERE id = $3
        AND role = 'reseller'
      RETURNING id, name, email, role, status, credits
      `,
      [
        status,
        credits,
        req.params.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'revendedor não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO UPDATE RESELLER:', err)

    res.status(500).json({
      error: 'erro ao atualizar revendedor'
    })
  }
})

app.post('/admin/resellers/:id/add-credits', auth, adminOnly, async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0)

    if (amount <= 0) {
      return res.status(400).json({
        error: 'quantidade inválida'
      })
    }

    const result = await pool.query(
      `
      UPDATE users
      SET credits = credits + $1
      WHERE id = $2
        AND role = 'reseller'
      RETURNING id, name, email, role, status, credits
      `,
      [
        amount,
        req.params.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'revendedor não encontrado'
      })
    }

    await addCreditHistory(
      req.params.id,
      req.user.id,
      'entrada',
      amount,
      'Créditos adicionados pelo admin'
    )

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO ADD CREDITS RESELLER:', err)

    res.status(500).json({
      error: 'erro ao adicionar créditos'
    })
  }
})


app.patch('/admin/resellers/:id/commission', auth, adminOnly, async (req, res) => {
  try {
    const rate = Number(req.body.commission_rate || 0)

    if (![0, 20, 30, 40].includes(rate)) {
      return res.status(400).json({
        error: 'comissão inválida'
      })
    }

    const result = await pool.query(
      `
      UPDATE users
      SET commission_rate = $1
      WHERE id = $2
        AND role = 'reseller'
      RETURNING id, name, email, commission_rate, balance
      `,
      [
        rate,
        req.params.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'revendedor não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO COMMISSION:', err)
    res.status(500).json({
      error: 'erro ao configurar comissão'
    })
  }
})

app.post('/admin/resellers/:id/payment', auth, adminOnly, async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0)

    if (amount <= 0) {
      return res.status(400).json({
        error: 'valor inválido'
      })
    }

    await pool.query(
      `
      INSERT INTO reseller_payments
      (
        reseller_id,
        amount,
        method,
        status,
        description
      )
      VALUES ($1,$2,$3,'paid',$4)
      `,
      [
        req.params.id,
        amount,
        req.body.method || 'PIX',
        req.body.description || 'Pagamento registrado pelo admin'
      ]
    )

    await pool.query(
      `
      UPDATE users
      SET balance = GREATEST(COALESCE(balance, 0) - $1, 0)
      WHERE id = $2
        AND role = 'reseller'
      `,
      [
        amount,
        req.params.id
      ]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.log('ERRO PAYMENT:', err)
    res.status(500).json({
      error: 'erro ao registrar pagamento'
    })
  }
})


app.get('/admin/resellers/:id/clients', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
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
        watching,
        watching_type,
        watching_updated_at
      FROM users
      WHERE reseller_parent_id = $1
      ORDER BY id DESC
      `,
      [req.params.id]
    )

    res.json(result.rows)
  } catch (err) {
    console.log('ERRO RESELLER CLIENTS:', err)

    res.status(500).json({
      error: 'erro ao buscar clientes do revendedor'
    })
  }
})


app.patch('/admin/resellers/clients/:id/name', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: 'nome obrigatório'
      })
    }

    const result = await pool.query(
      `
      UPDATE users
      SET name = $1
      WHERE id = $2
        AND role = 'client'
      RETURNING id, name, email, status, plan, max_connections, expires_at
      `,
      [
        String(name).trim(),
        req.params.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO ADMIN RENAME CLIENT:', err)
    res.status(500).json({
      error: 'erro ao editar nome'
    })
  }
})

app.post('/admin/resellers/clients/:id/reset-password', auth, adminOnly, async (req, res) => {
  try {
    const password = generateSimplePassword()

    const result = await pool.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
        AND role = 'client'
      RETURNING id, name, email
      `,
      [
        password,
        req.params.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json({
      success: true,
      login: {
        name: result.rows[0].name,
        email: result.rows[0].email,
        password
      }
    })
  } catch (err) {
    console.log('ERRO ADMIN RESET PASSWORD:', err)
    res.status(500).json({
      error: 'erro ao resetar senha'
    })
  }
})

app.patch('/admin/resellers/clients/:id', auth, adminOnly, async (req, res) => {
  try {
    const { status, max_connections, expires_at } = req.body

    const result = await pool.query(
      `
      UPDATE users
      SET
        status = COALESCE($1, status),
        max_connections = COALESCE($2, max_connections),
        expires_at = COALESCE($3, expires_at)
      WHERE id = $4
        AND role = 'client'
      RETURNING id, name, email, status, plan, max_connections, expires_at
      `,
      [
        status,
        max_connections,
        expires_at,
        req.params.id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO ADMIN UPDATE CLIENT:', err)
    res.status(500).json({
      error: 'erro ao atualizar cliente'
    })
  }
})



app.patch('/admin/resellers/clients/:id/renew-30-days', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE users
      SET
        plan = 'premium',
        status = 'active',
        expires_at =
          CASE
            WHEN expires_at IS NULL OR expires_at < NOW()
            THEN NOW() + INTERVAL '30 days'
            ELSE expires_at + INTERVAL '30 days'
          END
      WHERE id = $1
        AND role = 'client'
      RETURNING id, name, email, status, plan, max_connections, expires_at
      `,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'cliente não encontrado'
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.log('ERRO ADMIN RENEW CLIENT:', err)
    res.status(500).json({
      error: 'erro ao renovar cliente'
    })
  }
})


app.delete('/admin/resellers/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE users
      SET reseller_parent_id = NULL
      WHERE reseller_parent_id = $1
      `,
      [req.params.id]
    )

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
        AND role = 'reseller'
      RETURNING id
      `,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'revendedor não encontrado'
      })
    }

    res.json({
      success: true
    })
  } catch (err) {
    console.log('ERRO DELETE RESELLER:', err)

    res.status(500).json({
      error: 'erro ao excluir revendedor'
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


app.get('/admin/stats', auth, adminOnly, async (req, res) => {
  try {
    const [channelsResult, moviesResult, seriesResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM channels
      `),
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM movies
        WHERE
          LOWER(COALESCE(category, '')) NOT LIKE '%series%'
          AND LOWER(COALESCE(category, '')) NOT LIKE '%séries%'
          AND LOWER(COALESCE(video, '')) NOT LIKE '%/series/%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%temporada%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%episodio%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%episódio%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%capitulo%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%capítulo%'
      `),
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM movies
        WHERE
          category = 'Series'
          OR LOWER(COALESCE(video, '')) LIKE '%/series/%'
          OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
          OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
          OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
          OR LOWER(COALESCE(title, '')) LIKE '%capitulo%'
          OR LOWER(COALESCE(title, '')) LIKE '%capítulo%'
          OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
          OR LOWER(COALESCE(title, '')) ~ '[0-9]{1,2}x[0-9]{1,3}'
      `)
    ])

    res.json({
      channels: channelsResult.rows[0]?.total || 0,
      movies: moviesResult.rows[0]?.total || 0,
      series: seriesResult.rows[0]?.total || 0
    })
  } catch (err) {
    console.log('ERRO ADMIN STATS:', err)

    res.status(500).json({
      error: 'erro ao buscar estatísticas'
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
          reseller_parent_id,
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
      limit = 50
    }

    if (limit > 5000) {
      limit = 5000
    }

    let offset = parseInt(req.query.offset, 10)

    if (isNaN(offset) || offset < 0) {
      offset = 0
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
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
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
      limit = 50
    }

    if (limit > 5000) {
      limit = 5000
    }

    let offset = parseInt(req.query.offset, 10)

    if (isNaN(offset) || offset < 0) {
      offset = 0
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
        WHERE
          LOWER(COALESCE(category, '')) NOT LIKE '%series%'
          AND LOWER(COALESCE(category, '')) NOT LIKE '%séries%'
          AND LOWER(COALESCE(video, '')) NOT LIKE '%/series/%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%temporada%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%episodio%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%episódio%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%capitulo%'
          AND LOWER(COALESCE(title, '')) NOT LIKE '%capítulo%'
        ORDER BY id DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
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


app.post('/admin/fix-series-categories', auth, adminOnly, async (req, res) => {
  try {
    const before = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE category = 'Series')::INTEGER AS series_before,
        COUNT(*) FILTER (WHERE category <> 'Series')::INTEGER AS movies_before
      FROM movies
    `)

    const result = await pool.query(`
      UPDATE movies
      SET category = 'Series'
      WHERE
        category <> 'Series'
        AND (
          LOWER(COALESCE(video, '')) LIKE '%/series/%'
          OR LOWER(COALESCE(description, '')) LIKE '%série%'
          OR LOWER(COALESCE(description, '')) LIKE '%serie%'
          OR LOWER(COALESCE(description, '')) LIKE '%series%'
          OR LOWER(COALESCE(description, '')) LIKE '%temporada%'
          OR LOWER(COALESCE(description, '')) LIKE '%episodio%'
          OR LOWER(COALESCE(description, '')) LIKE '%episódio%'
          OR LOWER(COALESCE(description, '')) LIKE '%capítulo%'
          OR LOWER(COALESCE(description, '')) LIKE '%capitulo%'
          OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
          OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
          OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
          OR LOWER(COALESCE(title, '')) LIKE '%capítulo%'
          OR LOWER(COALESCE(title, '')) LIKE '%capitulo%'
          OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
          OR LOWER(COALESCE(title, '')) ~ '[0-9]{1,2}x[0-9]{1,3}'
          OR LOWER(COALESCE(title, '')) ~ 't[0-9]{1,2}[[:space:]]*e[0-9]{1,3}'
        )
      RETURNING id
    `)

    const after = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE category = 'Series')::INTEGER AS series_after,
        COUNT(*) FILTER (WHERE category <> 'Series')::INTEGER AS movies_after
      FROM movies
    `)

    res.json({
      success: true,
      moved: result.rowCount || 0,
      before: before.rows[0],
      after: after.rows[0]
    })
  } catch (err) {
    console.log('ERRO FIX SERIES:', err)

    res.status(500).json({
      error: 'erro ao corrigir séries'
    })
  }
})


app.get('/series', auth, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10)

    if (isNaN(limit) || limit <= 0) {
      limit = 50
    }

    if (limit > 5000) {
      limit = 5000
    }

    let offset = parseInt(req.query.offset, 10)

    if (isNaN(offset) || offset < 0) {
      offset = 0
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
        WHERE
          category = 'Series'
          OR LOWER(COALESCE(video, '')) LIKE '%/series/%'
          OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
          OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
          OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
          OR LOWER(COALESCE(title, '')) LIKE '%capitulo%'
          OR LOWER(COALESCE(title, '')) LIKE '%capítulo%'
          OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
          OR LOWER(COALESCE(title, '')) ~ '[0-9]{1,2}x[0-9]{1,3}'
          OR LOWER(COALESCE(title, '')) ~ 't[0-9]{1,2}[[:space:]]*e[0-9]{1,3}'
        ORDER BY id DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
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
            (
              /s\d{1,2}e\d{1,3}/i.test(item.name || '') ||
              /\d{1,2}x\d{1,3}/i.test(item.name || '') ||
              String(item.name || '').toLowerCase().includes('temporada') ||
              String(item.name || '').toLowerCase().includes('episodio') ||
              String(item.name || '').toLowerCase().includes('episódio') ||
              String(item.name || '').toLowerCase().includes('capitulo') ||
              String(item.name || '').toLowerCase().includes('capítulo') ||
              String(item.category_name || '').toLowerCase().includes('series') ||
              String(item.category_name || '').toLowerCase().includes('séries') ||
              String(item.category_name || '').toLowerCase().includes('serie')
            ) ? 'Series' : 'Filmes',
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


app.get('/admin/reports/resellers', auth, adminOnly, async (req, res) => {
  try {
    const [summaryResult, monthResult, creditResult, topMonthResult, todayResult, testsResult] = await Promise.all([
      pool.query(
        `
        SELECT
          r.id,
          r.name,
          r.email,
          r.credits,
          r.status,
          r.commission_rate,
          r.balance,
          COUNT(DISTINCT c.id)::INTEGER AS clients_count,
          COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END)::INTEGER AS active_clients,
          COUNT(DISTINCT CASE WHEN c.status = 'blocked' THEN c.id END)::INTEGER AS blocked_clients,
          COUNT(DISTINCT CASE WHEN c.plan = 'teste' THEN c.id END)::INTEGER AS test_clients,
          COUNT(DISTINCT CASE WHEN c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN c.id END)::INTEGER AS expired_clients,
          COALESCE(SUM(s.sale_value),0)::NUMERIC AS vendas,
          COALESCE(SUM(s.commission),0)::NUMERIC AS comissoes,
          COALESCE(SUM(s.profit),0)::NUMERIC AS lucro
        FROM users r
        LEFT JOIN users c
          ON c.reseller_parent_id = r.id
          AND c.role = 'client'
        LEFT JOIN reseller_sales s
          ON s.reseller_id = r.id
        WHERE r.role = 'reseller'
        GROUP BY r.id
        ORDER BY lucro DESC
        `
      ),
      pool.query(
        `
        SELECT
          DATE_TRUNC('month', created_at) AS mes,
          COALESCE(SUM(sale_value),0)::NUMERIC AS vendas,
          COALESCE(SUM(commission),0)::NUMERIC AS comissoes,
          COALESCE(SUM(profit),0)::NUMERIC AS lucro,
          COUNT(*)::INTEGER AS total_vendas
        FROM reseller_sales
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY mes DESC
        LIMIT 12
        `
      ),
      pool.query(
        `
        SELECT
          h.*,
          u.name AS reseller_name
        FROM reseller_credit_history h
        LEFT JOIN users u ON u.id = h.reseller_id
        ORDER BY h.id DESC
        LIMIT 100
        `
      ),
      pool.query(
        `
        SELECT
          r.id,
          r.name,
          r.email,
          COALESCE(SUM(s.sale_value),0)::NUMERIC AS vendas_mes,
          COALESCE(SUM(s.profit),0)::NUMERIC AS lucro_mes,
          COUNT(s.id)::INTEGER AS vendas_count
        FROM users r
        LEFT JOIN reseller_sales s
          ON s.reseller_id = r.id
          AND DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', NOW())
        WHERE r.role = 'reseller'
        GROUP BY r.id
        ORDER BY lucro_mes DESC
        LIMIT 10
        `
      ),
      pool.query(
        `
        SELECT
          COALESCE(SUM(sale_value),0)::NUMERIC AS vendas_hoje,
          COALESCE(SUM(profit),0)::NUMERIC AS lucro_hoje,
          COUNT(*)::INTEGER AS total_hoje
        FROM reseller_sales
        WHERE created_at::DATE = NOW()::DATE
        `
      ),
      pool.query(
        `
        SELECT COUNT(*)::INTEGER AS total_testes
        FROM users
        WHERE role = 'client'
          AND plan = 'teste'
      `)
    ])

    const totals = summaryResult.rows.reduce(
      (acc, item) => {
        acc.vendas += Number(item.vendas || 0)
        acc.comissoes += Number(item.comissoes || 0)
        acc.lucro += Number(item.lucro || 0)
        acc.clients += Number(item.clients_count || 0)
        acc.active += Number(item.active_clients || 0)
        acc.blocked += Number(item.blocked_clients || 0)
        acc.expired += Number(item.expired_clients || 0)
        acc.tests += Number(item.test_clients || 0)
        return acc
      },
      {
        vendas: 0,
        comissoes: 0,
        lucro: 0,
        clients: 0,
        active: 0,
        blocked: 0,
        expired: 0,
        tests: 0
      }
    )

    res.json({
      totals,
      today: todayResult.rows[0] || {},
      tests: testsResult.rows[0] || {},
      resellers: summaryResult.rows,
      topMonth: topMonthResult.rows,
      monthly: monthResult.rows,
      creditHistory: creditResult.rows
    })
  } catch (err) {
    console.log('ERRO REPORTS RESELLERS:', err)
    res.status(500).json({
      error: 'erro ao carregar relatórios'
    })
  }
})


app.get('/stream-check', async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({
        error: 'url obrigatória'
      })
    }

    const streamUrl = decodeURIComponent(String(url))

    const response = await fetch(streamUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        Accept: '*/*',
        Range: 'bytes=0-1',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'
      }
    })

    res.json({
      ok: response.ok || response.status === 206,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      contentLength: response.headers.get('content-length') || '',
      acceptRanges: response.headers.get('accept-ranges') || ''
    })
  } catch (err) {
    res.status(500).json({
      error: err.message
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

    const range = req.headers.range

    const requestHeaders = {
      Accept: '*/*',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: streamUrl,
      Origin: new URL(streamUrl).origin,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'
    }

    if (range) {
      requestHeaders.Range = range
    }

    const response = await fetch(streamUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: requestHeaders
    })

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).send(`stream erro ${response.status}`)
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Accept-Ranges', 'bytes')

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

    const contentLength = response.headers.get('content-length')
    const contentRange = response.headers.get('content-range')

    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }

    if (contentRange) {
      res.setHeader('Content-Range', contentRange)
    }

    let finalContentType = contentType

    if (!finalContentType) {
      if (lowerUrl.includes('.mp4')) {
        finalContentType = 'video/mp4'
      } else if (lowerUrl.includes('.m3u8')) {
        finalContentType = 'application/vnd.apple.mpegurl'
      } else if (lowerUrl.includes('.ts') || lowerUrl.includes('mpegts')) {
        finalContentType = 'video/mp2t'
      } else if (lowerUrl.includes('.mkv')) {
        finalContentType = 'video/x-matroska'
      } else {
        finalContentType = 'application/octet-stream'
      }
    }

    res.setHeader('Content-Type', finalContentType)

    if (response.status === 206 || range) {
      res.status(206)
    } else {
      res.status(200)
    }

    if (!response.body) {
      return res.status(500).send('stream sem corpo')
    }

    const nodeStream = Readable.fromWeb(response.body)

    nodeStream.on('error', err => {
      console.log('PROXY PIPE ERROR:', err.message)

      if (!res.headersSent) {
        res.status(500).send('erro proxy stream')
      } else {
        res.destroy(err)
      }
    })

    return nodeStream.pipe(res)
  } catch (err) {
    console.log('PROXY STREAM ERROR:', err.message)

    if (!res.headersSent) {
      res.status(500).send('erro proxy stream')
    }
  }
})


async function getXtreamUser(username = '', password = '') {
  const result = await pool.query(
    `
    SELECT id, name, email, password, role, status, plan, max_connections, expires_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
      AND password = $2
      AND role = 'client'
    LIMIT 1
    `,
    [
      String(username || '').trim(),
      String(password || '').trim()
    ]
  )

  if (result.rows.length === 0) {
    return null
  }

  const user = result.rows[0]

  if (String(user.status || '').trim() !== 'active') {
    return null
  }

  if (user.expires_at && new Date(user.expires_at).getTime() < Date.now()) {
    return null
  }

  return user
}

function getPublicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https'
  const host = req.headers['x-forwarded-host'] || req.get('host')

  return `${proto}://${host}`
}

function getXtreamCategoryId(category = 'TV') {
  const text = String(category || 'TV')
  let hash = 0

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }

  return String(Math.abs(hash) || 1)
}

function getXtreamCategoryName(category = '') {
  const name = String(category || '').trim()

  if (!name) return 'TV'

  if (/^\d+$/.test(name)) {
    return `Categoria ${name}`
  }

  if (/^categoria\s+\d+$/i.test(name)) {
    return name.replace(/^categoria/i, 'Categoria')
  }

  return name
}

function detectLiveGroupByName(name = '', category = '') {
  const text = normalizeText(`${name} ${category}`)

  if (text.includes('globo')) return 'Globo'
  if (text.includes('sbt')) return 'SBT'
  if (text.includes('record')) return 'Record'
  if (text.includes('band')) return 'Band'
  if (text.includes('redetv') || text.includes('rede tv')) return 'RedeTV'
  if (text.includes('premiere') || text.includes('sportv') || text.includes('espn') || text.includes('fox sports') || text.includes('ufc')) return 'Esportes'
  if (text.includes('cartoon') || text.includes('disney') || text.includes('nick') || text.includes('kids') || text.includes('infantil')) return 'Infantil'
  if (text.includes('cnn') || text.includes('news') || text.includes('jovem pan') || text.includes('bandnews') || text.includes('noticia')) return 'Notícias'
  if (text.includes('discovery') || text.includes('history') || text.includes('nat geo') || text.includes('animal planet') || text.includes('documentario')) return 'Documentários'
  if (text.includes('hbo') || text.includes('telecine') || text.includes('megapix') || text.includes('cinema') || text.includes('filme')) return 'Filmes e Séries'
  if (text.includes('music') || text.includes('mtv') || text.includes('multishow')) return 'Música'
  if (text.includes('24h') || text.includes('24 h') || text.includes('[24h]')) return '24 Horas'

  return getXtreamCategoryName(category || 'Outros')
}


function getMovieExtension(video = '') {
  const lower = String(video || '').toLowerCase()

  if (lower.includes('.mkv')) return 'mkv'
  if (lower.includes('.avi')) return 'avi'
  if (lower.includes('.mov')) return 'mov'
  if (lower.includes('.m3u8')) return 'm3u8'
  if (lower.includes('.ts')) return 'ts'

  return 'mp4'
}

function cleanXtreamSeriesName(title = '') {
  return String(title || '')
    .replace(/S\d{1,2}E\d{1,3}/gi, '')
    .replace(/S\d{1,2}\sE\d{1,3}/gi, '')
    .replace(/TEMPORADA\s?\d+/gi, '')
    .replace(/EPISODIO\s?\d+/gi, '')
    .replace(/EPISÓDIO\s?\d+/gi, '')
    .replace(/EP\s?\d+/gi, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[\d{4}\]/g, '')
    .replace(/\s+-\s+.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getXtreamSeason(title = '') {
  const match =
    String(title || '').match(/S(\d{1,2})E\d{1,3}/i) ||
    String(title || '').match(/TEMPORADA\s?(\d{1,2})/i)

  return match ? Number(match[1]) : 1
}

function getXtreamEpisode(title = '') {
  const match =
    String(title || '').match(/S\d{1,2}E(\d{1,3})/i) ||
    String(title || '').match(/EPISODIO\s?(\d{1,3})/i) ||
    String(title || '').match(/EPISÓDIO\s?(\d{1,3})/i) ||
    String(title || '').match(/EP\s?(\d{1,3})/i)

  return match ? Number(match[1]) : 1
}

app.get('/player_api.php', async (req, res) => {
  try {
    const username = req.query.username || ''
    const password = req.query.password || ''
    const action = req.query.action || ''

    const user = await getXtreamUser(username, password)

    if (!user) {
      return res.json({
        user_info: {
          auth: 0,
          status: 'Disabled'
        },
        server_info: {}
      })
    }

    const baseUrl = getPublicBaseUrl(req)
    const now = Math.floor(Date.now() / 1000)
    const expDate = user.expires_at
      ? Math.floor(new Date(user.expires_at).getTime() / 1000)
      : null

    if (!action) {
      return res.json({
        user_info: {
          username: user.email,
          password: user.password,
          message: 'Nexora TV',
          auth: 1,
          status: 'Active',
          exp_date: expDate,
          is_trial: user.plan === 'teste' ? '1' : '0',
          active_cons: 0,
          created_at: now,
          max_connections: String(user.max_connections || 1),
          allowed_output_formats: ['m3u8', 'ts', 'mp4']
        },
        server_info: {
          url: req.get('host'),
          port: '443',
          https_port: '443',
          server_protocol: 'https',
          rtmp_port: '0',
          timezone: 'America/Sao_Paulo',
          timestamp_now: now,
          time_now: new Date().toISOString()
        }
      })
    }

    if (action === 'get_live_categories') {
      const result = await pool.query(`
        SELECT name, category
        FROM channels
        WHERE is_online = true
        ORDER BY name ASC
        LIMIT 5000
      `)

      const groups = new Map()

      for (const row of result.rows) {
        const groupName = detectLiveGroupByName(row.name, row.category)
        const groupId = getXtreamCategoryId(groupName)

        if (!groups.has(groupId)) {
          groups.set(groupId, {
            category_id: groupId,
            category_name: groupName,
            parent_id: 0
          })
        }
      }

      return res.json(Array.from(groups.values()).sort((a, b) =>
        String(a.category_name).localeCompare(String(b.category_name))
      ))
    }

    if (action === 'get_vod_categories') {
      return res.json([
        {
          category_id: '1',
          category_name: 'Filmes',
          parent_id: 0
        }
      ])
    }

    if (action === 'get_series_categories') {
      return res.json([
        {
          category_id: '2',
          category_name: 'Séries',
          parent_id: 0
        }
      ])
    }

    if (action === 'get_live_streams') {
      const result = await pool.query(`
        SELECT id, name, url, category, logo
        FROM channels
        WHERE is_online = true
        ORDER BY name ASC
        LIMIT 5000
      `)

      return res.json(result.rows.map((item, index) => ({
        num: index + 1,
        name: item.name || 'Canal',
        stream_type: 'live',
        stream_id: item.id,
        stream_icon: item.logo || '',
        epg_channel_id: '',
        added: String(now),
        category_id: getXtreamCategoryId(detectLiveGroupByName(item.name, item.category)),
        custom_sid: '',
        tv_archive: 0,
        direct_source: `${baseUrl}/live/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.m3u8}`,
        tv_archive_duration: 0
      })))
    }

    if (action === 'get_vod_streams') {
      const result = await pool.query(`
        SELECT id, title, year, image, video, description
        FROM movies
        WHERE
          LOWER(COALESCE(category, '')) NOT LIKE '%series%'
          AND LOWER(COALESCE(category, '')) NOT LIKE '%séries%'
          AND LOWER(COALESCE(video, '')) NOT LIKE '%/series/%'
        ORDER BY title ASC
        LIMIT 5000
      `)

      return res.json(result.rows.map((item, index) => ({
        num: index + 1,
        name: item.title || 'Filme',
        title: item.title || 'Filme',
        year: item.year || '',
        stream_type: 'movie',
        stream_id: item.id,
        stream_icon: item.image || '',
        rating: '',
        rating_5based: 0,
        added: String(now),
        category_id: '1',
        container_extension: getMovieExtension(item.video),
        custom_sid: '',
        direct_source: `${baseUrl}/movie/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.${getMovieExtension(item.video)}`
      })))
    }

    if (action === 'get_series') {
      const result = await pool.query(`
        SELECT id, title, year, image, video, description
        FROM movies
        WHERE
          category = 'Series'
          OR LOWER(COALESCE(video, '')) LIKE '%/series/%'
          OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
          OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
          OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
          OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
        ORDER BY title ASC
        LIMIT 5000
      `)

      const grouped = new Map()

      for (const item of result.rows) {
        const name = cleanXtreamSeriesName(item.title) || item.title || 'Série'

        if (!grouped.has(name)) {
          grouped.set(name, {
            num: grouped.size + 1,
            name,
            title: name,
            year: item.year || '',
            series_id: item.id,
            cover: item.image || '',
            plot: item.description || '',
            cast: '',
            director: '',
            genre: 'Séries',
            releaseDate: '',
            last_modified: String(now),
            rating: '',
            rating_5based: 0,
            backdrop_path: [],
            youtube_trailer: '',
            episode_run_time: '',
            category_id: '2'
          })
        }
      }

      return res.json(Array.from(grouped.values()))
    }

    if (action === 'get_vod_info') {
      const vodId = Number(req.query.vod_id || req.query.movie_id || 0)

      const result = await pool.query(
        `
        SELECT id, title, year, image, banner, video, description
        FROM movies
        WHERE id = $1
        LIMIT 1
        `,
        [vodId]
      )

      const item = result.rows[0]

      if (!item) return res.json({ info: {}, movie_data: {} })

      return res.json({
        info: {
          movie_image: item.image || '',
          backdrop_path: item.banner ? [item.banner] : [],
          plot: item.description || '',
          genre: 'Filmes',
          rating: '',
          releasedate: item.year || ''
        },
        movie_data: {
          stream_id: item.id,
          name: item.title || 'Filme',
          title: item.title || 'Filme',
          year: item.year || '',
          added: String(now),
          category_id: '1',
          container_extension: getMovieExtension(item.video),
          custom_sid: '',
          direct_source: `${baseUrl}/movie/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.${getMovieExtension(item.video)}`
        }
      })
    }

    if (action === 'get_series_info') {
      const seriesId = Number(req.query.series_id || 0)

      const baseResult = await pool.query(
        `
        SELECT title
        FROM movies
        WHERE id = $1
        LIMIT 1
        `,
        [seriesId]
      )

      if (baseResult.rows.length === 0) {
        return res.json({ info: {}, episodes: {} })
      }

      const baseTitle = cleanXtreamSeriesName(baseResult.rows[0].title)

      const result = await pool.query(
        `
        SELECT id, title, year, image, banner, video, description
        FROM movies
        WHERE
          category = 'Series'
          OR LOWER(COALESCE(video, '')) LIKE '%/series/%'
          OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
          OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
          OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
          OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
        ORDER BY title ASC
        LIMIT 5000
        `
      )

      const episodes = {}
      let cover = ''

      for (const item of result.rows) {
        const name = cleanXtreamSeriesName(item.title)

        if (normalizeText(name) !== normalizeText(baseTitle)) continue

        const season = getXtreamSeason(item.title)
        const episodeNum = getXtreamEpisode(item.title)

        if (!episodes[season]) episodes[season] = []

        if (!cover && item.image) cover = item.image

        episodes[season].push({
          id: item.id,
          episode_num: episodeNum,
          title: item.title,
          container_extension: getMovieExtension(item.video),
          info: {
            movie_image: item.image || '',
            plot: item.description || ''
          },
          custom_sid: '',
          added: String(now),
          season,
          direct_source: `${baseUrl}/series/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.${getMovieExtension(item.video)}`
        })
      }

      return res.json({
        info: {
          name: baseTitle,
          title: baseTitle,
          cover,
          plot: '',
          cast: '',
          director: '',
          genre: 'Séries',
          releaseDate: '',
          rating: ''
        },
        episodes
      })
    }

    return res.json([])
  } catch (err) {
    console.log('ERRO PLAYER API:', err)

    res.status(500).json({
      error: 'erro player api'
    })
  }
})

async function streamStoredContent(req, res, type) {
  try {
    const username = decodeURIComponent(req.params.username || '')
    const password = decodeURIComponent(req.params.password || '')
    const id = Number(req.params.id || 0)

    const user = await getXtreamUser(username, password)

    if (!user) {
      return res.status(401).send('login inválido')
    }

    let query = ''

    if (type === 'live') {
      query = 'SELECT url AS video FROM channels WHERE id = $1 LIMIT 1'
    } else {
      query = 'SELECT video FROM movies WHERE id = $1 LIMIT 1'
    }

    const result = await pool.query(query, [id])

    if (result.rows.length === 0 || !result.rows[0].video) {
      return res.status(404).send('conteúdo não encontrado')
    }

    const streamUrl = result.rows[0].video

    // Compatibilidade Xtream externa:
    // XCIPTV, Smarters e apps parecidos funcionam melhor recebendo redirect direto.
    // O APK Nexora e o painel web continuam usando suas rotas próprias, sem alteração.
    return res.redirect(streamUrl)
  } catch (err) {
    console.log('ERRO STREAM CONTENT:', err)
    res.status(500).send('erro stream')
  }
}

app.get('/live/:username/:password/:id.m3u8', async (req, res) => {
  return streamStoredContent(req, res, 'live')
})

app.get('/live/:username/:password/:id.ts', async (req, res) => {
  return streamStoredContent(req, res, 'live')
})

app.get('/movie/:username/:password/:id.:ext', async (req, res) => {
  return streamStoredContent(req, res, 'movie')
})

app.get('/series/:username/:password/:id.:ext', async (req, res) => {
  return streamStoredContent(req, res, 'series')
})

app.get('/get.php', async (req, res) => {
  try {
    const username = req.query.username || ''
    const password = req.query.password || ''
    const type = req.query.type || 'm3u_plus'
    const output = req.query.output || 'm3u8'

    const user = await getXtreamUser(username, password)

    if (!user) {
      return res.status(401).send('login inválido')
    }

    const baseUrl = getPublicBaseUrl(req)
    const lines = ['#EXTM3U']

    const channels = await pool.query(`
      SELECT id, name, category, logo
      FROM channels
      WHERE is_online = true
      ORDER BY name ASC
      LIMIT 5000
    `)

    for (const item of channels.rows) {
      lines.push(`#EXTINF:-1 tvg-id="" tvg-name="${item.name}" tvg-logo="${item.logo || ''}" group-title="${detectLiveGroupByName(item.name, item.category)}",${item.name}`)
      lines.push(`${baseUrl}/live/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.${output === 'ts' ? 'ts' : 'm3u8'}`)
    }

    const movies = await pool.query(`
      SELECT id, title, image, video
      FROM movies
      WHERE
        LOWER(COALESCE(category, '')) NOT LIKE '%series%'
        AND LOWER(COALESCE(category, '')) NOT LIKE '%séries%'
        AND LOWER(COALESCE(video, '')) NOT LIKE '%/series/%'
      ORDER BY title ASC
      LIMIT 5000
    `)

    for (const item of movies.rows) {
      lines.push(`#EXTINF:-1 tvg-id="" tvg-name="${item.title}" tvg-logo="${item.image || ''}" group-title="Filmes",${item.title}`)
      lines.push(`${baseUrl}/movie/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.${getMovieExtension(item.video)}`)
    }

    const series = await pool.query(`
      SELECT id, title, image, video
      FROM movies
      WHERE
        category = 'Series'
        OR LOWER(COALESCE(video, '')) LIKE '%/series/%'
        OR LOWER(COALESCE(title, '')) LIKE '%temporada%'
        OR LOWER(COALESCE(title, '')) LIKE '%episodio%'
        OR LOWER(COALESCE(title, '')) LIKE '%episódio%'
        OR LOWER(COALESCE(title, '')) ~ 's[0-9]{1,2}e[0-9]{1,3}'
      ORDER BY title ASC
      LIMIT 5000
    `)

    for (const item of series.rows) {
      lines.push(`#EXTINF:-1 tvg-id="" tvg-name="${item.title}" tvg-logo="${item.image || ''}" group-title="Séries",${item.title}`)
      lines.push(`${baseUrl}/series/${encodeURIComponent(user.email)}/${encodeURIComponent(user.password)}/${item.id}.${getMovieExtension(item.video)}`)
    }

    res.setHeader('Content-Type', type === 'm3u_plus' ? 'audio/x-mpegurl' : 'text/plain')
    return res.send(lines.join('\n'))
  } catch (err) {
    console.log('ERRO GET PHP:', err)
    res.status(500).send('erro m3u')
  }
})


app.get('/', (req, res) => {
  res.send('IPTV SERVER ONLINE')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER ON ${PORT}`)
})