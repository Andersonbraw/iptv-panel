import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import dotenv from 'dotenv'
import { XMLParser } from 'fast-xml-parser'

dotenv.config()

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'd7d6f05500f868564751a589e219be96'

async function fetchTMDBPoster(title) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(title)}`
    )

    const data = await response.json()

    if (!data.results || data.results.length === 0) return null

    const movie = data.results[0]

    return {
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      banner: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '',
      overview: movie.overview || '',
      year: movie.release_date ? movie.release_date.substring(0, 4) : ''
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
const EPG_URL = 'https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master/PlutoTV/br.xml'

app.use(cors({
  origin: '*'
}))
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

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`)

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

function auth(req, res, next) {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({ error: 'token inválido' })
  }

  const token = header.replace('Bearer ', '')

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'token inválido' })
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'somente admin' })
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

function parseM3U(text) {
  const lines = text.split('\n')
  const channels = []
  let current = null

  for (let line of lines) {
    line = line.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF')) {
      const nameMatch = line.match(/,(.*)$/)
      const logoMatch = line.match(/tvg-logo="([^"]*)"/)
      const groupMatch = line.match(/group-title="([^"]*)"/)

      current = {
        name: nameMatch ? nameMatch[1].trim() : 'Canal IPTV',
        logo: logoMatch ? logoMatch[1].trim() : '',
        category: groupMatch ? groupMatch[1].trim() : 'Outros'
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
  const fixedUrl = normalizeGithubUrl(playlistUrl)

  const response = await fetch(fixedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 IPTV PANEL'
    }
  })

  if (!response.ok) throw new Error('Erro ao baixar lista')

  const text = await response.text()

  if (!text.includes('#EXTINF')) throw new Error('M3U inválida')

  return parseM3U(text)
}

async function saveChannels(channels) {
  let added = 0

  for (const channel of channels) {
    try {
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
  const title = (movie.title || '').toLowerCase()
  const category = (movie.category || '').toLowerCase()
  const image = (movie.image || '').toLowerCase()
  const video = (movie.video || '').toLowerCase()

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
    'channel',
    'canal',
    'news',
    'sport',
    'sports',
    'music',
    'radio',
    'live',
    'ao vivo',
    '24/7',
    'camera',
    'webcam',
    'xxx',
    'adult',
    'porn'
  ]

  const blockedWords = [
'cine',
'cinema',
'vision',
'drama',
'novela',
'documentary',
'documentario',
'telecine',
'paramount',
'rakuten',
'pluto',
'runtime',
'freecine',
'record tv',
'tv record',
'world tv',
'canal tv',
'vision tv',
'crime tv',
'music tv',
'news tv',
'prime tv',
'family tv',
'kids tv',
'fashion tv',
'travel tv',
'comedy tv',
'series tv',
'movie tv',
'filmes tv',
'series premium',
'filmes premium',
'epg',
'vod',
'vod tv',
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
    category.includes('live')

  const badVideo =
    !video ||
    video.includes('udp://') ||
    video.includes('rtmp://')

  return (
    badExact ||
    badTitle ||
    blockedLanguage ||
    badImage ||
    badCategory ||
    badVideo
  )
}

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

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
      VALUES ($1,$2,$3,'client','active','free',1)
      `,
      [
        name,
        email,
        password
      ]
    )

    res.json({ success: true })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro ao criar conta' })
  }
})

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE email = $1
      `,
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'login inválido' })
    }

    const user = result.rows[0]

    if (user.password !== password) {
      return res.status(401).json({ error: 'senha inválida' })
    }

    if (user.status && user.status !== 'active') {
      return res.status(403).json({ error: 'conta bloqueada' })
    }

    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(403).json({ error: 'login expirado' })
    }

    const token = jwt.sign(
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
    res.status(500).json({ error: 'erro login' })
  }
})

app.get('/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
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
      ORDER BY id DESC
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
    const { role, status, plan, max_connections, expires_at, credits } = req.body
    const { id } = req.params

    const result = await pool.query(
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

    res.json(result.rows[0])
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro ao atualizar usuário' })
  }
})

app.patch('/admin/users/:id/add-30-days', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
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
    res.status(500).json({ error: 'erro ao adicionar 30 dias' })
  }
})

app.get('/admin/credits', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
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
    res.status(500).json({ error: 'erro ao buscar créditos' })
  }
})

app.post('/admin/credits/add', auth, adminOnly, async (req, res) => {
  try {
    const { amount } = req.body

    const value = Number(amount || 0)

    if (value <= 0) {
      return res.status(400).json({ error: 'quantidade inválida' })
    }

    const result = await pool.query(
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
    res.status(500).json({ error: 'erro ao adicionar créditos' })
  }
})

app.post('/admin/users/create-random', auth, adminOnly, async (req, res) => {
  try {
    const admin = await pool.query(
      `
      SELECT credits
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    )

    const credits = Number(admin.rows[0]?.credits || 0)

    if (credits <= 0) {
      return res.status(400).json({
        error: 'sem créditos disponíveis'
      })
    }

    const login = generateRandomLogin(
      req.body.name
    )

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
      error: err.message || 'erro ao criar login aleatório'
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
    const result = await pool.query(
      `
      SELECT *
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

    const user = result.rows[0]

    console.log('VALIDANDO USUARIO:')
    console.log(user.email)
    console.log('STATUS:', user.status)
    console.log('EXPIRES:', user.expires_at)

    if (String(user.status).trim() !== 'active') {
      return res.status(403).json({
        error: 'usuario bloqueado'
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

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      plan: user.plan,
      max_connections: user.max_connections,
      expires_at: user.expires_at,
      credits: user.credits
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: 'erro usuario'
    })
  }
})

app.get('/channels', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM channels
      ORDER BY name ASC
    `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro canais' })
  }
})

app.post('/channels', auth, async (req, res) => {
  try {
    const { name, url, category, logo } = req.body

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

    res.json({ success: true })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro ao adicionar canal' })
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

    res.json({ success: true })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro ao remover canal' })
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
app.post('/import-m3u', auth, async (req, res) => {
  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ error: 'url obrigatória' })
    }

    const channels = await importM3UFromUrl(url)
    const added = await saveChannels(channels)

    res.json({
      success: true,
      encontrados: channels.length,
      adicionados: added
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro ao importar M3U' })
  }
})

app.get('/movies', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM movies
      ORDER BY id DESC
    `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro filmes' })
  }
})

app.post('/movies', auth, adminOnly, async (req, res) => {
  try {
    const { title, year, category, image, banner, video, description } = req.body

    if (!title || !video) {
      return res.status(400).json({ error: 'titulo e video obrigatorios' })
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

    res.json({ success: true })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro criar filme' })
  }
})

app.post('/movies/import-m3u', auth, adminOnly, async (req, res) => {
  try {
    const { url, type } = req.body

    if (!url) {
      return res.status(400).json({ error: 'url obrigatória' })
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 IPTV PANEL'
      }
    })

    if (!response.ok) {
      return res.status(400).json({ error: 'nao foi possivel abrir lista' })
    }

    const text = await response.text()

    if (!text.includes('#EXTINF')) {
      return res.status(400).json({ error: 'm3u invalida' })
    }

    const lines = text.split('\n')

    let current = null
    let added = 0
    let skipped = 0

    for (const lineRaw of lines) {
      const line = lineRaw.trim()

      if (!line) continue

      if (line.startsWith('#EXTINF')) {
        const titleMatch = line.match(/,(.*)$/)
        const logoMatch = line.match(/tvg-logo="([^"]*)"/)
        const groupMatch = line.match(/group-title="([^"]*)"/)

        let title = titleMatch ? titleMatch[1].trim() : 'VOD'

        title = cleanTitle(title)

        const group = groupMatch ? groupMatch[1].toLowerCase() : ''

        const isSeries =
          type === 'Series' ||
          /s\d{1,2}e\d{1,2}/i.test(title) ||
          group.includes('series') ||
          group.includes('séries')

        const isMovie =
          type === 'Filmes' ||
          group.includes('movie') ||
          group.includes('movies') ||
          group.includes('filme') ||
          group.includes('filmes') ||
          group.includes('vod')

        const fakeMovie = {
          title,
          category: isSeries ? 'Series' : 'Filmes',
          image: logoMatch ? logoMatch[1] : '',
          video: ''
        }

        if (!isMovie && !isSeries) {
          current = null
          skipped++
          continue
        }

        const tmdb = await fetchTMDBPoster(title)

        current = {
          title,
          image: tmdb?.poster || (logoMatch ? logoMatch[1] : ''),
          banner: tmdb?.banner || (logoMatch ? logoMatch[1] : ''),
          description: tmdb?.overview || 'Importado IPTV',
          year: tmdb?.year || '',
          category: isSeries ? 'Series' : 'Filmes'
        }

        continue
      }

      if (current && line.startsWith('http')) {
        try {
          const exists = await pool.query(
            `
            SELECT id
            FROM movies
            WHERE video = $1
            OR LOWER(title) = LOWER($2)
            LIMIT 1
            `,
            [
              line,
              current.title
            ]
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
              current.year,
              current.category,
              current.image,
              current.banner,
              line,
              current.description
            ]
          )

          added++
        } catch (err) {
          skipped++
          console.log(err.message)
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
    res.status(500).json({ error: 'erro importar filmes' })
  }
})

app.delete('/movies/clean-bad', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM movies
      ORDER BY id ASC
    `)

    const movies = result.rows
    const idsToDelete = []
    const seenTitles = new Set()

    for (const movie of movies) {
      const titleKey = (movie.title || '').toLowerCase().trim()
      const isDuplicate = seenTitles.has(titleKey)

      if (titleKey) {
        seenTitles.add(titleKey)
      }

      if (isDuplicate || isBadMovieItem(movie)) {
        idsToDelete.push(movie.id)
      }
    }

    if (idsToDelete.length > 0) {
      await pool.query(
        `
        DELETE FROM movies
        WHERE id = ANY($1::int[])
        `,
        [idsToDelete]
      )
    }

    res.json({
      success: true,
      removed: idsToDelete.length,
      total: movies.length
    })
  } catch (err) {
    console.log('ERRO CLEAN BAD:', err)
    res.status(500).json({ error: 'erro ao limpar lixo' })
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

    res.json({ success: true })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro remover filme' })
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
    res.status(500).json({ error: 'erro ao limpar filmes' })
  }
})

app.get('/series', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM movies
      WHERE category = 'Series'
      ORDER BY id DESC
    `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'erro series' })
  }
})

app.get('/', (req, res) => {
  res.send('IPTV SERVER ONLINE')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER ON ${PORT}`)
})