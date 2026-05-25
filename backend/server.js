import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import dotenv from 'dotenv'
import { XMLParser } from 'fast-xml-parser'

dotenv.config()

const { Pool } = pg

const app = express()
const PORT = 3000
const JWT_SECRET = 'iptv_panel_secret_2026'
const EPG_URL = 'https://iptv-org.github.io/epg/guides/br/br.xml'

app.use(cors())
app.use(express.json({ limit: '50mb' }))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

const DEFAULT_GITHUB_SOURCES = [
  {
    name: 'IPTV Org Brasil',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u'
  },
  
]

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      name TEXT,
      url TEXT UNIQUE,
      category TEXT,
      logo TEXT,
      is_online BOOLEAN DEFAULT TRUE,
      offline_count INTEGER DEFAULT 0,
      last_checked TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS logo TEXT`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS offline_count INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 50`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS fail_count INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`)

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'channels_url_unique'
      ) THEN
        ALTER TABLE channels ADD CONSTRAINT channels_url_unique UNIQUE (url);
      END IF;
    END
    $$;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      name TEXT,
      avatar TEXT,
      color TEXT,
      is_kids BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      profile_id INTEGER,
      channel_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE favorites ADD COLUMN IF NOT EXISTS user_id INTEGER`)
  await pool.query(`ALTER TABLE favorites ADD COLUMN IF NOT EXISTS profile_id INTEGER`)
  await pool.query(`ALTER TABLE favorites ADD COLUMN IF NOT EXISTS channel_id INTEGER`)
  await pool.query(`ALTER TABLE favorites ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`)

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorites_profile_channel_unique'
      ) THEN
        ALTER TABLE favorites ADD CONSTRAINT favorites_profile_channel_unique UNIQUE (profile_id, channel_id);
      END IF;
    END
    $$;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      profile_id INTEGER,
      channel_id INTEGER,
      progress INTEGER DEFAULT 0,
      watched_seconds INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS user_id INTEGER`)
  await pool.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS profile_id INTEGER`)
  await pool.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS channel_id INTEGER`)
  await pool.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS watched_seconds INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`)

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'history_profile_channel_unique'
      ) THEN
        ALTER TABLE watch_history ADD CONSTRAINT history_profile_channel_unique UNIQUE (profile_id, channel_id);
      END IF;
    END
    $$;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS m3u_sources (
      id SERIAL PRIMARY KEY,
      name TEXT,
      url TEXT UNIQUE,
      active BOOLEAN DEFAULT TRUE,
      source_type TEXT DEFAULT 'manual',
      last_import TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE m3u_sources ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual'`)
  await pool.query(`ALTER TABLE m3u_sources ADD COLUMN IF NOT EXISTS last_import TIMESTAMP`)

  for (const source of DEFAULT_GITHUB_SOURCES) {
    await pool.query(
      `
      INSERT INTO m3u_sources (name, url, active, source_type)
      VALUES ($1,$2,true,'github_auto')
      ON CONFLICT (url)
      DO UPDATE SET active = true, source_type = 'github_auto'
      `,
      [source.name, source.url]
    )
  }
  
  await pool.query(`
  CREATE TABLE IF NOT EXISTS channel_streams (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    name TEXT,
    url TEXT UNIQUE,
    source TEXT,
    quality TEXT DEFAULT 'AUTO',
    is_online BOOLEAN DEFAULT TRUE,
    health_score INTEGER DEFAULT 50,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )
`)

  console.log('BANCO OK')
}

initDb()

function auth(req, res, next) {
  const header = req.headers.authorization

  if (!header) return res.status(401).json({ error: 'token inválido' })

  const token = header.replace('Bearer ', '')

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'token inválido' })
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

const LOGO_MAP = {
  globo:
    'https://upload.wikimedia.org/wikipedia/commons/0/02/TV_Globo_logo.svg',

  sbt:
    'https://upload.wikimedia.org/wikipedia/commons/4/41/SBT_logo_2014.svg',

  record:
    'https://upload.wikimedia.org/wikipedia/commons/2/20/Record_logo_2016.svg',

  band:
    'https://upload.wikimedia.org/wikipedia/commons/2/2b/Rede_Bandeirantes_logo_2018.svg',

  redetv:
    'https://upload.wikimedia.org/wikipedia/commons/b/b1/RedeTV%21_logo_2015.svg',

  cultura:
    'https://upload.wikimedia.org/wikipedia/commons/8/82/TV_Cultura_logo_2013.svg',

  espn:
    'https://upload.wikimedia.org/wikipedia/commons/2/2f/ESPN_wordmark.svg',

  sportv:
    'https://upload.wikimedia.org/wikipedia/commons/5/5c/SporTV_2021.svg',

  premiere:
    'https://upload.wikimedia.org/wikipedia/commons/7/72/Premiere_FC_logo.png',

  cnn:
    'https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg'
}

function normalizeText(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function getSmartLogo(name = '', logo = '') {
  if (
    logo &&
    logo.startsWith('http') &&
    !logo.includes('undefined')
  ) {
    return logo
  }

  const clean = normalizeText(name)

  for (const key of Object.keys(LOGO_MAP)) {
    if (clean.includes(key)) {
      return LOGO_MAP[key]
    }
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'TV'
  )}&background=0284c7&color=ffffff&size=256&bold=true`
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

      const channelName = nameMatch ? nameMatch[1].trim() : 'Canal IPTV'

      current = {
        name: channelName,
        logo: getSmartLogo(channelName, logoMatch ? logoMatch[1].trim() : ''),
        category: groupMatch ? groupMatch[1].trim() : 'Outros'
      }

      continue
    }

    if (
      current &&
      line &&
      !line.startsWith('#') &&
      line.startsWith('http')
    ) {
      const lowerName = (current.name || '').toLowerCase()
      const lowerCategory = (current.category || '').toLowerCase()
      const lowerUrl = line.toLowerCase()

      const blocked =
        lowerName.includes('xxx') ||
        lowerName.includes('adult') ||
        lowerName.includes('porn') ||
        lowerName.includes('sex') ||
        lowerName.includes('radio') ||
        lowerName.includes('bet') ||
        lowerName.includes('casino') ||
        lowerCategory.includes('adult') ||
        lowerCategory.includes('radio') ||
        lowerUrl.includes('udp://') ||
        lowerUrl.includes('rtmp://')

      const allowed =
        lowerName.includes('globo') ||
        lowerName.includes('sbt') ||
        lowerName.includes('record') ||
        lowerName.includes('band') ||
        lowerName.includes('redetv') ||
        lowerName.includes('cultura') ||
        lowerName.includes('sportv') ||
        lowerName.includes('espn') ||
        lowerName.includes('premiere') ||
        lowerName.includes('discovery') ||
        lowerName.includes('hbo') ||
        lowerName.includes('telecine') ||
        lowerName.includes('max') ||
        lowerName.includes('warner') ||
        lowerName.includes('paramount') ||
        lowerName.includes('nick') ||
        lowerName.includes('cartoon') ||
        lowerName.includes('cnn') ||
        lowerName.includes('history') ||
        lowerName.includes('fox') ||
        lowerName.includes('universal') ||
        lowerName.includes('megapix') ||
        lowerCategory.includes('tv aberta') ||
        lowerCategory.includes('esportes') ||
        lowerCategory.includes('filmes')

      if (!blocked && allowed) {
        channels.push({
          ...current,
          url: line
        })
      }

      current = null
    }
  }

  return channels
}
async function importM3UFromUrl(playlistUrl) {
  const fixedUrl = normalizeGithubUrl(playlistUrl)

  const response = await fetch(fixedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 IPTV Panel'
    }
  })

  if (!response.ok) {
    throw new Error(`Erro ao baixar M3U: ${response.status}`)
  }

  const text = await response.text()

  if (!text.includes('#EXTINF')) {
    throw new Error('URL não é uma lista M3U válida')
  }

  return parseM3U(text)
}

async function testStream(url) {
  if (!url || !url.startsWith('http')) return false

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 IPTV Panel'
      },
      signal: AbortSignal.timeout(6000)
    })

    if (!response.ok) return false

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text().catch(() => '')

    // TESTE M3U8 REAL
    if (url.includes('.m3u8') || text.includes('#EXTM3U')) {

      if (
        !text.includes('#EXT-X-TARGETDURATION') &&
        !text.includes('#EXT-X-STREAM-INF') &&
        !text.includes('#EXTINF')
      ) {
        return false
      }

      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)

      const segment = lines.find(line =>
        !line.startsWith('#') &&
        (
          line.includes('.ts') ||
          line.includes('.m4s') ||
          line.includes('.m3u8')
        )
      )

      if (!segment) return false

      let segmentUrl = segment

      if (!segmentUrl.startsWith('http')) {
        const base = url.substring(0, url.lastIndexOf('/') + 1)
        segmentUrl = base + segmentUrl
      }

      try {
  const segmentResponse = await fetch(segmentUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 IPTV Panel',
      Range: 'bytes=0-2048'
    },
    signal: AbortSignal.timeout(8000)
  })

  if (segmentResponse.ok) {
    return true
  }
} catch (err) {
  console.log('SEGMENT TEST FAIL:', err.message)
}

// ACEITA PLAYLIST M3U8 VÁLIDA MESMO SE O SEGMENTO DEMORAR
return true
    }

    // TESTE VIDEO DIRETO
    if (
      contentType.includes('video') ||
      contentType.includes('octet-stream')
    ) {
      return true
    }

    return false

  } catch {
    return false
  }
}
function normalizeChannelName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(hd|fhd|sd|4k|1080p|720p|480p)\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

async function saveChannels(channels) {
  let saved = 0
  let updated = 0
  let rejected = 0
  let reserves = 0

  const uniqueMap = new Map()

  channels.forEach(channel => {
    if (
      channel.url &&
      channel.url.startsWith('http') &&
      !uniqueMap.has(channel.url)
    ) {
      uniqueMap.set(channel.url, channel)
    }
  })

  for (const channel of uniqueMap.values()) {
    try {
      const isWorking = await testStream(channel.url)

      if (!isWorking) {
        rejected++
        continue
      }

      const normalized = normalizeChannelName(channel.name || '')

      const allChannels = await pool.query(`
  SELECT *
  FROM channels
`)

const existingChannel = allChannels.rows.find(item => {
  return normalizeChannelName(item.name || '') === normalized
})

const existing = {
  rows: existingChannel ? [existingChannel] : []
}

      if (existing.rows.length > 0) {
        const mainChannel = existing.rows[0]

        await pool.query(
          `
          INSERT INTO channel_streams
          (channel_id, name, url, source, quality, is_online, health_score, success_count, last_checked)
          VALUES ($1,$2,$3,$4,$5,true,70,1,NOW())
          ON CONFLICT (url)
          DO UPDATE SET
            is_online = true,
            health_score = LEAST(100, channel_streams.health_score + 10),
            success_count = channel_streams.success_count + 1,
            last_checked = NOW()
          `,
          [
            mainChannel.id,
            channel.name || mainChannel.name,
            channel.url,
            channel.category || 'Fonte IPTV',
            detectQuality(channel.name || ''),
          ]
        )

        reserves++
        continue
      }

      const result = await pool.query(
        `
        INSERT INTO channels (name, url, category, logo, is_online, offline_count, last_checked, health_score, success_count, fail_count)
        VALUES ($1,$2,$3,$4,true,0,NOW(),70,1,0)
        ON CONFLICT (url)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          logo = EXCLUDED.logo,
          is_online = true,
          offline_count = 0,
          health_score = LEAST(100, channels.health_score + 10),
          success_count = channels.success_count + 1,
          last_checked = NOW()
        RETURNING xmax
        `,
        [
          channel.name || 'Canal IPTV',
          channel.url,
          channel.category || 'Outros',
          channel.logo || ''
        ]
      )

      if (result.rows[0].xmax === '0') saved++
      else updated++
    } catch (err) {
      rejected++
      console.log('ERRO AO TESTAR/SALVAR CANAL:', err.message)
    }
  }

  return {
    saved,
    updated,
    rejected,
    reserves,
    total: uniqueMap.size
  }
}

function detectQuality(name = '') {
  const text = name.toLowerCase()

  if (text.includes('4k')) return '4K'
  if (text.includes('fhd') || text.includes('1080')) return 'FHD'
  if (text.includes('hd') || text.includes('720')) return 'HD'
  if (text.includes('sd') || text.includes('480')) return 'SD'

  return 'AUTO'
}async function ensureProfiles(userId) {
  const result = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId]
  )

  if (result.rows.length > 0) return

  await pool.query(
    `
    INSERT INTO profiles (user_id, name, avatar, color, is_kids)
    VALUES
    ($1, 'Cinema', '🎬', '#ef4444', false),
    ($1, 'Esportes', '⚽', '#22c55e', false),
    ($1, 'Kids', '🧸', '#facc15', true),
    ($1, 'Gamer', '🎮', '#38bdf8', false)
    `,
    [userId]
  )
}

async function githubAutoDiscovery() {
  const discovered = []

  const iptvOrgStreams = [
    'br.m3u',
    'pt.m3u',
    'us.m3u',
    'uk.m3u',
    'int.m3u'
  ]

  for (const file of iptvOrgStreams) {
    discovered.push({
      name: `GitHub Auto ${file}`,
      url: `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/${file}`
    })
  }

  for (const source of discovered) {
    await pool.query(
      `
      INSERT INTO m3u_sources (name, url, active, source_type)
      VALUES ($1,$2,true,'github_auto')
      ON CONFLICT (url)
      DO UPDATE SET
        name = EXCLUDED.name,
        active = true,
        source_type = 'github_auto'
      `,
      [source.name, source.url]
    )
  }

  return discovered.length
}

async function importAllSources() {
  const sources = await pool.query(
    'SELECT * FROM m3u_sources WHERE active = true ORDER BY id DESC'
  )

  let totalFound = 0
  let totalSaved = 0
  let totalUpdated = 0
  let totalSources = sources.rows.length

  for (const source of sources.rows) {
    try {
      console.log('AUTO IMPORT:', source.url)

      const parsed = await importM3UFromUrl(source.url)

      totalFound += parsed.length

      const result = await saveChannels(parsed)

      totalSaved += result.saved
      totalUpdated += result.updated

      await pool.query(
        'UPDATE m3u_sources SET last_import = NOW() WHERE id = $1',
        [source.id]
      )
    } catch (err) {
      console.log('ERRO AUTO SOURCE:', err.message)
    }
  }

  return {
    sources: totalSources,
    found: totalFound,
    saved: totalSaved,
    updated: totalUpdated
  }
}

async function checkAndRemoveOffline() {
  const result = await pool.query(
    'SELECT * FROM channels ORDER BY last_checked NULLS FIRST, id DESC LIMIT 300'
  )

  let online = 0
  let offline = 0
  let removed = 0

  for (const channel of result.rows) {
    const ok = await testStream(channel.url)

    if (ok) {
      online++

      await pool.query(
        `
        UPDATE channels
        SET is_online = true, offline_count = 0, last_checked = NOW()
        WHERE id = $1
        `,
        [channel.id]
      )
    } else {
      offline++

      const offlineCount = Number(channel.offline_count || 0) + 1

      if (offlineCount >= 3) {
        await pool.query(
          'DELETE FROM channels WHERE id = $1',
          [channel.id]
        )

        removed++
      } else {
        await pool.query(
          `
          UPDATE channels
          SET is_online = false, offline_count = $1, last_checked = NOW()
          WHERE id = $2
          `,
          [offlineCount, channel.id]
        )
      }
    }
  }

  return { online, offline, removed }
}

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email e senha obrigatórios' })
    }

    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING id, name, email',
      [name || 'User', email, password]
    )

    await ensureProfiles(result.rows[0].id)

    res.json({ message: 'Conta criada com sucesso' })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'email já cadastrado' })
    }

    console.log('ERRO REGISTER:', err)
    res.status(500).json({ error: 'erro ao criar conta' })
  }
})

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email, password]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'login inválido' })
    }

    const user = result.rows[0]

    await ensureProfiles(user.id)

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })
  } catch (err) {
    console.log('ERRO LOGIN:', err)
    res.status(500).json({ error: 'erro no login' })
  }
})

app.get('/profiles', auth, async (req, res) => {
  try {
    await ensureProfiles(req.user.id)

    const result = await pool.query(
      'SELECT * FROM profiles WHERE user_id = $1 ORDER BY id ASC',
      [req.user.id]
    )

    res.json(result.rows)
  } catch (err) {
    console.log('ERRO PROFILES:', err)
    res.status(500).json({ error: 'erro ao buscar perfis' })
  }
})

app.get('/channels', auth, async (req, res) => {
  try {

    const limit = Math.min(Number(req.query.limit || 800), 1000)
    const offset = Number(req.query.offset || 0)
    const search = req.query.search || ''
    const category = req.query.category || ''

    let query = `
      SELECT
        c.*,
        COALESCE(s.reserve_count, 0) AS reserve_count
      FROM channels c
      LEFT JOIN (
        SELECT
          channel_id,
          COUNT(*) AS reserve_count
        FROM channel_streams
        WHERE is_online = true
        GROUP BY channel_id
      ) s ON s.channel_id = c.id
      WHERE 1=1
    `

    const params = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND c.name ILIKE $${params.length}`
    }

    if (category) {
      params.push(category)
      query += ` AND c.category = $${params.length}`
    }

    params.push(limit)

    query += `
      ORDER BY
        CASE
          WHEN c.category ILIKE '%TV Aberta%' THEN 1
          WHEN c.category ILIKE '%Esportes%' THEN 2
          WHEN c.category ILIKE '%Filmes%' THEN 3
          WHEN c.category ILIKE '%Infantil%' THEN 4
          WHEN c.category ILIKE '%Notícias%' THEN 5
          ELSE 9
        END,
        c.is_online DESC,
        c.health_score DESC,
        c.success_count DESC,
        c.id DESC
      LIMIT $${params.length}
    `

    params.push(offset)

    query += ` OFFSET $${params.length}`

    const result = await pool.query(query, params)

    res.json(result.rows)

  } catch (err) {

    console.log('ERRO GET CHANNELS:', err)

    res.status(500).json({
      error: 'erro ao buscar canais'
    })

  }
})
app.post('/channels', auth, async (req, res) => {
  try {
    const { name, url, category, logo } = req.body

    if (!name || !url) {
      return res.status(400).json({ error: 'nome e url obrigatórios' })
    }

    await saveChannels([
      {
        name,
        url,
        category: category || 'Outros',
        logo: logo || ''
      }
    ])

    res.json({ message: 'Canal adicionado' })
  } catch (err) {
    console.log('ERRO ADD CHANNEL:', err)
    res.status(500).json({ error: 'erro ao adicionar canal' })
  }
})

