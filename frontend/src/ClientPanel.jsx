import PlayerModal from './PlayerModal'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import Hls from 'hls.js'

const API = 'https://iptv-backend-cuxf.onrender.com'

function HlsPlayer({ src, style }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (!src || !videoRef.current) return

    const video = videoRef.current
    let hls = null

    video.pause()
    video.removeAttribute('src')
    video.load()

    if (src.includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      })

      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })
    } else if (
      video.canPlayType(
        'application/vnd.apple.mpegurl'
      )
    ) {
      video.src = src
      video.play().catch(() => {})
    } else {
      video.src = src
      video.play().catch(() => {})
    }

    return () => {
      if (hls) hls.destroy()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      style={style}
    />
  )
}

function ClientPanel({ user, setUser }) {
  const [channels, setChannels] = useState([])
  const [movies, setMovies] = useState([])

  const [selectedChannel, setSelectedChannel] = useState(null)
  const [selectedMovie, setSelectedMovie] = useState(null)

  const [selectedStream, setSelectedStream] = useState(null)

  const [playerOpen, setPlayerOpen] =
    useState(false)

  const [search, setSearch] = useState('')
  const [movieSearch, setMovieSearch] = useState('')
  const [seriesSearch, setSeriesSearch] = useState('')

  const [page, setPage] = useState('tv')

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  async function loadChannels() {
    try {
      const res = await axios.get(
        `${API}/channels?limit=500`,
        authHeaders
      )

      setChannels(res.data)

      if (res.data.length > 0 && !selectedChannel) {
        setSelectedChannel(res.data[0])
      }
    } catch (err) {
      console.log(err)
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

  useEffect(() => {
    loadChannels()
    loadMovies()
  }, [])

  const filteredChannels = channels.filter(channel =>
    channel.name?.toLowerCase().includes(search.toLowerCase())
  )

  const onlyMovies = movies.filter(item => {
    const category =
      item.category?.toLowerCase() || ''

    return (
      !category.includes('series') &&
      !category.includes('séries')
    )
  })

  const onlySeries = movies.filter(item => {
    const category =
      item.category?.toLowerCase() || ''

    return (
      category.includes('series') ||
      category.includes('séries')
    )
  })

  const filteredMovies = onlyMovies.filter(movie =>
    movie.title?.toLowerCase().includes(
      movieSearch.toLowerCase()
    )
  )

  const filteredSeries = onlySeries.filter(item =>
    item.title?.toLowerCase().includes(
      seriesSearch.toLowerCase()
    )
  )

  function openPlayer(item) {
    setSelectedStream({
      title: item.title || item.name,
      url: item.video || item.url
    })

    setPlayerOpen(true)
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.logo}>
          IPTV PANEL
        </h1>

        <div style={styles.userBox}>
          <small style={{ color: '#94a3b8' }}>
            CLIENTE
          </small>

          <h2>{user.name}</h2>

          <p style={styles.plan}>
            Plano: {user.plan}
          </p>
        </div>

        <button
          style={
            page === 'tv'
              ? styles.activeMenuButton
              : styles.menuButton
          }
          onClick={() => setPage('tv')}
        >
          TV ao Vivo
        </button>

        <button
          style={
            page === 'movies'
              ? styles.activeMenuButton
              : styles.menuButton
          }
          onClick={() => setPage('movies')}
        >
          Filmes
        </button>

        <button
          style={
            page === 'series'
              ? styles.activeMenuButton
              : styles.menuButton
          }
          onClick={() => setPage('series')}
        >
          Séries
        </button>

        <button
          style={styles.redButton}
          onClick={logout}
        >
          Sair
        </button>
      </aside>

      <main style={styles.main}>
        {page === 'tv' && (
          <>
            <div style={styles.top}>
              <div>
                <h1 style={styles.title}>
                  TV ao Vivo
                </h1>

                <p style={styles.counter}>
                  Canais disponíveis:
                  {' '}
                  {filteredChannels.length}
                </p>
              </div>

              <input
                type='text'
                placeholder='Buscar canal...'
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                style={styles.input}
              />
            </div>

            {selectedChannel && (
              <section style={styles.hero}>
                <div style={styles.playerWrap}>
                  <HlsPlayer
                    src={selectedChannel.url}
                    style={styles.video}
                  />
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.liveBadge}>
                    AO VIVO
                  </span>

                  <h2 style={styles.channelTitle}>
                    {selectedChannel.name}
                  </h2>

                  <p style={styles.category}>
                    {selectedChannel.category || 'TV'}
                  </p>
                </div>
              </section>
            )}
          </>
        )}

        {page === 'movies' && (
          <>
            <div style={styles.moviesGrid}>
              {filteredMovies.map(movie => (
                <div
                  key={movie.id}
                  style={styles.movieCard}
                >
                  <img
                    src={movie.image}
                    style={styles.movieImage}
                  />

                  <div style={styles.movieOverlay}>
                    <h3 style={styles.movieTitle}>
                      {movie.title}
                    </h3>

                    <button
                      style={styles.watchButton}
                      onClick={() =>
                        openPlayer(movie)
                      }
                    >
                      Assistir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'series' && (
          <>
            <div style={styles.moviesGrid}>
              {filteredSeries.map(item => (
                <div
                  key={item.id}
                  style={styles.movieCard}
                >
                  <img
                    src={item.image}
                    style={styles.movieImage}
                  />

                  <div style={styles.movieOverlay}>
                    <h3 style={styles.movieTitle}>
                      {item.title}
                    </h3>

                    <button
                      style={styles.watchButton}
                      onClick={() =>
                        openPlayer(item)
                      }
                    >
                      Assistir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <PlayerModal
          open={playerOpen}
          stream={selectedStream}
          onClose={() =>
            setPlayerOpen(false)
          }
        />
      </main>
    </div>
  )
}

const styles = {
  app: {
    display: 'flex',
    minHeight: '100vh',
    background: '#000814',
    color: '#fff',
    fontFamily: 'Arial'
  },

  sidebar: {
    width: 300,
    background: '#021033',
    padding: 20,
    borderRight: '1px solid #10234d',
    display: 'flex',
    flexDirection: 'column'
  },

  logo: {
    color: '#38bdf8',
    fontSize: 38,
    textAlign: 'center',
    marginBottom: 30
  },

  userBox: {
    background: '#0b1736',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20
  },

  plan: {
    color: '#38bdf8'
  },

  menuButton: {
    background: '#07142b',
    border: 'none',
    padding: 14,
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10
  },

  activeMenuButton: {
    background: '#38bdf8',
    border: 'none',
    padding: 14,
    borderRadius: 12,
    color: '#000',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10
  },

  redButton: {
    marginTop: 'auto',
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 12,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  main: {
    flex: 1,
    padding: 24
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },

  title: {
    fontSize: 34,
    margin: 0
  },

  counter: {
    color: '#94a3b8'
  },

  input: {
    width: 260,
    padding: 12,
    borderRadius: 10,
    border: 'none',
    background: '#020617',
    color: '#fff'
  },

  hero: {
    background: '#07142b',
    borderRadius: 24,
    padding: 16,
    marginBottom: 18
  },

  playerWrap: {
    background: '#000',
    borderRadius: 20,
    overflow: 'hidden'
  },

  video: {
    width: '100%',
    height: '65vh',
    objectFit: 'contain',
    background: '#000'
  },

  infoBox: {
    marginTop: 14
  },

  liveBadge: {
    background: '#ef4444',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 'bold'
  },

  channelTitle: {
    fontSize: 28
  },

  category: {
    color: '#38bdf8'
  },

  moviesGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 18
  },

  movieCard: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#111827',
    height: 310
  },

  movieImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },

  movieOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.1))',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 16
  },

  movieTitle: {
    fontSize: 20
  },

  watchButton: {
    background: '#ef4444',
    border: 'none',
    padding: 10,
    borderRadius: 10,
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default ClientPanel