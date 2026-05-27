import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function AdminMovies() {
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }

  async function loadMovies() {
    try {
      const res = await axios.get(
        `${API}/movies`,
        authHeaders
      )

      setMovies(res.data)
    } catch (err) {
      console.log(err)
    }
  }

  async function removeMovie(id) {
    if (!confirm('Remover item?')) {
      return
    }

    try {
      await axios.delete(
        `${API}/movies/${id}`,
        authHeaders
      )

      loadMovies()
    } catch {
      alert('Erro ao remover')
    }
  }

  async function clearAllMovies() {
    if (!confirm('APAGAR TODOS OS FILMES E SÉRIES?')) {
      return
    }

    try {
      await axios.delete(
        `${API}/movies-clear`,
        authHeaders
      )

      alert('Tudo removido')

      loadMovies()
    } catch {
      alert('Erro ao limpar')
    }
  }

  async function removeBadMovies() {
  if (!confirm('Remover canais IPTV misturados nos filmes e séries?')) {
    return
  }

  try {
    const badWords = [
      'reuters',
      'trace',
      'trace latina',
      'trace urban',
      'deluxe lounge',
      'shorts',
      'planet',
      'pluto',
      'channel',
      'tv',
      'news',
      'live',
      'ao vivo',
      '24',
      '24h',
      'radio',
      'music',
      'musica',
      'cnn',
      'bbc',
      'fox',
      'sport',
      'sports',
      'futebol',
      'soccer',
      'bein',
      'espn',
      'premiere',
      'combate',
      'telecine',
      'globoplay',
      'sbt',
      'record',
      'band',
      'redetv',
      'sky',
      'playlist',
      'm3u',
      'nba',
      'nfl',
      'ufc',
      'cartoon',
      'nick',
      'mtv',
      'animal planet',
      'discovery channel',
      'nat geo',
      'hd tv',
      '4k tv',
      'sd tv'
    ]

    let removed = 0

    for (const movie of movies) {

      const title = `
        ${movie.title || ''}
        ${movie.name || ''}
        ${movie.category || ''}
      `.toLowerCase()

      const isBad = badWords.some(word =>
        title.includes(word.toLowerCase())
      )

      if (isBad) {

        await axios.delete(
          `${API}/movies/${movie.id}`,
          authHeaders
        )

        removed++
      }
    }

    alert(`Removidos: ${removed}`)

    loadMovies()

  } catch (err) {

    alert(
      err.response?.data?.error ||
      'Erro ao limpar'
    )
  }
}

  useEffect(() => {
    loadMovies()
  }, [])

  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      const title = movie.title?.toLowerCase() || ''
      const category = movie.category?.toLowerCase() || ''

      const matchesSearch =
        title.includes(search.toLowerCase())

      const matchesFilter =
        filter === 'Todos'
          ? true
          : category.includes(filter.toLowerCase())

      return matchesSearch && matchesFilter
    })
  }, [movies, search, filter])

  return (
    <div>
      <h1 style={styles.title}>
        Filmes e Séries
      </h1>

      <div style={styles.topActions}>
        <input
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />

        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={styles.select}
        >
          <option>Todos</option>
          <option>Filmes</option>
          <option>Series</option>
        </select>

        <button
          style={styles.cleanButton}
          onClick={removeBadMovies}
        >
          Remover lixo IPTV
        </button>

        <button
          style={styles.clearButton}
          onClick={clearAllMovies}
        >
          Limpar tudo
        </button>
      </div>

      <div style={styles.totalBox}>
        Total: {filteredMovies.length}
      </div>

      <div style={styles.grid}>
        {filteredMovies.map(movie => (
          <div
            key={movie.id}
            style={styles.card}
          >
            <img
              src={
                movie.image &&
                movie.image.startsWith('http')
                  ? movie.image
                  : 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'
              }
              style={styles.poster}
            />

            <div style={styles.overlay}>
              <h3 style={styles.movieTitle}>
                {movie.title}
              </h3>

              <p style={styles.movieInfo}>
                {movie.year} • {movie.category}
              </p>

              <button
                style={styles.deleteButton}
                onClick={() => removeMovie(movie.id)}
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
  title: {
    fontSize: 38,
    marginBottom: 20
  },

  topActions: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    gap: 12,
    marginBottom: 20
  },

  searchInput: {
    padding: 14,
    borderRadius: 12,
    border: 'none',
    background: '#07142b',
    color: '#fff'
  },

  select: {
    padding: 14,
    borderRadius: 12,
    border: 'none',
    background: '#07142b',
    color: '#fff'
  },

  cleanButton: {
    border: 'none',
    borderRadius: 12,
    background: '#f59e0b',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  clearButton: {
    border: 'none',
    borderRadius: 12,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  totalBox: {
    background: '#020617',
    border: '1px solid #12345f',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 20
  },

  card: {
    background: '#07142b',
    borderRadius: 18,
    overflow: 'hidden'
  },

  poster: {
    width: '100%',
    height: 340,
    objectFit: 'cover',
    background: '#020617'
  },

  overlay: {
    padding: 14
  },

  movieTitle: {
    margin: 0
  },

  movieInfo: {
    color: '#cbd5e1'
  },

  deleteButton: {
    width: '100%',
    padding: 12,
    border: 'none',
    borderRadius: 10,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminMovies