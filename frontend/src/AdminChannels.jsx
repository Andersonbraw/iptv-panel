import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function AdminChannels() {
  const [channels, setChannels] = useState([])
  const [search, setSearch] = useState('')
  const [m3uUrl, setM3uUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('Todos')

  const categories = [
    'Todos',
    'Esportes',
    'Filmes',
    'Notícias',
    'Infantil',
    'Documentários',
    'Música',
    'Adulto',
    'Outros'
  ]

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }

  function detectCategory(name = '') {
    const n = name.toLowerCase()

    if (
      n.includes('sport') ||
      n.includes('espn') ||
      n.includes('premiere') ||
      n.includes('combate') ||
      n.includes('ufc') ||
      n.includes('futebol')
    ) return 'Esportes'

    if (
      n.includes('cine') ||
      n.includes('movie') ||
      n.includes('film') ||
      n.includes('telecine') ||
      n.includes('hbo')
    ) return 'Filmes'

    if (
      n.includes('news') ||
      n.includes('cnn') ||
      n.includes('globo news') ||
      n.includes('jornal') ||
      n.includes('reuters')
    ) return 'Notícias'

    if (
      n.includes('kids') ||
      n.includes('cartoon') ||
      n.includes('disney') ||
      n.includes('nick') ||
      n.includes('infantil')
    ) return 'Infantil'

    if (
      n.includes('discovery') ||
      n.includes('history') ||
      n.includes('natgeo') ||
      n.includes('animal planet')
    ) return 'Documentários'

    if (
      n.includes('music') ||
      n.includes('mtv') ||
      n.includes('radio')
    ) return 'Música'

    if (
      n.includes('xxx') ||
      n.includes('adult') ||
      n.includes('18+')
    ) return 'Adulto'

    return 'Outros'
  }

  async function loadChannels() {
    try {
      const res = await axios.get(`${API}/channels`, authHeaders)
      setChannels(res.data)
    } catch (err) {
      console.log(err)
    }
  }

  async function importM3U() {
    if (!m3uUrl) {
      alert('Cole a URL M3U primeiro')
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/import-m3u`,
        { url: m3uUrl },
        authHeaders
      )

      alert(`Importados: ${res.data.adicionados || 0}`)
      setM3uUrl('')
      await loadChannels()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao importar M3U')
    } finally {
      setLoading(false)
    }
  }

  async function removeChannel(id) {
    if (!confirm('Remover canal?')) return

    try {
      setLoading(true)
      await axios.delete(`${API}/channels/${id}`, authHeaders)
      await loadChannels()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover canal')
    } finally {
      setLoading(false)
    }
  }

  async function removeOffline() {
    if (!confirm('Remover canais offline?')) return

    try {
      setLoading(true)

      const offlineChannels = channels.filter(c => !c.is_online)

      for (const channel of offlineChannels) {
        await axios.delete(`${API}/channels/${channel.id}`, authHeaders)
      }

      alert(`Offline removidos: ${offlineChannels.length}`)
      await loadChannels()
    } catch {
      alert('Erro ao remover offline')
    } finally {
      setLoading(false)
    }
  }

  async function removeForeignChannels() {
    if (!confirm('Remover canais estrangeiros/indesejados?')) return

    try {
      setLoading(true)

      const blockedWords = [
        'arab', 'quran', 'islam', 'urdu', 'hindi', 'bangla',
        'turk', 'russia', 'russian', 'kurd', 'pakistan',
        'india', 'indonesia', 'africa', 'persian', 'punjabi',
        'tamil', 'telugu', 'marathi', 'bengali', 'egypt',
        'kuwait', 'saudi', 'muslim', 'koran', 'mosque',
        'tv5monde', 'france 24', 'sharia', 'alquran',
        'islamic', 'aljazeera', 'makkah', 'madinah',
        'geo-blocked', 'not 24/7', 'россия', 'первый',
        'рен', 'пятница', 'нтв', 'тнт', 'стс', 'мир',
        'звезда', 'belarus', 'ukraine', 'kazakh',
        'kazakhstan', 'armenia', 'georgia', 'azerbaijan',
        'uzbek', '1+1', 'ictv', 'inter', 'novy', 'zee',
        'zing', 'zoom', '7tv', 'tvk', 'tbn', 'tbk',
        'otv', 'ctc', 'sts', 'ntv', 'ren tv', 'rtvi'
      ]

      const toRemove = channels.filter(channel => {
        const name = (channel.name || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')

        const category = (channel.category || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')

        const hasAsianChars =
          /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u0400-\u04FF]/.test(name)

        const noLogo =
          !channel.logo ||
          channel.logo.includes('no-image') ||
          channel.logo.includes('placeholder')

        return (
          hasAsianChars ||
          noLogo ||
          blockedWords.some(word =>
            name.includes(word) ||
            category.includes(word)
          )
        )
      })

      for (const channel of toRemove) {
        await axios.delete(`${API}/channels/${channel.id}`, authHeaders)
      }

      alert(`Canais removidos: ${toRemove.length}`)
      await loadChannels()
    } catch {
      alert('Erro ao remover estrangeiros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  const filtered = channels
    .filter(channel => {
      const matchSearch =
        channel.name
          ?.toLowerCase()
          .includes(search.toLowerCase())

      const category = detectCategory(channel.name)

      const matchCategory =
        categoryFilter === 'Todos'
          ? true
          : category === categoryFilter

      return matchSearch && matchCategory
    })
    .sort((a, b) =>
      (a.name || '').localeCompare(
        b.name || '',
        'pt-BR',
        { sensitivity: 'base' }
      )
    )

  const onlineCount = channels.filter(channel => channel.is_online).length
  const offlineCount = channels.length - onlineCount

  return (
    <div style={styles.box}>
      <div style={styles.top}>
        <div>
          <h1 style={styles.title}>Canais IPTV</h1>

          <p style={styles.counter}>
            Total: {channels.length} | Online: {onlineCount} | Offline: {offlineCount}
          </p>
        </div>

        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.categoriesRow}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={
              categoryFilter === cat
                ? styles.activeCategoryButton
                : styles.categoryButton
            }
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={styles.importBox}>
        <input
          type="text"
          placeholder="Cole aqui a URL M3U..."
          value={m3uUrl}
          onChange={(e) => setM3uUrl(e.target.value)}
          style={styles.m3uInput}
        />

        <button style={styles.blueButton} onClick={importM3U} disabled={loading}>
          Importar M3U
        </button>

        <button style={styles.blueButton} onClick={loadChannels} disabled={loading}>
          Atualizar
        </button>

        <button
          style={styles.yellowButton}
          onClick={() => alert(`Online: ${onlineCount}\nOffline: ${offlineCount}`)}
          disabled={loading}
        >
          Verificar online
        </button>

        <button style={styles.redButton} onClick={removeOffline} disabled={loading}>
          Remover offline
        </button>

        <button style={styles.orangeButton} onClick={removeForeignChannels} disabled={loading}>
          Remover estrangeiros
        </button>
      </div>

      {loading && (
        <div style={styles.loading}>
          Processando...
        </div>
      )}

      <div style={styles.totalCategory}>
        Exibindo: {filtered.length} | Categoria: {categoryFilter}
      </div>

      <div style={styles.grid}>
        {filtered.map(channel => (
          <div key={channel.id} style={styles.card}>
            <div style={styles.categoryBadge}>
              {detectCategory(channel.name)}
            </div>

            <img
              src={
                channel.logo && channel.logo.startsWith('http')
                  ? channel.logo
                  : 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'
              }
              style={styles.logo}
              onError={(e) => {
                e.currentTarget.src =
                  'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'
              }}
            />

            <div style={styles.name}>
              {channel.name}
            </div>

            <div style={styles.status}>
              <span style={{ color: channel.is_online ? '#22c55e' : '#ef4444' }}>
                ●
              </span>

              <span>
                {channel.is_online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <button
              style={styles.deleteButton}
              onClick={() => removeChannel(channel.id)}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  box: {
    background: '#07142b',
    padding: 16,
    borderRadius: 20
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
    flexWrap: 'wrap'
  },

  title: {
    margin: 0,
    fontSize: 30
  },

  counter: {
    marginTop: 6,
    color: '#94a3b8'
  },

  input: {
    padding: 12,
    borderRadius: 12,
    border: 'none',
    background: '#020617',
    color: '#fff',
    minWidth: 220
  },

  categoriesRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap'
  },

  categoryButton: {
    background: '#111827',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  activeCategoryButton: {
    background: '#38bdf8',
    color: '#000',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  importBox: {
    display: 'flex',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap'
  },

  m3uInput: {
    flex: 1,
    minWidth: 300,
    padding: 14,
    borderRadius: 12,
    border: 'none',
    background: '#020617',
    color: '#fff'
  },

  blueButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 12,
    background: '#38bdf8',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  yellowButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 12,
    background: '#facc15',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  redButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 12,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  orangeButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 12,
    background: '#f97316',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  loading: {
    background: '#020617',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  totalCategory: {
    background: '#020617',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16
  },

  card: {
    background: '#020617',
    borderRadius: 16,
    padding: 14,
    textAlign: 'center',
    position: 'relative'
  },

  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: '#38bdf8',
    color: '#000',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 'bold'
  },

  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
    marginBottom: 10,
    marginTop: 18
  },

  name: {
    minHeight: 48,
    fontSize: 14,
    fontWeight: 'bold'
  },

  status: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 12,
    fontSize: 12
  },

  deleteButton: {
    width: '100%',
    padding: 10,
    border: 'none',
    borderRadius: 10,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminChannels