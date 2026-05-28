import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API =
  'https://iptv-backend-cuxf.onrender.com'

const PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'

function AdminMovies() {
  const [movies, setMovies] =
    useState([])

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState('Todos')

  const [m3uUrl, setM3uUrl] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const authHeaders = useMemo(() => {
    return {
      headers: {
        Authorization: `Bearer ${localStorage.getItem(
          'token'
        )}`
      }
    }
  }, [])

  function normalize(text = '') {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function cleanGroupTitle(title = '') {
    return title
      .replace(/S\d{1,2}E\d{1,3}/gi, '')
      .replace(/S\d{1,2}\sE\d{1,3}/gi, '')
      .replace(/TEMPORADA\s?\d+/gi, '')
      .replace(/EPISODIO\s?\d+/gi, '')
      .replace(/EPISÓDIO\s?\d+/gi, '')
      .replace(/EP\s?\d+/gi, '')
      .replace(/\(\d{4}\)/g, '')
      .replace(/\[\d{4}\]/g, '')
      .replace(/\s+-\s+\d+$/g, '')
      .replace(/\s+\d+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  async function loadMovies() {
    try {
      setLoading(true)

      const res = await axios.get(
        `${API}/movies`,
        authHeaders
      )

      setMovies(res.data || [])
    } catch (err) {
      console.log(err)

      alert(
        'Erro ao carregar filmes'
      )
    } finally {
      setLoading(false)
    }
  }

  async function importMoviesM3U() {
    if (!m3uUrl.trim()) {
      alert('Cole URL M3U')
      return
    }

    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/movies/import-m3u`,
        {
          url: m3uUrl,
          type: 'Filmes'
        },
        authHeaders
      )

      alert(
        `Importados: ${res.data.added || 0}`
      )

      setM3uUrl('')

      await loadMovies()
    } catch (err) {
      alert(
        err.response?.data
          ?.error ||
          'Erro ao importar filmes'
      )
    } finally {
      setLoading(false)
    }
  }

  async function removeMovie(id) {
    const confirmDelete = confirm(
      'Remover item?'
    )

    if (!confirmDelete) return

    try {
      await axios.delete(
        `${API}/movies/${id}`,
        authHeaders
      )

      setMovies(prev =>
        prev.filter(
          movie =>
            movie.id !== id
        )
      )
    } catch {
      alert('Erro ao remover')
    }
  }

  async function clearAllMovies() {
    const confirmDelete = confirm(
      'APAGAR TODOS OS FILMES E SÉRIES?'
    )

    if (!confirmDelete) return

    try {
      setLoading(true)

      await axios.delete(
        `${API}/movies-clear`,
        authHeaders
      )

      alert('Tudo removido')

      setMovies([])
    } catch {
      alert('Erro ao limpar')
    } finally {
      setLoading(false)
    }
  }

  async function removeBadMovies() {
    const confirmDelete = confirm(
      'Remover conteúdos IPTV misturados?'
    )

    if (!confirmDelete) return

    try {
      setLoading(true)

      const badWords = [
        'reuters',
        'trace',
        'pluto',
        'channel',
        'tv',
        'news',
        'live',
        'ao vivo',
        'radio',
        'music',
        'cnn',
        'bbc',
        'fox',
        'sport',
        'sports',
        'futebol',
        'espn',
        'premiere',
        'combate',
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
        'nat geo'
      ]

      const toRemove =
        movies.filter(movie => {
          const text = normalize(`
            ${movie.title || ''}
            ${movie.name || ''}
            ${movie.category || ''}
          `)

          return badWords.some(
            word =>
              text.includes(
                normalize(word)
              )
          )
        })

      await Promise.all(
        toRemove.map(movie =>
          axios.delete(
            `${API}/movies/${movie.id}`,
            authHeaders
          )
        )
      )

      alert(
        `Removidos: ${toRemove.length}`
      )

      await loadMovies()
    } catch (err) {
      alert(
        err.response?.data
          ?.error ||
          'Erro ao limpar'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMovies()
  }, [])

  const filteredMovies =
    useMemo(() => {
      const grouped = {}

      movies.forEach(movie => {
        const originalTitle =
          movie.title || ''

        const cleanTitle =
          cleanGroupTitle(
            originalTitle
          )

        const normalizedTitle =
          normalize(
            cleanTitle ||
              originalTitle
          )

        const category =
          normalize(
            movie.category || ''
          )

        const matchesSearch =
          normalizedTitle.includes(
            normalize(search)
          ) ||
          normalize(
            originalTitle
          ).includes(
            normalize(search)
          )

        const matchesFilter =
          filter === 'Todos'
            ? true
            : category.includes(
                normalize(filter)
              )

        if (
          !matchesSearch ||
          !matchesFilter
        ) {
          return
        }

        if (
          !grouped[
            normalizedTitle
          ]
        ) {
          grouped[
            normalizedTitle
          ] = {
            ...movie,
            title:
              cleanTitle ||
              originalTitle,
            episodes: 1,
            ids: [movie.id]
          }
        } else {
          grouped[
            normalizedTitle
          ].episodes++

          grouped[
            normalizedTitle
          ].ids.push(movie.id)
        }
      })

      return Object.values(grouped)
    }, [movies, search, filter])

  return (
    <div>
      <div style={styles.top}>
        <div>
          <h1 style={styles.title}>
            Filmes e Séries
          </h1>

          <p style={styles.subtitle}>
            Gerencie conteúdos VOD
          </p>
        </div>
      </div>

      <div style={styles.importBox}>
        <input
          placeholder='Cole URL M3U Filmes/Séries...'
          value={m3uUrl}
          onChange={e =>
            setM3uUrl(
              e.target.value
            )
          }
          style={styles.importInput}
        />

        <button
          style={styles.importButton}
          onClick={
            importMoviesM3U
          }
        >
          Importar M3U
        </button>

        <button
          style={styles.updateButton}
          onClick={loadMovies}
        >
          Atualizar
        </button>
      </div>

      <div style={styles.topActions}>
        <input
          placeholder='Buscar...'
          value={search}
          onChange={e =>
            setSearch(
              e.target.value
            )
          }
          style={styles.searchInput}
        />

        <select
          value={filter}
          onChange={e =>
            setFilter(
              e.target.value
            )
          }
          style={styles.select}
        >
          <option>
            Todos
          </option>

          <option>
            Filmes
          </option>

          <option>
            Series
          </option>
        </select>

        <button
          style={
            styles.cleanButton
          }
          onClick={
            removeBadMovies
          }
        >
          Limpar IPTV
        </button>

        <button
          style={
            styles.clearButton
          }
          onClick={
            clearAllMovies
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

      <div style={styles.totalBox}>
        Total agrupado:{' '}
        {
          filteredMovies.length
        }{' '}
        | Itens reais:{' '}
        {
          movies.length
        }
      </div>

      <div style={styles.grid}>
        {filteredMovies.map(
          movie => (
            <div
              key={movie.id}
              style={styles.card}
            >
              {movie.episodes > 1 && (
                <div style={styles.episodeBadge}>
                  {movie.episodes} episódios
                </div>
              )}

              <img
                loading='lazy'
                src={
                  movie.image?.startsWith(
                    'http'
                  )
                    ? movie.image
                    : PLACEHOLDER
                }
                alt={
                  movie.title
                }
                style={
                  styles.poster
                }
                onError={e => {
                  e.currentTarget.src =
                    PLACEHOLDER
                }}
              />

              <div
                style={
                  styles.overlay
                }
              >
                <div>
                  <h3
                    style={
                      styles.movieTitle
                    }
                  >
                    {
                      movie.title
                    }
                  </h3>

                  <p
                    style={
                      styles.movieInfo
                    }
                  >
                    {movie.year ||
                      'VOD'}{' '}
                    •{' '}
                    {movie.category ||
                      'Filmes'}

                    {movie.episodes >
                      1 && (
                      <>
                        {' '}
                        •{' '}
                        {
                          movie.episodes
                        } episódios
                      </>
                    )}
                  </p>
                </div>

                <button
                  style={
                    styles.deleteButton
                  }
                  onClick={() =>
                    removeMovie(
                      movie.id
                    )
                  }
                >
                  Remover
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

const styles = {
  top: {
    marginBottom: 20
  },

  title: {
    fontSize: 38,
    marginBottom: 6
  },

  subtitle: {
    color: '#94a3b8'
  },

  importBox: {
    display: 'grid',
    gridTemplateColumns:
      '2fr 180px 180px',
    gap: 12,
    marginBottom: 20
  },

  importInput: {
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#07142b',
    color: '#fff'
  },

  importButton: {
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  updateButton: {
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  topActions: {
    display: 'grid',
    gridTemplateColumns:
      '2fr 1fr 1fr 1fr',
    gap: 12,
    marginBottom: 20
  },

  searchInput: {
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#07142b',
    color: '#fff'
  },

  select: {
    padding: 14,
    borderRadius: 14,
    border: 'none',
    background: '#07142b',
    color: '#fff'
  },

  cleanButton: {
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#f59e0b,#d97706)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  clearButton: {
    border: 'none',
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  loading: {
    background: '#020617',
    border:
      '1px solid #12345f',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  totalBox: {
    background: '#020617',
    border:
      '1px solid #12345f',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(165px,1fr))',
    gap: 14
  },

  card: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#020617',
    border:
      '1px solid rgba(255,255,255,0.05)',
    transition: '0.25s',
    cursor: 'pointer'
  },

  episodeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 4,
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    padding: '5px 8px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 'bold'
  },

  poster: {
    width: '100%',
    height: 250,
    objectFit: 'cover',
    background: '#020617',
    display: 'block'
  },

  overlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to top,rgba(0,0,0,0.95),rgba(0,0,0,0.15))',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 12,
    opacity: 0.95
  },

  movieTitle: {
    margin: 0,
    fontSize: 16,
    lineHeight: '18px',
    minHeight: 36
  },

  movieInfo: {
    color: '#cbd5e1',
    marginTop: 5,
    fontSize: 12
  },

  deleteButton: {
    width: '100%',
    padding: 9,
    border: 'none',
    borderRadius: 10,
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 10,
    fontSize: 12
  }
}

export default AdminMovies