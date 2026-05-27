import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function AdminSeries() {
  const [series, setSeries] = useState([])
  const [m3uUrl, setM3uUrl] = useState('')

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }

  async function loadSeries() {
    try {
      const res = await axios.get(`${API}/movies`, authHeaders)

      const onlySeries = res.data.filter(item =>
        item.category?.toLowerCase().includes('series') ||
        item.category?.toLowerCase().includes('séries')
      )

      setSeries(onlySeries)
    } catch (err) {
      console.log(err)
    }
  }

  async function importSeriesM3U() {
    try {
      if (!m3uUrl) {
        alert('Cole a URL M3U de séries')
        return
      }

      const res = await axios.post(
        `${API}/movies/import-m3u`,
        {
          url: m3uUrl,
          type: 'Series'
        },
        authHeaders
      )

      alert(`Importação concluída!\nAdicionados: ${res.data.added || 0}\nIgnorados: ${res.data.skipped || 0}`)

      setM3uUrl('')
      loadSeries()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao importar séries')
    }
  }

  async function removeSerie(id) {
    if (!confirm('Remover série/episódio?')) return

    try {
      await axios.delete(`${API}/movies/${id}`, authHeaders)
      loadSeries()
    } catch (err) {
      alert('Erro ao remover')
    }
  }

  useEffect(() => {
    loadSeries()
  }, [])

  return (
    <div>
      <h1 style={styles.title}>Séries</h1>

      <div style={styles.importBox}>
        <h2 style={styles.subTitle}>Importar M3U de Séries</h2>

        <p style={styles.helpText}>
          Cole aqui o link M3U que contém séries ou episódios.
        </p>

        <input
          placeholder="Cole URL M3U de séries"
          value={m3uUrl}
          onChange={e => setM3uUrl(e.target.value)}
          style={styles.input}
        />

        <button style={styles.importButton} onClick={importSeriesM3U}>
          Importar séries M3U
        </button>
      </div>

      <div style={styles.totalBox}>
        Total de séries/episódios: {series.length}
      </div>

      <div style={styles.grid}>
        {series.map(item => (
          <div key={item.id} style={styles.card}>
            <img
              src={item.image}
              style={styles.poster}
              onError={(e) => {
                e.currentTarget.src =
                  'https://ui-avatars.com/api/?name=SERIE&background=020617&color=ffffff&size=300'
              }}
            />

            <h3 style={styles.name}>{item.title}</h3>

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
        ))}
      </div>
    </div>
  )
}

const styles = {
  title: {
    fontSize: 36,
    marginBottom: 20
  },

  importBox: {
    background: '#07142b',
    padding: 20,
    borderRadius: 20,
    marginBottom: 25
  },

  subTitle: {
    marginTop: 0,
    fontSize: 24
  },

  helpText: {
    color: '#94a3b8'
  },

  input: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    border: 'none',
    background: '#020617',
    color: '#fff',
    boxSizing: 'border-box'
  },

  importButton: {
    width: '100%',
    marginTop: 12,
    padding: 14,
    border: 'none',
    borderRadius: 12,
    background: '#a855f7',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  totalBox: {
    background: '#020617',
    border: '1px solid #12345f',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 18
  },

  card: {
    background: '#07142b',
    padding: 12,
    borderRadius: 18
  },

  poster: {
    width: '100%',
    height: 240,
    objectFit: 'cover',
    borderRadius: 14,
    background: '#020617'
  },

  name: {
    minHeight: 44
  },

  info: {
    color: '#cbd5e1'
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

export default AdminSeries