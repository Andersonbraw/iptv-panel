import PlayerModal from './PlayerModal'
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import axios from 'axios'
import Hls from 'hls.js'

const API =
  'https://iptv-backend-cuxf.onrender.com'

const PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'

function HlsPlayer({ src, style }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (!src || !videoRef.current)
      return

    const video = videoRef.current

    let hls = null

    video.pause()

    video.removeAttribute('src')

    video.load()

    if (
      src.includes('.m3u8') &&
      Hls.isSupported()
    ) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      })

      hls.loadSource(src)

      hls.attachMedia(video)

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          video
            .play()
            .catch(() => {})
        }
      )

      hls.on(
        Hls.Events.ERROR,
        (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad()
                break

              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError()
                break

              default:
                hls.destroy()
                break
            }
          }
        }
      )
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

function ClientPanel({
  user,
  setUser,
  logout
}) {
  const [channels, setChannels] =
    useState([])

  const [movies, setMovies] =
    useState([])

  const [
    selectedChannel,
    setSelectedChannel
  ] = useState(null)

  const [
    selectedStream,
    setSelectedStream
  ] = useState(null)

  const [playerOpen, setPlayerOpen] =
    useState(false)

  const [search, setSearch] =
    useState('')

  const [movieSearch, setMovieSearch] =
    useState('')

  const [seriesSearch, setSeriesSearch] =
    useState('')

  const [page, setPage] =
    useState('tv')

  const [loading, setLoading] =
    useState(true)

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

  async function loadChannels() {
    try {
      const res = await axios.get(
        `${API}/channels?limit=500`,
        authHeaders
      )

      setChannels(res.data || [])

      if (
        res.data?.length > 0 &&
        !selectedChannel
      ) {
        setSelectedChannel(
          res.data[0]
        )
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

      setMovies(res.data || [])
    } catch (err) {
      console.log(err)
    }
  }

  async function loadData() {
    try {
      setLoading(true)

      await Promise.all([
        loadChannels(),
        loadMovies()
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredChannels =
    useMemo(() => {
      return channels.filter(channel =>
        normalize(
          channel.name
        ).includes(
          normalize(search)
        )
      )
    }, [channels, search])

  const onlyMovies = useMemo(() => {
    return movies.filter(item => {
      const category =
        normalize(
          item.category || ''
        )

      return (
        !category.includes(
          'series'
        ) &&
        !category.includes(
          'séries'
        )
      )
    })
  }, [movies])

  const onlySeries = useMemo(() => {
    return movies.filter(item => {
      const category =
        normalize(
          item.category || ''
        )

      return (
        category.includes(
          'series'
        ) ||
        category.includes(
          'séries'
        )
      )
    })
  }, [movies])

  const filteredMovies =
    useMemo(() => {
      return onlyMovies.filter(movie =>
        normalize(
          movie.title
        ).includes(
          normalize(movieSearch)
        )
      )
    }, [onlyMovies, movieSearch])

  const filteredSeries =
    useMemo(() => {
      return onlySeries.filter(item =>
        normalize(
          item.title
        ).includes(
          normalize(seriesSearch)
        )
      )
    }, [onlySeries, seriesSearch])

  function openPlayer(item) {
    setSelectedStream({
      title:
        item.title ||
        item.name,
      url:
        item.video ||
        item.url
    })

    setPlayerOpen(true)
  }

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loader}></div>

        <h1>Carregando IPTV...</h1>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.logo}>
          IPTV PANEL
        </h1>

        <div style={styles.userBox}>
          <small
            style={styles.userType}
          >
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
          onClick={() =>
            setPage('tv')
          }
        >
          TV ao Vivo
        </button>

        <button
          style={
            page === 'movies'
              ? styles.activeMenuButton
              : styles.menuButton
          }
          onClick={() =>
            setPage('movies')
          }
        >
          Filmes
        </button>

        <button
          style={
            page === 'series'
              ? styles.activeMenuButton
              : styles.menuButton
          }
          onClick={() =>
            setPage('series')
          }
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
                  {
                    filteredChannels.length
                  }{' '}
                  canais
                </p>
              </div>

              <input
                type='text'
                placeholder='Buscar canal...'
                value={search}
                onChange={e =>
                  setSearch(
                    e.target.value
                  )
                }
                style={styles.input}
              />
            </div>

            {selectedChannel && (
              <section
                style={styles.hero}
              >
                <div
                  style={
                    styles.playerWrap
                  }
                >
                  <HlsPlayer
                    src={
                      selectedChannel.url
                    }
                    style={
                      styles.video
                    }
                  />
                </div>

                <div
                  style={
                    styles.infoBox
                  }
                >
                  <span
                    style={
                      styles.liveBadge
                    }
                  >
                    AO VIVO
                  </span>

                  <h2
                    style={
                      styles.channelTitle
                    }
                  >
                    {
                      selectedChannel.name
                    }
                  </h2>

                  <p
                    style={
                      styles.category
                    }
                  >
                    {selectedChannel.category ||
                      'TV'}
                  </p>
                </div>
              </section>
            )}

            <div style={styles.grid}>
              {filteredChannels.map(
                channel => (
                  <div
                    key={
                      channel.id
                    }
                    style={
                      selectedChannel?.id ===
                      channel.id
                        ? styles.activeCard
                        : styles.card
                    }
                    onClick={() =>
                      setSelectedChannel(
                        channel
                      )
                    }
                  >
                    <img
                      loading='lazy'
                      src={
                        channel.logo ||
                        PLACEHOLDER
                      }
                      alt={
                        channel.name
                      }
                      style={
                        styles.channelLogo
                      }
                      onError={e => {
                        e.currentTarget.src =
                          PLACEHOLDER
                      }}
                    />

                    <div
                      style={
                        styles.channelName
                      }
                    >
                      {
                        channel.name
                      }
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}

        {(page === 'movies' ||
          page === 'series') && (
          <>
            <div
              style={
                styles.moviesTop
              }
            >
              <div>
                <h1
                  style={
                    styles.title
                  }
                >
                  {page ===
                  'movies'
                    ? 'Filmes'
                    : 'Séries'}
                </h1>
              </div>

              <input
                type='text'
                placeholder={
                  page ===
                  'movies'
                    ? 'Buscar filme...'
                    : 'Buscar série...'
                }
                value={
                  page ===
                  'movies'
                    ? movieSearch
                    : seriesSearch
                }
                onChange={e =>
                  page ===
                  'movies'
                    ? setMovieSearch(
                        e.target
                          .value
                      )
                    : setSeriesSearch(
                        e.target
                          .value
                      )
                }
                style={styles.input}
              />
            </div>

            <div
              style={
                styles.moviesGrid
              }
            >
              {(page ===
              'movies'
                ? filteredMovies
                : filteredSeries
              ).map(item => (
                <div
                  key={item.id}
                  style={styles.movieCard}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform =
                      'scale(1.05)'

                    e.currentTarget.style.zIndex = 20

                    e.currentTarget.style.boxShadow =
                      '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                   onMouseLeave={e => {
                     e.currentTarget.style.transform =
                       'scale(1)'

                     e.currentTarget.style.zIndex = 1

                     e.currentTarget.style.boxShadow =
                       '0 0 0 rgba(0,0,0,0)'
                   }}
                 >
                  <img
                    loading='lazy'
                    src={
                      item.image ||
                      PLACEHOLDER
                    }
                    style={
                      styles.movieImage
                    }
                    onError={e => {
                      e.currentTarget.src =
                        PLACEHOLDER
                    }}
                  />

                  <div
                    style={
                      styles.movieOverlay
                    }
                  >
                    <span
                      style={
                        styles.movieCategory
                      }
                    >
                      {item.category ||
                        'VOD'}
                    </span>

                    <h3
                      style={
                        styles.movieTitle
                      }
                    >
                      {
                        item.title
                      }
                    </h3>

                    <button
                      style={
                        styles.watchButton
                      }
                      onClick={() =>
                        openPlayer(
                          item
                        )
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
  loadingPage: {
    width: '100%',
    height: '100vh',
    background: '#000814',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#fff',
    gap: 20
  },

  loader: {
    width: 60,
    height: 60,
    border: '5px solid #0f172a',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%'
  },

  app: {
    display: 'flex',
    minHeight: '100vh',
    background: '#000814',
    color: '#fff',
    fontFamily: 'Arial'
  },

  sidebar: {
    width: 280,
    background: '#021033',
    padding: 20,
    borderRight: '1px solid #10234d',
    display: 'flex',
    flexDirection: 'column'
  },

  logo: {
    color: '#38bdf8',
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 30
  },

  userBox: {
    background: '#0b1736',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20
  },

  userType: {
    color: '#94a3b8'
  },

  plan: {
    color: '#38bdf8'
  },

  menuButton: {
    background: '#07142b',
    border: 'none',
    padding: 14,
    borderRadius: 14,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10
  },

  activeMenuButton: {
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    border: 'none',
    padding: 14,
    borderRadius: 14,
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
    borderRadius: 14,
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
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
    marginBottom: 18,
    gap: 20,
    flexWrap: 'wrap'
  },

  title: {
    fontSize: 34,
    margin: 0
  },

  counter: {
    color: '#94a3b8'
  },

  input: {
    width: 280,
    padding: 14,
    borderRadius: 14,
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

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(90px,1fr))',
    gap: 10
  },

  card: {
    background:
      'linear-gradient(180deg,#1e293b,#0f172a)',
    borderRadius: 12,
    padding: 10,
    textAlign: 'center',
    cursor: 'pointer',
    transition: '0.2s'
  },

  activeCard: {
    background:
      'linear-gradient(180deg,#0ea5e9,#0369a1)',
    borderRadius: 12,
    padding: 10,
    textAlign: 'center',
    cursor: 'pointer'
  },

  channelLogo: {
    width: 40,
    height: 40,
    objectFit: 'contain'
  },

  channelName: {
    fontSize: 10,
    marginTop: 6,
    lineHeight: '12px'
  },

  moviesTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 20,
    flexWrap: 'wrap'
  },

  moviesGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(170px,1fr))',
    gap: 16
  },

  movieCard: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#111827',
    height: 270,
    cursor: 'pointer',
    transition: '0.25s',
    transform: 'scale(1)',
    boxShadow: '0 0 0 rgba(0,0,0,0)'
  },

  movieImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: '0.35s'
  },

  movieOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to top,rgba(0,0,0,0.98),rgba(0,0,0,0.08))',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 14,
    transition: '0.25s'
  },

  movieCategory: {
    color: '#38bdf8',
    fontSize: 12
  },

  movieTitle: {
    fontSize: 16,
    margin: 0,
    lineHeight: '18px',
    minHeight: 36
  },

  watchButton: {
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    border: 'none',
    padding: 10,
    borderRadius: 10,
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 10,
    fontSize: 12
  }
}

export default ClientPanel