app.delete('/channels/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM channels WHERE id = $1', [req.params.id])
    res.json({ message: 'Canal excluído' })
  } catch (err) {
    console.log('ERRO DELETE CHANNEL:', err)
    res.status(500).json({ error: 'erro ao excluir canal' })
  }
})

app.post('/import-m3u', auth, async (req, res) => {
  try {
    const urls = req.body.urls || [req.body.url]

    if (!urls || !urls[0]) {
      return res.status(400).json({ error: 'URL M3U obrigatória' })
    }

    let allChannels = []

    for (const playlistUrl of urls) {
      try {
        const parsed = await importM3UFromUrl(playlistUrl)
        allChannels = [...allChannels, ...parsed]
      } catch (err) {
        console.log('ERRO FONTE M3U:', err.message)
      }
    }

    const result = await saveChannels(allChannels)

    res.json({
      message: `Importação concluída. ${result.saved} novos. ${result.updated} atualizados.`,
      encontrados: allChannels.length,
      unicos: result.total,
      novos: result.saved,
      atualizados: result.updated
    })
  } catch (err) {
    console.log('ERRO IMPORT M3U:', err)
    res.status(500).json({ error: 'erro ao importar M3U' })
  }
})

app.post('/sources', auth, async (req, res) => {
  try {
    const { name, url } = req.body

    if (!name || !url) {
      return res.status(400).json({ error: 'nome e url obrigatórios' })
    }

    const fixedUrl = normalizeGithubUrl(url)

    await pool.query(
      `
      INSERT INTO m3u_sources (name, url, active, source_type)
      VALUES ($1,$2,true,'manual')
      ON CONFLICT (url)
      DO UPDATE SET name = EXCLUDED.name, active = true
      `,
      [name, fixedUrl]
    )

    res.json({ message: 'Fonte M3U salva' })
  } catch (err) {
    console.log('ERRO ADD SOURCE:', err)
    res.status(500).json({ error: 'erro ao salvar fonte' })
  }
})

app.get('/sources', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM m3u_sources ORDER BY id DESC'
    )

    res.json(result.rows)
  } catch (err) {
    console.log('ERRO GET SOURCES:', err)
    res.status(500).json({ error: 'erro ao buscar fontes' })
  }
})

app.post('/github/scan', auth, async (req, res) => {
  try {
    const found = await githubAutoDiscovery()

    res.json({
      message: `Busca GitHub concluída. ${found} fontes automáticas salvas.`,
      found
    })
  } catch (err) {
    console.log('ERRO GITHUB SCAN:', err)
    res.status(500).json({ error: 'erro na busca GitHub' })
  }
})

app.post('/sources/import-all', auth, async (req, res) => {
  try {
    const result = await importAllSources()

    res.json({
      message: `Atualização concluída. ${result.saved} novos. ${result.updated} atualizados.`,
      ...result
    })
  } catch (err) {
    console.log('ERRO IMPORT ALL:', err)
    res.status(500).json({ error: 'erro ao atualizar fontes' })
  }
})

app.post('/channels/check-online', auth, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT id, url
      FROM channels
      ORDER BY RANDOM()
      LIMIT 200
    `)

    let online = 0
    let offline = 0

    for (const channel of result.rows) {

      let isOnline = false

      try {

        if (!channel.url) {
          isOnline = false
        }

        else if (
          channel.url.includes('.m3u8') ||
          channel.url.includes('.mpd')
        ) {

          const response = await fetch(channel.url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 IPTV PANEL'
            },
            signal: AbortSignal.timeout(3000)
          })

          if (response.ok) {

            const text = await response.text()

            if (
              text.includes('#EXTM3U') ||
              text.includes('#EXTINF') ||
              text.includes('#EXT-X-STREAM-INF') ||
              text.includes('#EXT-X-TARGETDURATION')
            ) {
              isOnline = true
            }

          }

        } else {

          const response = await fetch(channel.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          })

          isOnline = response.ok
        }

      } catch (err) {
        isOnline = false
      }

      if (isOnline) {
  await pool.query(`
    UPDATE channels
    SET
      is_online = true,
      success_count = success_count + 1,
      health_score = LEAST(100, health_score + 10),
      last_checked = NOW()
    WHERE id = $1
  `, [channel.id])

  online++
} else {
  await pool.query(`
    UPDATE channels
    SET
      is_online = false,
      fail_count = fail_count + 1,
      health_score = GREATEST(0, health_score - 20),
      last_checked = NOW()
    WHERE id = $1
  `, [channel.id])

  offline++
}

    }

    res.json({
      success: true,
      online,
      offline
    })

  } catch (err) {

    console.log('CHECK ONLINE ERROR:', err)

    res.status(500).json({
      error: 'erro ao verificar canais'
    })

  }
})
app.delete('/channels/offline/remove', auth, async (req, res) => {
  try {
    const result = await pool.query(`
  DELETE FROM channels
  WHERE is_online = false
  AND name NOT ILIKE '%globo%'
  AND name NOT ILIKE '%viva%'
  AND name NOT ILIKE '%sbt%'
  AND name NOT ILIKE '%record%'
  AND name NOT ILIKE '%band%'
  RETURNING id
`)

    res.json({
      message: `${result.rows.length} canais offline removidos.`,
      removed: result.rows.length
    })
  } catch (err) {
    console.log('ERRO REMOVE OFFLINE:', err)
    res.status(500).json({ error: 'erro ao remover offline' })
  }
})

app.post('/favorites', auth, async (req, res) => {
  try {
    const { profileId, channelId } = req.body

    await pool.query(
      `
      INSERT INTO favorites (user_id, profile_id, channel_id)
      VALUES ($1,$2,$3)
      ON CONFLICT (profile_id, channel_id) DO NOTHING
      `,
      [req.user.id, profileId, channelId]
    )

    res.json({ message: 'Favorito salvo' })
  } catch (err) {
    console.log('ERRO FAVORITE:', err)
    res.status(500).json({ error: 'erro ao salvar favorito' })
  }
})

app.delete('/favorites', auth, async (req, res) => {
  try {
    const { profileId, channelId } = req.body

    await pool.query(
      'DELETE FROM favorites WHERE profile_id = $1 AND channel_id = $2',
      [profileId, channelId]
    )

    res.json({ message: 'Favorito removido' })
  } catch (err) {
    console.log('ERRO REMOVE FAVORITE:', err)
    res.status(500).json({ error: 'erro ao remover favorito' })
  }
})

app.get('/favorites/:profileId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT c.*
      FROM favorites f
      JOIN channels c ON c.id = f.channel_id
      WHERE f.profile_id = $1
      ORDER BY f.created_at DESC
      `,
      [req.params.profileId]
    )

    res.json(result.rows)
  } catch (err) {
    console.log('ERRO GET FAVORITES:', err)
    res.status(500).json({ error: 'erro ao buscar favoritos' })
  }
})

app.post('/history', auth, async (req, res) => {
  try {
    const { profileId, channelId, progress, watchedSeconds } = req.body

    await pool.query(
      `
      INSERT INTO watch_history
      (user_id, profile_id, channel_id, progress, watched_seconds, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (profile_id, channel_id)
      DO UPDATE SET
        progress = EXCLUDED.progress,
        watched_seconds = EXCLUDED.watched_seconds,
        updated_at = NOW()
      `,
      [req.user.id, profileId, channelId, progress || 0, watchedSeconds || 0]
    )

    res.json({ message: 'Histórico salvo' })
  } catch (err) {
    console.log('ERRO HISTORY:', err)
    res.status(500).json({ error: 'erro ao salvar histórico' })
  }
})

app.get('/history/:profileId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT c.*, h.progress, h.watched_seconds, h.updated_at
      FROM watch_history h
      JOIN channels c ON c.id = h.channel_id
      WHERE h.profile_id = $1
      ORDER BY h.updated_at DESC
      LIMIT 20
      `,
      [req.params.profileId]
    )

    res.json(result.rows)
  } catch (err) {
    console.log('ERRO GET HISTORY:', err)
    res.status(500).json({ error: 'erro ao buscar histórico' })
  }
})

app.get('/recommendations/:profileId', auth, async (req, res) => {
  try {
    const history = await pool.query(
      `
      SELECT c.category
      FROM watch_history h
      JOIN channels c ON c.id = h.channel_id
      WHERE h.profile_id = $1
      ORDER BY h.updated_at DESC
      LIMIT 5
      `,
      [req.params.profileId]
    )

    const categories = history.rows.map(row => row.category)

    if (categories.length === 0) {
      const channels = await pool.query(
        'SELECT * FROM channels WHERE is_online = true ORDER BY id DESC LIMIT 20'
      )

      return res.json(channels.rows)
    }

    const channels = await pool.query(
      `
      SELECT *
      FROM channels
      WHERE category = ANY($1)
      AND is_online = true
      ORDER BY id DESC
      LIMIT 20
      `,
      [categories]
    )

    res.json(channels.rows)
  } catch (err) {
    console.log('ERRO RECOMMENDATIONS:', err)
    res.status(500).json({ error: 'erro ao gerar recomendações' })
  }
})

async function fullAutoIPTV() {
  try {
    console.log('AUTO IPTV: INICIANDO')

    // await githubAutoDiscovery()

    const imported = await importAllSources()
    console.log('AUTO IPTV IMPORT:', imported)

    const checked = await checkAndRemoveOffline()
    console.log('AUTO IPTV CHECK:', checked)

    console.log('AUTO IPTV: FINALIZADO')
  } catch (err) {
    console.log('AUTO IPTV ERRO:', err.message)
  }
}

// setInterval(fullAutoIPTV, 1000 * 60 * 60 * 6)

app.post('/auto/run-now', auth, async (req, res) => {
  try {
    await fullAutoIPTV()
    res.json({ message: 'IPTV automático executado com sucesso' })
  } catch (err) {
    res.status(500).json({ error: 'erro ao executar IPTV automático' })
  }
})

app.get('/home/:profileId', auth, async (req, res) => {
  try {
    const profileId = req.params.profileId

    const continueWatching = await pool.query(
      `
      SELECT c.*, h.progress, h.updated_at
      FROM watch_history h
      JOIN channels c ON c.id = h.channel_id
      WHERE h.profile_id = $1
      ORDER BY h.updated_at DESC
      LIMIT 20
      `,
      [profileId]
    )

    const favorites = await pool.query(
      `
      SELECT c.*
      FROM favorites f
      JOIN channels c ON c.id = f.channel_id
      WHERE f.profile_id = $1
      ORDER BY f.created_at DESC
      LIMIT 20
      `,
      [profileId]
    )

    const trending = await pool.query(`
      SELECT c.*, COUNT(h.id) AS views
      FROM channels c
      LEFT JOIN watch_history h ON h.channel_id = c.id
      WHERE c.is_online = true
      GROUP BY c.id
      ORDER BY views DESC, c.id DESC
      LIMIT 30
    `)

    const liveNow = await pool.query(`
      SELECT *
      FROM channels
      WHERE is_online = true
      ORDER BY id DESC
      LIMIT 30
    `)

    const tvAberta = await pool.query(`
      SELECT *
      FROM channels
      WHERE category ILIKE '%TV Aberta%'
      ORDER BY id DESC
      LIMIT 40
    `)

    const esportes = await pool.query(`
      SELECT *
      FROM channels
      WHERE category ILIKE '%Esportes%'
      ORDER BY id DESC
      LIMIT 40
    `)

    const filmes = await pool.query(`
      SELECT *
      FROM channels
      WHERE category ILIKE '%Filmes%'
      ORDER BY id DESC
      LIMIT 40
    `)

    const recentes = await pool.query(`
      SELECT *
      FROM channels
      ORDER BY created_at DESC
      LIMIT 40
    `)

    res.json({
      continueWatching: continueWatching.rows,
      favorites: favorites.rows,
      trending: trending.rows,
      liveNow: liveNow.rows,
      tvAberta: tvAberta.rows,
      esportes: esportes.rows,
      filmes: filmes.rows,
      recentes: recentes.rows
    })
  } catch (err) {
    console.log('ERRO HOME:', err)
    res.status(500).json({ error: 'erro ao carregar home inteligente' })
  }
})

function parseEpisodeInfo(name = '') {
  const match = name.match(/(.+?)\s*S(\d{1,2})E(\d{1,2})/i)

  if (!match) return null

  return {
    seriesName: match[1].trim(),
    season: Number(match[2]),
    episode: Number(match[3])
  }
}

function slugify(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

app.get('/series', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM channels
      WHERE name ~* 'S[0-9]{1,2}E[0-9]{1,2}'
      ORDER BY name ASC
      LIMIT 3000
    `)

    const map = {}

    for (const channel of result.rows) {
      const info = parseEpisodeInfo(channel.name)

      if (!info) continue

      const slug = slugify(info.seriesName)

      if (!map[slug]) {
        map[slug] = {
          slug,
          name: info.seriesName,
          category: 'Séries',
          totalEpisodes: 0,
          seasons: {},
          poster: channel.logo || ''
        }
      }

      if (!map[slug].seasons[info.season]) {
        map[slug].seasons[info.season] = []
      }

      map[slug].seasons[info.season].push({
        ...channel,
        episode: info.episode,
        season: info.season
      })

      map[slug].totalEpisodes++
    }

    const series = Object.values(map)
      .map(item => ({
        ...item,
        seasons: Object.keys(item.seasons).length
      }))
      .sort((a, b) => b.totalEpisodes - a.totalEpisodes)

    res.json(series)
  } catch (err) {
    console.log('ERRO SERIES:', err)
    res.status(500).json({ error: 'erro ao buscar séries' })
  }
})

app.get('/series/:slug', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM channels
      WHERE name ~* 'S[0-9]{1,2}E[0-9]{1,2}'
      ORDER BY name ASC
      LIMIT 5000
    `)

    const episodes = []

    let seriesName = ''

    for (const channel of result.rows) {
      const info = parseEpisodeInfo(channel.name)

      if (!info) continue

      const slug = slugify(info.seriesName)

      if (slug === req.params.slug) {
        seriesName = info.seriesName

        episodes.push({
          ...channel,
          season: info.season,
          episode: info.episode
        })
      }
    }

    episodes.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season
      return a.episode - b.episode
    })

    res.json({
      slug: req.params.slug,
      name: seriesName,
      episodes
    })
  } catch (err) {
    console.log('ERRO SERIES DETAIL:', err)
    res.status(500).json({ error: 'erro ao buscar episódios' })
  }
})

app.get('/channels/:id/streams', auth, async (req, res) => {
  try {
    const channelId = req.params.id

    const main = await pool.query(
      'SELECT id, name, url, category, logo, health_score FROM channels WHERE id = $1',
      [channelId]
    )

    const reserves = await pool.query(
      `
      SELECT id, name, url, quality, health_score
      FROM channel_streams
      WHERE channel_id = $1
      AND is_online = true
      ORDER BY health_score DESC, success_count DESC, id DESC
      `,
      [channelId]
    )

    res.json({
      main: main.rows[0] || null,
      streams: reserves.rows
    })
  } catch (err) {
    console.log('ERRO GET STREAMS:', err)
    res.status(500).json({ error: 'erro ao buscar streams reserva' })
  }
})
app.get('/', (req, res) => {
app.get('/epg/:channel', auth, async (req, res) => {

  try {

    const channel = req.params.channel

    const result = await pool.query(
      `
      SELECT *
      FROM epg_now
      WHERE channel_name ILIKE $1
      ORDER BY start_time ASC
      LIMIT 10
      `,
      [`%${channel}%`]
    )

    res.json(result.rows)

  } catch (err) {

    console.log('ERRO EPG API:', err)

    res.status(500).json({
      error: 'erro ao buscar epg'
    })

  }

})
  res.send('IPTV AUTO SERVER COMPLETO ONLINE')
})

setInterval(async () => {

  try {

    console.log('AUTO UPDATE INICIADO')

    await importAllSources()

    await checkAndRemoveOffline()

    console.log('AUTO UPDATE FINALIZADO')

  } catch (err) {

    console.log('AUTO UPDATE ERROR:', err.message)

  }

}, 1000 * 60 * 2)
async function updateEPG() {

  try {

    console.log('ATUALIZANDO EPG...')

    const parser = new XMLParser({
      ignoreAttributes: false
    })

    const response = await fetch(EPG_URL)

    const xml = await response.text()

    const parsed = parser.parse(xml)

    const programmes = parsed?.tv?.programme || []

    await pool.query('DELETE FROM epg_now')

    for (const p of programmes.slice(0, 5000)) {

      const channel = p['@_channel'] || ''

      const title =
        typeof p.title === 'object'
          ? p.title['#text']
          : p.title || ''

      const desc =
        typeof p.desc === 'object'
          ? p.desc['#text']
          : p.desc || ''

      const start = p['@_start']
      const stop = p['@_stop']

      if (!channel || !title) continue

      await pool.query(
        `
        INSERT INTO epg_now
        (
          channel_name,
          title,
          description,
          start_time,
          end_time
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          channel,
          title,
          desc,
          start,
          stop
        ]
      )
    }

    console.log('EPG OK')

  } catch (err) {

    console.log('ERRO EPG:', err.message)

  }
}

updateEPG()

setInterval(() => {
  updateEPG()
}, 1000 * 60 * 60 * 2)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER ON ${PORT}`)
  console.log('IPTV AUTO COMPLETO ATIVO')
  console.log('GitHub scan + importação + verificação online + remoção offline')
})