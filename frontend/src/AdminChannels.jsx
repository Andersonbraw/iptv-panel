import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

const PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'

function AdminChannels() {
  const [channels, setChannels] = useState([])
  const [search, setSearch] = useState('')
  const [m3uUrl, setM3uUrl] = useState('')
  const [m3uFile, setM3uFile] = useState(null)
  const [xtreamServer, setXtreamServer] = useState('')
  const [xtreamUser, setXtreamUser] = useState('')
  const [xtreamPass, setXtreamPass] = useState('')
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

  const authHeaders = useMemo(() => {
    return {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    }
  }, [])

  function normalize(text = '') {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function detectCategory(name = '') {
    const n = normalize(name)

    if (
      n.includes('sport') ||
      n.includes('espn') ||
      n.includes('premiere') ||
      n.includes('ufc')
    )
      return 'Esportes'

    if (n.includes('movie') || n.includes('cine') || n.includes('hbo'))
      return 'Filmes'

    if (n.includes('news') || n.includes('cnn')) return 'Notícias'
    if (n.includes('kids') || n.includes('cartoon')) return 'Infantil'
    if (n.includes('discovery') || n.includes('natgeo'))
      return 'Documentários'
    if (n.includes('music') || n.includes('mtv')) return 'Música'

    if (
      n.includes('adult') ||
      n.includes('xxx') ||
      n.includes('porn') ||
      n.includes('webcam')
    )
      return 'Adulto'

    return 'Outros'
  }

  async function loadChannels() {
    try {
      setLoading(true)

      const pageSize = 1000
      let offset = 0
      let allChannels = []
      let keepLoading = true

      while (keepLoading) {
        const res = await axios.get(
          `${API}/channels?limit=${pageSize}&offset=${offset}`,
          authHeaders
        )

        const data = Array.isArray(res.data) ? res.data : []

        allChannels = [...allChannels, ...data]

        if (data.length < pageSize) {
          keepLoading = false
        } else {
          offset += pageSize
        }
      }

      setChannels(allChannels)
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao carregar canais')
    } finally {
      setLoading(false)
    }
  }

  async function importM3UFile() {
    if (!m3uFile) {
      alert('Selecione o arquivo Lista.m3u primeiro')
      return
    }

    try {
      setLoading(true)

      const text = await m3uFile.text()

      if (!text.includes('#EXTM3U')) {
        alert('Arquivo M3U inválido')
        return
      }

      const res = await axios.post(
        `${API}/import-m3u-file`,
        { text },
        authHeaders
      )

      alert(
        `Arquivo M3U importado!\n\nEncontrados: ${
          res.data.encontrados || 0
        }\nImportados: ${res.data.adicionados || 0}`
      )

      setM3uFile(null)
      await loadChannels()
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao importar arquivo M3U')
    } finally {
      setLoading(false)
    }
  }

  async function importXtream() {
    if (!xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim()) {
      alert('Preencha servidor, usuário e senha Xtream')
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/xtream/import`,
        {
          server: xtreamServer.trim(),
          username: xtreamUser.trim(),
          password: xtreamPass.trim()
        },
        authHeaders
      )

      alert(
        `Importação Xtream concluída!\n\nCanais: ${
          res.data.channels || 0
        }\nFilmes: ${res.data.movies || 0}\nSéries: ${
          res.data.series || 0
        }\nIgnorados: ${res.data.skipped || 0}`
      )

      await loadChannels()
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao importar Xtream')
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

      const res = await axios.post(
        `${API}/import-m3u`,
        { url: m3uUrl },
        authHeaders
      )

      alert(`Importados: ${res.data.adicionados || 0}`)
      setM3uUrl('')
      await loadChannels()
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  async function removeChannel(id) {
    if (!confirm('Deseja remover este canal?')) return

    try {
      await axios.delete(`${API}/channels/${id}`, authHeaders)
      setChannels(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao remover canal')
    }
  }

  async function removeOfflineChannels() {
    const offline = channels.filter(c => !c.is_online)

    if (offline.length === 0) {
      alert('Nenhum canal offline')
      return
    }

    if (!confirm(`Remover ${offline.length} canais offline?`)) return

    try {
      setLoading(true)

      await Promise.all(
        offline.map(c => axios.delete(`${API}/channels/${c.id}`, authHeaders))
      )

      alert(`${offline.length} canais removidos`)
      await loadChannels()
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao remover offline')
    } finally {
      setLoading(false)
    }
  }

  async function removeForeignChannels() {
    if (!confirm('Remover canais estrangeiros/adultos/suspeitos direto do banco?'))
      return

    try {
      setLoading(true)

      const res = await axios.delete(`${API}/channels/clean-bad`, authHeaders)

      alert(`${res.data.removed || 0} canais removidos`)
      await loadChannels()
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao remover canais suspeitos')
    } finally {
      setLoading(false)
    }
  }

  async function removeAllChannels() {
    if (!confirm('APAGAR TODOS OS CANAIS?')) return

    try {
      setLoading(true)

      await axios.delete(`${API}/channels-clear`, authHeaders)

      setChannels([])
      alert('Todos canais removidos')
    } catch (err) {
      console.log(err)
      alert(err.response?.data?.error || 'Erro ao limpar canais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const channelName = normalize(channel.name || '')
      const matchesSearch = channelName.includes(normalize(search))
      const category = detectCategory(channel.name)
      const matchesCategory =
        categoryFilter === 'Todos' ? true : category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [channels, search, categoryFilter])

  const onlineCount = useMemo(() => {
    return channels.filter(c => c.is_online).length
  }, [channels])

  const offlineCount = channels.length - onlineCount

  return (
    <div style={styles.container}>
      <div style={styles.top}>
        <div>
          <h1 style={styles.title}>Canais IPTV</h1>

          <p style={styles.counter}>
            Total: {channels.length} | Online: {onlineCount} | Offline:{' '}
            {offlineCount}
          </p>
        </div>

        <input
          type='text'
          placeholder='Buscar...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.xtreamBox}>
        <h2 style={styles.boxTitle}>Importar arquivo M3U do computador</h2>

        <div style={styles.actions}>
          <input
            type='file'
            accept='.m3u,.m3u8,.txt'
            onChange={e => setM3uFile(e.target.files?.[0] || null)}
            style={styles.fileInput}
          />

          <button style={styles.greenButton} onClick={importM3UFile}>
            Importar arquivo M3U
          </button>

          {m3uFile && (
            <div style={styles.fileName}>
              Arquivo selecionado: {m3uFile.name}
            </div>
          )}
        </div>
      </div>

      <div style={styles.xtreamBox}>
        <h2 style={styles.boxTitle}>Importar Xtream Codes</h2>

        <div style={styles.actions}>
          <input
            type='text'
            placeholder='Servidor Xtream. Ex: http://poobookprog.top'
            value={xtreamServer}
            onChange={e => setXtreamServer(e.target.value)}
            style={styles.m3uInput}
          />

          <input
            type='text'
            placeholder='Usuário Xtream'
            value={xtreamUser}
            onChange={e => setXtreamUser(e.target.value)}
            style={styles.smallInput}
          />

          <input
            type='password'
            placeholder='Senha Xtream'
            value={xtreamPass}
            onChange={e => setXtreamPass(e.target.value)}
            style={styles.smallInput}
          />

          <button style={styles.greenButton} onClick={importXtream}>
            Importar Xtream
          </button>
        </div>
      </div>

      <div style={styles.categories}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={categoryFilter === cat ? styles.activeCategory : styles.category}
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
          onChange={e => setM3uUrl(e.target.value)}
          style={styles.m3uInput}
        />

        <button style={styles.blueButton} onClick={importM3U}>
          Importar M3U URL
        </button>

        <button style={styles.blueButton} onClick={loadChannels}>
          Atualizar
        </button>

        <button style={styles.yellowButton} onClick={removeOfflineChannels}>
          Remover offline
        </button>

        <button style={styles.orangeButton} onClick={removeForeignChannels}>
          Remover estrangeiros
        </button>

        <button style={styles.redButton} onClick={removeAllChannels}>
          Limpar tudo
        </button>
      </div>

      {loading && <div style={styles.loading}>Processando...</div>}

      <div style={styles.info}>
        Exibindo: {filteredChannels.length} | Categoria: {categoryFilter}
      </div>

      <div style={styles.grid}>
        {filteredChannels.map(channel => {
          const category = detectCategory(channel.name)

          return (
            <div key={channel.id} style={styles.card}>
              <div style={styles.categoryBadge}>{category}</div>

              <img
                loading='lazy'
                src={
                  channel.logo?.startsWith('http')
                    ? channel.logo
                    : PLACEHOLDER
                }
                alt={channel.name}
                style={styles.logo}
                onError={e => {
                  e.currentTarget.src = PLACEHOLDER
                }}
              />

              <div style={styles.name}>{channel.name}</div>

              <div style={styles.status}>
                <span
                  style={{
                    color: channel.is_online ? '#22c55e' : '#ef4444'
                  }}
                >
                  ●
                </span>

                <span>{channel.is_online ? 'ONLINE' : 'OFFLINE'}</span>
              </div>

              <button
                style={styles.deleteButton}
                onClick={() => removeChannel(channel.id)}
              >
                Remover
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: '#07142b',
    padding: 20,
    borderRadius: 24
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
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

  xtreamBox: {
    background: '#020617',
    border: '1px solid rgba(56,189,248,0.25)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20
  },

  boxTitle: {
    margin: '0 0 14px 0',
    color: '#38bdf8',
    fontSize: 20
  },

  categories: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 20
  },

  category: {
    background: '#111827',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  activeCategory: {
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    border: 'none',
    padding: '10px 18px',
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

  smallInput: {
    minWidth: 190,
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#020617',
    color: '#fff'
  },

  fileInput: {
    flex: 1,
    minWidth: 300,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(56,189,248,0.25)',
    background: '#020617',
    color: '#fff'
  },

  fileName: {
    color: '#38bdf8',
    fontWeight: 'bold',
    padding: 14
  },

  blueButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  greenButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#22c55e,#16a34a)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  yellowButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#facc15,#eab308)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  orangeButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#fb923c,#ea580c)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  redButton: {
    padding: '14px 18px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  loading: {
    background: '#020617',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  info: {
    background: '#020617',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))',
    gap: 12
  },

  card: {
    background: 'linear-gradient(180deg,#020617,#0f172a)',
    borderRadius: 14,
    padding: 10,
    textAlign: 'center',
    position: 'relative',
    border: '1px solid rgba(255,255,255,0.06)',
    minHeight: 170,
    overflow: 'hidden',
    transition: '0.25s ease'
  },

  categoryBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    background: '#38bdf8',
    color: '#000',
    padding: '3px 7px',
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 'bold'
  },

  logo: {
    width: 58,
    height: 50,
    objectFit: 'contain',
    marginTop: 22,
    marginBottom: 10
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
    justifyContent: 'center',
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
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    cursor: 'pointer'
  }
}

export default AdminChannels