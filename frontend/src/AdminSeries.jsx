import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API =
  'https://api.nexoratvs.shop'

const PLACEHOLDER =
  'https://ui-avatars.com/api/?name=SERIE&background=020617&color=ffffff&size=300'

function AdminSeries() {
  const [series, setSeries] = useState([])
  const [m3uUrl, setM3uUrl] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

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

  async function loadSeries() {
    try {
      setLoading(true)

      const pageSize = 1000
      let offset = 0
      let allItems = []
      let keepLoading = true

      while (keepLoading) {
        const resPage = await axios.get(
          `${API}/movies?limit=${pageSize}&offset=${offset}`,
          authHeaders
        )

        const data = Array.isArray(resPage.data) ? resPage.data : []

        allItems = [...allItems, ...data]

        if (data.length < pageSize) {
          keepLoading = false
        } else {
          offset += pageSize
        }
      }

      const res = { data: allItems }

      const onlySeries = (res.data || []).filter(item => {
        const category = normalize(item.category || '')

        return (
          category.includes('series') ||
          category.includes('séries')
        )
      })

      setSeries(onlySeries)
    } catch (err) {
      console.log(err)
      alert('Erro ao carregar séries')
    } finally {
      setLoading(false)
    }
  }

  async function importSeriesM3U() {
    if (!m3uUrl.trim()) {
      alert('Cole a URL M3U de séries')
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/movies/import-m3u`,
        {
          url: m3uUrl,
          type: 'Series'
        },
        authHeaders
      )

      alert(
        `Importação concluída!\nAdicionados: ${res.data.added || 0}\nIgnorados: ${res.data.skipped || 0}`
      )

      setM3uUrl('')
      await loadSeries()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao importar séries')
    } finally {
      setLoading(false)
    }
  }

  async function removeSerie(id) {
    const confirmDelete = confirm('Remover série/episódio?')

    if (!confirmDelete) return

    try {
      await axios.delete(`${API}/movies/${id}`, authHeaders)

      setSeries(prev =>
        prev.filter(item => item.id !== id)
      )
    } catch {
      alert('Erro ao remover')
    }
  }

  useEffect(() => {
    loadSeries()
  }, [])

  const filteredSeries = useMemo(() => {
    return series.filter(item => {
      const title = normalize(item.title || '')
      const category = normalize(item.category || '')

      const text = `${title} ${category}`

      return text.includes(normalize(search))
    })
  }, [series, search])

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Séries</h1>

          <p style={styles.subtitle}>
            Importar, buscar e remover episódios
          </p>
        </div>

        <input
          placeholder='Buscar série...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.importBox}>
        <h2 style={styles.subTitle}>
          Importar M3U de Séries
        </h2>

        <p style={styles.helpText}>
          Cole aqui o link M3U que contém séries ou episódios.
        </p>

        <div style={styles.importRow}>
          <input
            placeholder='Cole URL M3U de séries'
            value={m3uUrl}
            onChange={e => setM3uUrl(e.target.value)}
            style={styles.input}
          />

          <button
            style={styles.importButton}
            onClick={importSeriesM3U}
            disabled={loading}
          >
            Importar
          </button>
        </div>
      </div>

      {loading && (
        <div style={styles.loading}>
          Processando...
        </div>
      )}

      <div style={styles.totalBox}>
        Exibindo: {filteredSeries.length} de {series.length}
      </div>

      <div style={styles.grid}>
        {filteredSeries.map(item => (
          <div key={item.id} style={styles.card}>
            <img
              loading='lazy'
              src={
                item.image?.startsWith('http')
                  ? item.image
                  : PLACEHOLDER
              }
              alt={item.title}
              style={styles.poster}
              onError={e => {
                e.currentTarget.src = PLACEHOLDER
              }}
            />

            <div style={styles.cardBody}>
              <h3 style={styles.name}>
                {item.title}
              </h3>

              <p style={styles.info}>
                {item.year || 'Série'} • {item.category || 'Series'}
              </p>

              <button
                style={styles.deleteButton}
                onClick={() => removeSerie(item.id)}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 20
  },

  title: {
    fontSize: 38,
    margin: 0
  },

  subtitle: {
    color: '#94a3b8',
    marginTop: 6
  },

  searchInput: {
    width: 280,
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#07142b',
    color: '#fff'
  },

  importBox: {
    background: 'linear-gradient(180deg,#07142b,#020617)',
    padding: 22,
    borderRadius: 22,
    marginBottom: 20,
    border: '1px solid rgba(255,255,255,0.05)'
  },

  subTitle: {
    marginTop: 0,
    fontSize: 24
  },

  helpText: {
    color: '#94a3b8'
  },

  importRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap'
  },

  input: {
    flex: 1,
    minWidth: 280,
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#020617',
    color: '#fff',
    boxSizing: 'border-box'
  },

  importButton: {
    minWidth: 160,
    padding: 14,
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#a855f7,#7e22ce)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  loading: {
    background: '#020617',
    border: '1px solid #12345f',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  totalBox: {
    background: '#020617',
    border: '1px solid #12345f',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
    gap: 20
  },

  card: {
    background: 'linear-gradient(180deg,#07142b,#020617)',
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.05)'
  },

  poster: {
    width: '100%',
    height: 260,
    objectFit: 'cover',
    background: '#020617'
  },

  cardBody: {
    padding: 14
  },

  name: {
    minHeight: 46,
    margin: 0,
    fontSize: 16
  },

  info: {
    color: '#cbd5e1',
    fontSize: 13
  },

  deleteButton: {
    width: '100%',
    padding: 11,
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminSeries