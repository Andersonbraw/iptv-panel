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
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
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
      const res = await axios.get(`${API}/channels?limit=500`, authHeaders)

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
      const res = await axios.get(`${API}/movies`, authHeaders)
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
    const category = item.category?.toLowerCase() || ''
    return !category.includes('series') && !category.includes('séries')
  })

  const onlySeries = movies.filter(item => {
    const category = item.category?.toLowerCase() || ''
    return category.includes('series') || category.includes('séries')
  })

  const filteredMovies = onlyMovies.filter(movie =>
    movie.title?.toLowerCase().includes(movieSearch.toLowerCase())
  )

  const filteredSeries = onlySeries.filter(item =>
    item.title?.toLowerCase().includes(seriesSearch.toLowerCase())
  )

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.logo}>IPTV PANEL</h1>

        <div style={styles.userBox}>
          <small style={{ color: '#94a3b8' }}>CLIENTE</small>
          <h2>{user.name}</h2>
          <p style={styles.plan}>Plano: {user.plan}</p>
        </div>

        <button
          style={page === 'tv' ? styles.activeMenuButton : styles.menuButton}
          onClick={() => setPage('tv')}
        >
          TV ao Vivo
        </button>

        <button
          style={page === 'movies' ? styles.activeMenuButton : styles.menuButton}
          onClick={() => setPage('movies')}
        >
          Filmes
        </button>

        <button
          style={page === 'series' ? styles.activeMenuButton : styles.menuButton}
          onClick={() => setPage('series')}
        >
          Séries
        </button>

        <button style={styles.redButton} onClick={logout}>
          Sair
        </button>
      </aside>

      <main style={styles.main}>
        {page === 'tv' && (
          <>
            <div style={styles.top}>
              <div>
                <h1 style={styles.title}>TV ao Vivo</h1>
                <p style={styles.counter}>
                  Canais disponíveis: {filteredChannels.length}
                </p>
              </div>

              <input
                type="text"
                placeholder="Buscar canal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  <span style={styles.liveBadge}>AO VIVO</span>

                  <h2 style={styles.channelTitle}>
                    {selectedChannel.name}
                  </h2>

                  <p style={styles.category}>
                    {selectedChannel.category || 'TV'}
                  </p>
                </div>
              </section>
            )}

            <div style={styles.grid}>
              {filteredChannels.map(channel => (
                <div
                  key={channel.id}
                  style={
                    selectedChannel?.id === channel.id
                      ? styles.activeCard
                      : styles.card
                  }
                  onClick={() => setSelectedChannel(channel)}
                >
                  <img
                    src={channel.logo}
                    style={styles.channelLogo}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />

                  <div style={styles.channelName}>
                    {channel.name}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'movies' && (
          <>
            <div style={styles.moviesHero}>
              <img
                src="https://image.tmdb.org/t/p/original/5YZbUmjbMa3ClvSW1Wj3D6XGolb.jpg"
                style={styles.movieHeroImage}
              />

              <div style={styles.movieHeroOverlay} />

              <div style={styles.movieHeroContent}>
                <span style={styles.liveBadge}>VOD PREMIUM</span>

                <h1 style={styles.moviesTitle}>Filmes Premium</h1>

                <p style={styles.moviesText}>
                </p>
              </div>
            </div>

            <div style={styles.moviesTop}>
              <div>
                <h2 style={styles.sectionTitle}>Populares</h2>

                <p style={styles.counter}>
                  Filmes disponíveis: {filteredMovies.length}
                </p>
              </div>

              <input
                type="text"
                placeholder="Buscar filme..."
                value={movieSearch}
                onChange={(e) => setMovieSearch(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.moviesGrid}>
              {filteredMovies.map(movie => (
                <div key={movie.id} style={styles.movieCard}>
                  <img
                    src={movie.image}
                    style={styles.movieImage}
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://via.placeholder.com/300x450.png?text=FILME'
                    }}
                  />

                  <div style={styles.movieOverlay}>
                    <span style={styles.movieCategory}>
                      {movie.category || 'Filmes'}
                    </span>

                    <h3 style={styles.movieTitle}>
                      {movie.title}
                    </h3>

                    <p style={styles.movieYear}>
                      {movie.year || 'VOD'}
                    </p>

                    <button
                      style={styles.watchButton}
                      onClick={() => setSelectedMovie(movie)}
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
            <div style={styles.moviesHero}>
              <img
                src="https://image.tmdb.org/t/p/original/9n2tJBplPbgR2ca05hS5CKXwP2c.jpg"
                style={styles.movieHeroImage}
              />

              <div style={styles.movieHeroOverlay} />

              <div style={styles.movieHeroContent}>
                <span style={styles.liveBadge}>SÉRIES PREMIUM</span>

                <h1 style={styles.moviesTitle}>Séries Premium</h1>

                <p style={styles.moviesText}>
                </p>
              </div>
            </div>

            <div style={styles.moviesTop}>
              <div>
                <h2 style={styles.sectionTitle}>Séries</h2>

                <p style={styles.counter}>
                  Séries disponíveis: {filteredSeries.length}
                </p>
              </div>

              <input
                type="text"
                placeholder="Buscar série..."
                value={seriesSearch}
                onChange={(e) => setSeriesSearch(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.moviesGrid}>
              {filteredSeries.map(item => (
                <div key={item.id} style={styles.movieCard}>
                  <img
                    src={item.image}
                    style={styles.movieImage}
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://via.placeholder.com/300x450.png?text=SERIE'
                    }}
                  />

                  <div style={styles.movieOverlay}>
                    <span style={styles.movieCategory}>
                      {item.category || 'Series'}
                    </span>

                    <h3 style={styles.movieTitle}>
                      {item.title}
                    </h3>

                    <p style={styles.movieYear}>
                      {item.year || 'Episódio'}
                    </p>

                    <button
                      style={styles.watchButton}
                      onClick={() => setSelectedMovie(item)}
                    >
                      Assistir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedMovie && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalBox}>
              <button
                style={styles.closeButton}
                onClick={() => setSelectedMovie(null)}
              >
                ✕
              </button>

              <div style={styles.modalBannerWrap}>
                <img
                  src={selectedMovie.banner || selectedMovie.image}
                  style={styles.modalBanner}
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://via.placeholder.com/1280x720.png?text=IPTV'
                  }}
                />

                <div style={styles.modalGradient} />

                <div style={styles.modalBannerContent}>
                  <span style={styles.liveBadge}>PLAYER PREMIUM</span>

                  <h1 style={styles.modalTitle}>
                    {selectedMovie.title}
                  </h1>

                  <p style={styles.modalMeta}>
                    {selectedMovie.year || 'VOD'} • {selectedMovie.category}
                  </p>
                </div>
              </div>

              <div style={styles.modalContent}>
                <p style={styles.modalDescription}>
                  {selectedMovie.description || 'Conteúdo importado via IPTV.'}
                </p>

                <div style={styles.modalPlayerBox}>
                  <HlsPlayer
                    src={selectedMovie.video}
                    style={styles.modalVideo}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
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
    padding: 24,
    overflowX: 'hidden'
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
    background: '#000',
    display: 'block'
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

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
    gap: 8
  },

  card: {
    width: 84,
    height: 120,
    background: 'linear-gradient(180deg, #3b0000 0%, #1a0000 100%)',
    border: '1px solid #7f1d1d',
    borderRadius: 10,
    padding: 7,
    textAlign: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    boxSizing: 'border-box'
  },

  activeCard: {
    width: 84,
    height: 120,
    background: 'linear-gradient(180deg, #0ea5e9 0%, #075985 100%)',
    border: '1px solid #38bdf8',
    borderRadius: 10,
    padding: 7,
    textAlign: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    boxSizing: 'border-box'
  },

  channelLogo: {
    width: 34,
    height: 30,
    objectFit: 'contain'
  },

  channelName: {
    fontSize: 9,
    marginTop: 5,
    lineHeight: '10px'
  },

  moviesHero: {
    position: 'relative',
    height: 330,
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 28
  },

  movieHeroImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },

  movieHeroOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to right, rgba(0,0,0,0.95), rgba(0,0,0,0.35), rgba(0,0,0,0.95))'
  },

  movieHeroContent: {
    position: 'absolute',
    left: 40,
    bottom: 40,
    zIndex: 2
  },

  moviesTitle: {
    fontSize: 52,
    margin: '14px 0'
  },

  moviesText: {
    color: '#cbd5e1'
  },

  moviesTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },

  sectionTitle: {
    fontSize: 28,
    margin: 0
  },

  moviesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
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

  movieCategory: {
    color: '#38bdf8',
    fontSize: 12
  },

  movieTitle: {
    fontSize: 20
  },

  movieYear: {
    color: '#94a3b8'
  },

  watchButton: {
    background: '#ef4444',
    border: 'none',
    padding: 10,
    borderRadius: 10,
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.88)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backdropFilter: 'blur(6px)'
  },

  modalBox: {
    width: '100%',
    maxWidth: 1050,
    height: '86vh',
    background: '#020617',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 0 50px rgba(0,0,0,0.9)'
  },

  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
    zIndex: 20
  },

  modalBannerWrap: {
    position: 'relative',
    height: 210,
    overflow: 'hidden',
    flexShrink: 0
  },

  modalBanner: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },

  modalGradient: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to top, rgba(2,6,23,1), rgba(2,6,23,0.1))'
  },

  modalBannerContent: {
    position: 'absolute',
    left: 30,
    bottom: 20,
    zIndex: 5
  },

  modalContent: {
    flex: 1,
    padding: 22,
    overflow: 'hidden'
  },

  modalTitle: {
    fontSize: 42,
    margin: '10px 0'
  },

  modalMeta: {
    color: '#38bdf8',
    fontSize: 16
  },

  modalDescription: {
    color: '#cbd5e1',
    marginBottom: 16,
    lineHeight: 1.5
  },

  modalPlayerBox: {
    width: '100%',
    height: 'calc(86vh - 330px)',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#000'
  },

  modalVideo: {
    width: '100%',
    height: '100%',
    background: '#000',
    objectFit: 'contain',
    display: 'block'
  }
}

export default ClientPanel