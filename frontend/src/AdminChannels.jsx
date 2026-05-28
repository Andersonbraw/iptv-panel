import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API =
  'https://iptv-backend-cuxf.onrender.com'

const PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'

function AdminChannels() {
  const [channels, setChannels] =
    useState([])

  const [search, setSearch] =
    useState('')

  const [m3uUrl, setM3uUrl] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [
    categoryFilter,
    setCategoryFilter
  ] = useState('Todos')

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

  const authHeaders =
    useMemo(() => {
      return {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(
            'token'
          )}`
        }
      }
    }, [])

  function normalize(
    text = ''
  ) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
  }

  function detectCategory(
    name = ''
  ) {
    const n = normalize(name)

    if (
      n.includes('sport') ||
      n.includes('espn') ||
      n.includes(
        'premiere'
      ) ||
      n.includes('ufc')
    )
      return 'Esportes'

    if (
      n.includes('movie') ||
      n.includes('cine') ||
      n.includes('hbo')
    )
      return 'Filmes'

    if (
      n.includes('news') ||
      n.includes('cnn')
    )
      return 'Notícias'

    if (
      n.includes('kids') ||
      n.includes('cartoon')
    )
      return 'Infantil'

    if (
      n.includes(
        'discovery'
      ) ||
      n.includes('natgeo')
    )
      return 'Documentários'

    if (
      n.includes('music') ||
      n.includes('mtv')
    )
      return 'Música'

    if (
      n.includes('adult') ||
      n.includes('xxx')
    )
      return 'Adulto'

    return 'Outros'
  }

  async function loadChannels() {
    try {
      setLoading(true)

      const res =
        await axios.get(
          `${API}/channels`,
          authHeaders
        )

      setChannels(
        res.data || []
      )
    } catch (err) {
      console.log(err)

      alert(
        'Erro ao carregar canais'
      )
    } finally {
      setLoading(false)
    }
  }

  async function importM3U() {
    if (!m3uUrl.trim()) {
      alert('Cole URL M3U')
      return
    }

    try {
      setLoading(true)

      const res =
        await axios.post(
          `${API}/import-m3u`,
          {
            url: m3uUrl
          },
          authHeaders
        )

      alert(
        `Importados: ${res.data.adicionados || 0}`
      )

      setM3uUrl('')

      await loadChannels()
    } catch (err) {
      alert(
        err.response?.data
          ?.error ||
          'Erro ao importar'
      )
    } finally {
      setLoading(false)
    }
  }

  async function removeChannel(
    id
  ) {
    if (
      !confirm(
        'Deseja remover este canal?'
      )
    )
      return

    try {
      await axios.delete(
        `${API}/channels/${id}`,
        authHeaders
      )

      setChannels(prev =>
        prev.filter(
          c => c.id !== id
        )
      )
    } catch {
      alert(
        'Erro ao remover canal'
      )
    }
  }

  async function removeOfflineChannels() {
    const offline =
      channels.filter(
        c => !c.is_online
      )

    if (
      offline.length === 0
    ) {
      alert(
        'Nenhum canal offline'
      )
      return
    }

    if (
      !confirm(
        `Remover ${offline.length} canais offline?`
      )
    )
      return

    try {
      setLoading(true)

      await Promise.all(
        offline.map(c =>
          axios.delete(
            `${API}/channels/${c.id}`,
            authHeaders
          )
        )
      )

      alert(
        `${offline.length} canais removidos`
      )

      await loadChannels()
    } catch {
      alert(
        'Erro ao remover offline'
      )
    } finally {
      setLoading(false)
    }
  }

  async function removeForeignChannels() {
    const blocked = [
      'arab',
      'urdu',
      'india',
      'pakistan',
      'turk',
      'persian',
      'bangla',
      'africa',
      'islam',
      'quran',
      'muslim',
      'hindi',
      'tamil',
      'telugu',
      'aljazeera',
      'france',
      'russia',
      'russian'
    ]

    const foreign =
      channels.filter(
        channel => {
          const name =
            normalize(
              channel.name
            )

          return blocked.some(
            word =>
              name.includes(
                word
              )
          )
        }
      )

    if (
      foreign.length === 0
    ) {
      alert(
        'Nenhum canal estrangeiro encontrado'
      )
      return
    }

    if (
      !confirm(
        `Remover ${foreign.length} canais estrangeiros?`
      )
    )
      return

    try {
      setLoading(true)

      await Promise.all(
        foreign.map(c =>
          axios.delete(
            `${API}/channels/${c.id}`,
            authHeaders
          )
        )
      )

      alert(
        `${foreign.length} canais removidos`
      )

      await loadChannels()
    } catch {
      alert(
        'Erro ao remover estrangeiros'
      )
    } finally {
      setLoading(false)
    }
  }

  async function removeAllChannels() {
  if (
    !confirm(
      'APAGAR TODOS OS CANAIS?'
    )
  )
    return

  try {
    setLoading(true)

    await axios.delete(
      `${API}/channels-clear`,
      authHeaders
    )

    setChannels([])

    alert(
      'Todos canais removidos'
    )
  } catch (err) {
    console.log(err)

    alert(
      err.response?.data
        ?.error ||
        'Erro ao limpar canais'
    )
  } finally {
    setLoading(false)
  }
}
    if (
      !confirm(
        'APAGAR TODOS OS CANAIS?'
      )
    )
      return

    try {
      setLoading(true)

      await Promise.all(
        channels.map(c =>
          axios.delete(
            `${API}/channels/${c.id}`,
            authHeaders
          )
        )
      )

      setChannels([])

      alert(
        'Todos canais removidos'
      )
    } catch {
      alert(
        'Erro ao limpar canais'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  const filteredChannels =
    useMemo(() => {
      return channels.filter(
        channel => {
          const channelName =
            normalize(
              channel.name ||
                ''
            )

          const matchesSearch =
            channelName.includes(
              normalize(search)
            )

          const category =
            detectCategory(
              channel.name
            )

          const matchesCategory =
            categoryFilter ===
            'Todos'
              ? true
              : category ===
                categoryFilter

          return (
            matchesSearch &&
            matchesCategory
          )
        }
      )
    }, [
      channels,
      search,
      categoryFilter
    ])

  const onlineCount =
    useMemo(() => {
      return channels.filter(
        c => c.is_online
      ).length
    }, [channels])

  const offlineCount =
    channels.length -
    onlineCount

  return (
    <div style={styles.container}>
      <div style={styles.top}>
        <div>
          <h1 style={styles.title}>
            Canais IPTV
          </h1>

          <p style={styles.counter}>
            Total:{' '}
            {channels.length}{' '}
            | Online:{' '}
            {onlineCount} |
            Offline:{' '}
            {offlineCount}
          </p>
        </div>

        <input
          type='text'
          placeholder='Buscar...'
          value={search}
          onChange={e =>
            setSearch(
              e.target.value
            )
          }
          style={
            styles.searchInput
          }
        />
      </div>

      <div
        style={
          styles.categories
        }
      >
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() =>
              setCategoryFilter(
                cat
              )
            }
            style={
              categoryFilter ===
              cat
                ? styles.activeCategory
                : styles.category
            }
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={styles.actions}>
        <input
          type='text'
          placeholder='Cole URL M3U...'
          value={m3uUrl}
          onChange={e =>
            setM3uUrl(
              e.target.value
            )
          }
          style={styles.m3uInput}
        />

        <button
          style={
            styles.blueButton
          }
          onClick={importM3U}
        >
          Importar
        </button>

        <button
          style={
            styles.blueButton
          }
          onClick={
            loadChannels
          }
        >
          Atualizar
        </button>

        <button
          style={
            styles.yellowButton
          }
          onClick={
            removeOfflineChannels
          }
        >
          Remover offline
        </button>

        <button
          style={
            styles.orangeButton
          }
          onClick={
            removeForeignChannels
          }
        >
          Remover estrangeiros
        </button>

        <button
          style={
            styles.redButton
          }
          onClick={
            removeAllChannels
          }
        >
          Limpar tudo
        </button>
      </div>

      {loading && (
        <div style={styles.loading}>
          Processando...
        </div>
      )}

      <div style={styles.info}>
        Exibindo:{' '}
        {
          filteredChannels.length
        }{' '}
        | Categoria:{' '}
        {categoryFilter}
      </div>

      <div style={styles.grid}>
        {filteredChannels.map(
          channel => {
            const category =
              detectCategory(
                channel.name
              )

            return (
              <div
                key={channel.id}
                style={
                  styles.card
                }
                onMouseEnter={e => {
                  e.currentTarget.style.transform =
                    'scale(1.08)'

                  e.currentTarget.style.zIndex =
                    20

                  e.currentTarget.style.boxShadow =
                    '0 0 25px rgba(56,189,248,0.45)'

                  e.currentTarget.style.border =
                    '1px solid #38bdf8'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform =
                    'scale(1)'

                  e.currentTarget.style.zIndex =
                    1

                  e.currentTarget.style.boxShadow =
                    'none'

                  e.currentTarget.style.border =
                    '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div
                  style={
                    styles.categoryBadge
                  }
                >
                  {category}
                </div>

                <img
                  loading='lazy'
                  src={
                    channel.logo?.startsWith(
                      'http'
                    )
                      ? channel.logo
                      : PLACEHOLDER
                  }
                  alt={
                    channel.name
                  }
                  style={
                    styles.logo
                  }
                  onError={e => {
                    e.currentTarget.src =
                      PLACEHOLDER
                  }}
                />

                <div
                  style={
                    styles.name
                  }
                >
                  {channel.name}
                </div>

                <div
                  style={
                    styles.status
                  }
                >
                  <span
                    style={{
                      color:
                        channel.is_online
                          ? '#22c55e'
                          : '#ef4444'
                    }}
                  >
                    ●
                  </span>

                  <span>
                    {channel.is_online
                      ? 'ONLINE'
                      : 'OFFLINE'}
                  </span>
                </div>

                <button
                  style={
                    styles.deleteButton
                  }
                  onClick={() =>
                    removeChannel(
                      channel.id
                    )
                  }
                >
                  Remover
                </button>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background:
      '#07142b',
    padding: 20,
    borderRadius: 24
  },

  top: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 20
  },

  title: {
    fontSize: 34,
    margin: 0
  },

  counter: {
    color: '#94a3b8',
    marginTop: 6
  },

  searchInput: {
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#020617',
    color: '#fff',
    minWidth: 280
  },

  categories: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 20
  },

  category: {
    background:
      '#111827',
    color: '#fff',
    border: 'none',
    padding:
      '10px 18px',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  activeCategory: {
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    border: 'none',
    padding:
      '10px 18px',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  actions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 20
  },

  m3uInput: {
    flex: 1,
    minWidth: 300,
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#020617',
    color: '#fff'
  },

  blueButton: {
    padding:
      '14px 18px',
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  yellowButton: {
    padding:
      '14px 18px',
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#facc15,#eab308)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  orangeButton: {
    padding:
      '14px 18px',
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#fb923c,#ea580c)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  redButton: {
    padding:
      '14px 18px',
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  loading: {
    background:
      '#020617',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  info: {
    background:
      '#020617',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(118px,1fr))',
    gap: 12
  },

  card: {
    background:
      'linear-gradient(180deg,#020617,#0f172a)',
    borderRadius: 14,
    padding: 10,
    textAlign: 'center',
    position: 'relative',
    border:
      '1px solid rgba(255,255,255,0.06)',
    minHeight: 170,
    overflow: 'hidden',
    transition:
      '0.25s ease'
  },

  categoryBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    background:
      '#38bdf8',
    color: '#000',
    padding:
      '3px 7px',
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 'bold'
  },

  logo: {
    width: 58,
    height: 50,
    objectFit: 'contain',
    marginTop: 22,
    marginBottom: 10,
    transition:
      '0.25s'
  },

  name: {
    minHeight: 34,
    fontWeight: 'bold',
    fontSize: 11,
    lineHeight: '13px',
    overflow: 'hidden'
  },

  status: {
    display: 'flex',
    justifyContent:
      'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 8,
    fontSize: 10
  },

  deleteButton: {
    width: '100%',
    padding: 7,
    border: 'none',
    borderRadius: 9,
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    cursor: 'pointer'
  }
}

export default AdminChannels