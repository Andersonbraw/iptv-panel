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

function proxyStreamUrl(url = '') {
  if (!url) return ''

  if (String(url).startsWith(`${API}/proxy-stream`)) {
    return url
  }

  return `${API}/proxy-stream?url=${encodeURIComponent(url)}`
}

function HlsPlayer({ src, style }) {
  const videoRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src || !videoRef.current) return

    const video = videoRef.current
    let hls = null
    let timeout = null

    setLoading(true)
    setError(false)

    video.pause()
    video.removeAttribute('src')
    video.load()

    timeout = setTimeout(() => {
      setLoading(false)
      setError(true)
    }, 15000)

    function ready() {
      clearTimeout(timeout)
      setLoading(false)
      setError(false)
    }

    function failed() {
      clearTimeout(timeout)
      setLoading(false)
      setError(true)
    }

    if (src.includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      })

      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        ready()
        video.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break

            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break

            default:
              failed()
              hls.destroy()
              break
          }
        }
      })
    } else {
      video.src = src

      video.onloadeddata = () => {
        ready()
      }

      video.onerror = () => {
        failed()
      }

      video.play().catch(() => {})
    }

    return () => {
      clearTimeout(timeout)
      if (hls) hls.destroy()
    }
  }, [src])

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div style={styles.playerLoading}>
          <div style={styles.playerSpinner} />

          <h2 style={{ color: '#fff', margin: 0 }}>
            Carregando canal...
          </h2>
        </div>
      )}

      {error && (
        <div style={styles.playerError}>
          <h2 style={styles.playerErrorTitle}>
            Canal offline
          </h2>

          <p style={{ color: '#cbd5e1' }}>
            Este canal pode estar indisponível.
          </p>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        style={style}
      />
    </div>
  )
}

function ClientPanel({
  user,
  setUser,
  logout
}) {
  const [channels, setChannels] = useState([])
  const [movies, setMovies] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [selectedStream, setSelectedStream] = useState(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [movieSearch, setMovieSearch] = useState('')
  const [seriesSearch, setSeriesSearch] = useState('')
  const [page, setPage] = useState('tv')
  const [loading, setLoading] = useState(true)
  const [episodesModal, setEpisodesModal] = useState(false)
  const [selectedEpisodes, setSelectedEpisodes] = useState([])
  const [selectedSeriesTitle, setSelectedSeriesTitle] = useState('')
  const [selectedSeason, setSelectedSeason] = useState('1')
  const [currentWatching, setCurrentWatching] = useState(null)
  const [focusedKey, setFocusedKey] = useState('menu-tv')

  const authHeaders = useMemo(() => {
    return {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    }
  }, [])

  function handleLogout() {
    if (logout) {
      logout()
      return
    }

    localStorage.removeItem('token')
    localStorage.removeItem('user')

    if (setUser) {
      setUser(null)
    }
  }

  function normalize(text = '') {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function focusStyle(key, baseStyle) {
    if (focusedKey !== key) return baseStyle

    return {
      ...baseStyle,
      outline: '3px solid #38bdf8',
      outlineOffset: 3,
      boxShadow: '0 0 28px rgba(56,189,248,0.75)',
      transform: 'scale(1.06)',
      zIndex: 30
    }
  }

  function tvFocusable(key, action) {
    return {
      tabIndex: 0,
      role: 'button',
      onFocus: () => setFocusedKey(key),
      onBlur: () => setFocusedKey(''),
      onKeyDown: event => {
        const keyName = event.key

        if (
          keyName === 'Enter' ||
          keyName === 'NumpadEnter' ||
          keyName === ' '
        ) {
          event.preventDefault()

          if (action) {
            action()
          }
        }
      }
    }
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

  function getSeasonNumber(title = '') {
    const match =
      title.match(/S(\d{1,2})E\d{1,3}/i) ||
      title.match(/TEMPORADA\s?(\d{1,2})/i)

    return match ? String(Number(match[1])) : '1'
  }

  function getEpisodeNumber(title = '') {
    const match =
      title.match(/S\d{1,2}E(\d{1,3})/i) ||
      title.match(/EPISODIO\s?(\d{1,3})/i) ||
      title.match(/EPISÓDIO\s?(\d{1,3})/i) ||
      title.match(/EP\s?(\d{1,3})/i)

    return match ? Number(match[1]) : 9999
  }

  async function reportWatching(title, type) {
    const watchingData = {
      title: title || '',
      type: type || ''
    }

    setCurrentWatching(watchingData)

    try {
      await axios.post(
        `${API}/watching`,
        watchingData,
        authHeaders
      )
    } catch (err) {
      console.log('ERRO WATCHING:', err)
    }
  }

  async function clearWatching() {
    setCurrentWatching(null)

    try {
      await axios.post(
        `${API}/watching`,
        {
          title: '',
          type: ''
        },
        authHeaders
      )
    } catch (err) {
      console.log('ERRO CLEAR WATCHING:', err)
    }
  }

  async function loadChannels() {
    try {
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

      if (allChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(allChannels[0])
      }
    } catch (err) {
      console.log(err)
    }
  }

  async function loadMovies() {
    try {
      const pageSize = 1000
      let offset = 0
      let allItems = []
      let keepLoading = true

      while (keepLoading) {
        const res = await axios.get(
          `${API}/movies?limit=${pageSize}&offset=${offset}`,
          authHeaders
        )

        const data = Array.isArray(res.data) ? res.data : []

        allItems = [...allItems, ...data]

        if (data.length < pageSize) {
          keepLoading = false
        } else {
          offset += pageSize
        }
      }

      setMovies(allItems)
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

  useEffect(() => {
    function handleRemoteBack(event) {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return

      if (playerOpen) {
        event.preventDefault()
        closePlayer()
        return
      }

      if (episodesModal) {
        event.preventDefault()
        setEpisodesModal(false)
        return
      }

      if (page !== 'tv') {
        event.preventDefault()
        setPage('tv')
      }
    }

    window.addEventListener('keydown', handleRemoteBack)

    return () => {
      window.removeEventListener('keydown', handleRemoteBack)
    }
  }, [playerOpen, episodesModal, page])

  useEffect(() => {
    if (!currentWatching?.title) return

    const interval = setInterval(() => {
      axios.post(
        `${API}/watching`,
        currentWatching,
        authHeaders
      ).catch(err =>
        console.log('ERRO WATCHING HEARTBEAT:', err)
      )
    }, 30000)

    return () => clearInterval(interval)
  }, [currentWatching, authHeaders])

  useEffect(() => {
    if (!selectedChannel || page !== 'tv') return

    reportWatching(
      selectedChannel.name,
      'Canal'
    )

    const interval = setInterval(() => {
      reportWatching(
        selectedChannel.name,
        'Canal'
      )
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedChannel, page])

  const filteredChannels = useMemo(() => {
    return channels.filter(channel =>
      normalize(channel.name).includes(
        normalize(search)
      )
    )
  }, [channels, search])

  const onlyMovies = useMemo(() => {
    return movies.filter(item => {
      const category = normalize(item.category || '')

      return (
        !category.includes('series') &&
        !category.includes('séries')
      )
    })
  }, [movies])

  const onlySeries = useMemo(() => {
    return movies.filter(item => {
      const category = normalize(item.category || '')

      return (
        category.includes('series') ||
        category.includes('séries')
      )
    })
  }, [movies])

  const filteredMovies = useMemo(() => {
    const grouped = {}

    onlyMovies.forEach(movie => {
      const originalTitle = movie.title || ''
      const cleanTitle = cleanGroupTitle(originalTitle)
      const normalizedTitle = normalize(cleanTitle || originalTitle)

      const matchesSearch =
        normalizedTitle.includes(normalize(movieSearch)) ||
        normalize(originalTitle).includes(normalize(movieSearch))

      if (!matchesSearch) return

      if (!grouped[normalizedTitle]) {
        grouped[normalizedTitle] = {
          ...movie,
          title: cleanTitle || originalTitle,
          episodes: 1,
          episodeList: [movie]
        }
      } else {
        grouped[normalizedTitle].episodes++
        grouped[normalizedTitle].episodeList.push(movie)
      }
    })

    return Object.values(grouped)
  }, [onlyMovies, movieSearch])

  const filteredSeries = useMemo(() => {
    const grouped = {}

    onlySeries.forEach(item => {
      const originalTitle = item.title || ''
      const cleanTitle = cleanGroupTitle(originalTitle)
      const normalizedTitle = normalize(cleanTitle || originalTitle)

      const matchesSearch =
        normalizedTitle.includes(normalize(seriesSearch)) ||
        normalize(originalTitle).includes(normalize(seriesSearch))

      if (!matchesSearch) return

      const episodeItem = {
        ...item,
        season: getSeasonNumber(originalTitle),
        episodeNumber: getEpisodeNumber(originalTitle)
      }

      if (!grouped[normalizedTitle]) {
        grouped[normalizedTitle] = {
          ...item,
          title: cleanTitle || originalTitle,
          episodes: 1,
          episodeList: [episodeItem]
        }
      } else {
        grouped[normalizedTitle].episodes++
        grouped[normalizedTitle].episodeList.push(episodeItem)
      }
    })

    return Object.values(grouped).map(item => ({
      ...item,
      episodeList: item.episodeList.sort((a, b) => {
        if (Number(a.season) !== Number(b.season)) {
          return Number(a.season) - Number(b.season)
        }

        return a.episodeNumber - b.episodeNumber
      })
    }))
  }, [onlySeries, seriesSearch])

  const seasons = useMemo(() => {
    const found = new Set()

    selectedEpisodes.forEach(ep => {
      found.add(ep.season || '1')
    })

    return Array.from(found).sort(
      (a, b) => Number(a) - Number(b)
    )
  }, [selectedEpisodes])

  const episodesBySeason = useMemo(() => {
    return selectedEpisodes
      .filter(ep =>
        String(ep.season || '1') === String(selectedSeason)
      )
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
  }, [selectedEpisodes, selectedSeason])

  async function openPlayer(item) {
    const title =
      item.title ||
      item.name ||
      'Conteúdo'

    const type =
      page === 'movies'
        ? 'Filme'
        : page === 'series'
        ? 'Série'
        : 'Canal'

    await reportWatching(title, type)

    const rawStreamUrl =
      item.video ||
      item.url ||
      ''

    setSelectedStream({
      title: item.title || item.name,
      url: proxyStreamUrl(rawStreamUrl)
    })

    setPlayerOpen(true)
  }

  async function selectChannel(channel) {
    setSelectedChannel(channel)

    await reportWatching(
      channel.name,
      'Canal'
    )
  }

  function chooseEpisode(item) {
    if (item.episodeList && item.episodeList.length > 1) {
      const firstSeason = item.episodeList[0]?.season || '1'

      setSelectedEpisodes(item.episodeList)
      setSelectedSeriesTitle(item.title)
      setSelectedSeason(firstSeason)
      setEpisodesModal(true)
      return
    }

    openPlayer(item)
  }

  function closePlayer() {
    setPlayerOpen(false)
    setSelectedStream(null)
    clearWatching()
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
          <small style={styles.userType}>
            CLIENTE
          </small>

          <h2>{user.name}</h2>

          <p style={styles.plan}>
            Plano: {user.plan}
          </p>
        </div>

        <button
          {...tvFocusable('menu-tv', () => setPage('tv'))}
          style={focusStyle(
            'menu-tv',
            page === 'tv'
              ? styles.activeMenuButton
              : styles.menuButton
          )}
          onClick={() => setPage('tv')}
        >
          TV ao Vivo
        </button>

        <button
          {...tvFocusable('menu-movies', () => setPage('movies'))}
          style={focusStyle(
            'menu-movies',
            page === 'movies'
              ? styles.activeMenuButton
              : styles.menuButton
          )}
          onClick={() => setPage('movies')}
        >
          Filmes
        </button>

        <button
          {...tvFocusable('menu-series', () => setPage('series'))}
          style={focusStyle(
            'menu-series',
            page === 'series'
              ? styles.activeMenuButton
              : styles.menuButton
          )}
          onClick={() => setPage('series')}
        >
          Séries
        </button>

        <button
          {...tvFocusable('menu-logout', handleLogout)}
          style={focusStyle('menu-logout', styles.redButton)}
          onClick={handleLogout}
        >
          Sair
        </button>
      </aside>

      <main style={styles.main}>
        {page === 'tv' && (
          <div style={styles.tvLayout}>
            <section style={styles.tvListPanel}>
              <div style={styles.tvListHeader}>
                <div>
                  <h1 style={styles.tvTitle}>TV ao Vivo</h1>

                  <p style={styles.tvCounter}>
                    {filteredChannels.length} canais carregados
                  </p>
                </div>

                <input
                  type='text'
                  placeholder='Buscar canal...'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={styles.tvSearchInput}
                />
              </div>

              <div style={styles.channelList}>
                {filteredChannels.map((channel, index) => {
                  const key = `channel-list-${channel.id}`

                  return (
                    <div
                      key={channel.id}
                      {...tvFocusable(key, () => selectChannel(channel))}
                      style={focusStyle(
                        key,
                        selectedChannel?.id === channel.id
                          ? styles.activeChannelRow
                          : styles.channelRow
                      )}
                      onClick={() => selectChannel(channel)}
                    >
                      <div style={styles.channelNumber}>
                        {index + 1}
                      </div>

                      <img
                        loading='lazy'
                        src={channel.logo || PLACEHOLDER}
                        alt={channel.name}
                        style={styles.channelListLogo}
                        onError={e => {
                          e.currentTarget.src = PLACEHOLDER
                        }}
                      />

                      <div style={styles.channelRowText}>
                        <strong style={styles.channelRowTitle}>
                          {channel.name}
                        </strong>

                        <span style={styles.channelRowSub}>
                          {channel.category || 'TV'} • ENTER para assistir
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section style={styles.tvPlayerPanel}>
              {selectedChannel ? (
                <>
                  <div style={styles.tvPlayerTop}>
                    <div>
                      <span style={styles.liveBadge}>AO VIVO</span>

                      <h2 style={styles.tvPlayerTitle}>
                        {selectedChannel.name}
                      </h2>

                      <p style={styles.tvPlayerSub}>
                        {selectedChannel.category || 'TV ao vivo'}
                      </p>
                    </div>

                    <button
                      {...tvFocusable(
                        'watch-selected-channel',
                        () => selectChannel(selectedChannel)
                      )}
                      style={focusStyle(
                        'watch-selected-channel',
                        styles.bigWatchButton
                      )}
                      onClick={() => selectChannel(selectedChannel)}
                    >
                      Assistir
                    </button>
                  </div>

                  <div style={styles.playerWrapLarge}>
                    <HlsPlayer
                      src={proxyStreamUrl(selectedChannel.url)}
                      style={styles.videoLarge}
                    />
                  </div>
                </>
              ) : (
                <div style={styles.emptyPlayer}>
                  Escolha um canal na lista
                </div>
              )}
            </section>
          </div>
        )}

        {(page === 'movies' || page === 'series') && (
          <>
            <div style={styles.moviesTop}>
              <div>
                <h1 style={styles.title}>
                  {page === 'movies' ? 'Filmes' : 'Séries'}
                </h1>

                <p style={styles.counter}>
                  {page === 'movies'
                    ? filteredMovies.length
                    : filteredSeries.length}{' '}
                  títulos
                </p>
              </div>

              <input
                type='text'
                placeholder={
                  page === 'movies'
                    ? 'Buscar filme...'
                    : 'Buscar série...'
                }
                value={
                  page === 'movies'
                    ? movieSearch
                    : seriesSearch
                }
                onChange={e =>
                  page === 'movies'
                    ? setMovieSearch(e.target.value)
                    : setSeriesSearch(e.target.value)
                }
                style={styles.input}
              />
            </div>

            <div style={styles.moviesGrid}>
              {(page === 'movies'
                ? filteredMovies
                : filteredSeries
              ).map(item => (
                <div
                  key={item.id}
                  {...tvFocusable(
                    `${page}-${item.id}`,
                    () => chooseEpisode(item)
                  )}
                  style={focusStyle(`${page}-${item.id}`, styles.movieCard)}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.zIndex = 20
                    e.currentTarget.style.boxShadow =
                      '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.zIndex = 1
                    e.currentTarget.style.boxShadow =
                      '0 0 0 rgba(0,0,0,0)'
                  }}
                  onClick={() => chooseEpisode(item)}
                >
                  {item.episodes > 1 && (
                    <div style={styles.episodeBadge}>
                      {item.episodes} episódios
                    </div>
                  )}

                  <img
                    loading='lazy'
                    src={item.image || PLACEHOLDER}
                    style={styles.movieImage}
                    onError={e => {
                      e.currentTarget.src = PLACEHOLDER
                    }}
                  />

                  <div style={styles.movieOverlay}>
                    <span style={styles.movieCategory}>
                      {item.category || 'VOD'}
                    </span>

                    <h3 style={styles.movieTitle}>
                      {item.title}
                    </h3>

                    <button
                      {...tvFocusable(
                        `watch-${page}-${item.id}`,
                        () => chooseEpisode(item)
                      )}
                      style={focusStyle(
                        `watch-${page}-${item.id}`,
                        styles.watchButton
                      )}
                      onClick={event => {
                        event.stopPropagation()
                        chooseEpisode(item)
                      }}
                    >
                      {item.episodes > 1
                        ? 'Episódios'
                        : 'Assistir'}
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
          onClose={closePlayer}
        />

        {episodesModal && (
          <div style={styles.episodesOverlay}>
            <div style={styles.episodesModal}>
              <div style={styles.episodesHeader}>
                <div>
                  <h2 style={{ margin: 0 }}>
                    {selectedSeriesTitle}
                  </h2>

                  <p style={styles.episodesCounter}>
                    {selectedEpisodes.length} episódios
                  </p>
                </div>

                <button
                  {...tvFocusable('episodes-close', () => setEpisodesModal(false))}
                  style={focusStyle(
                    'episodes-close',
                    styles.closeEpisodesButton
                  )}
                  onClick={() => setEpisodesModal(false)}
                >
                  ✕
                </button>
              </div>

              <div style={styles.seasonTabs}>
                {seasons.map(season => (
                  <button
                    key={season}
                    {...tvFocusable(
                      `season-${season}`,
                      () => setSelectedSeason(season)
                    )}
                    style={focusStyle(
                      `season-${season}`,
                      String(selectedSeason) === String(season)
                        ? styles.activeSeasonButton
                        : styles.seasonButton
                    )}
                    onClick={() => setSelectedSeason(season)}
                  >
                    Temporada {season}
                  </button>
                ))}
              </div>

              <div style={styles.episodesList}>
                {episodesBySeason.map((ep, index) => (
                  <button
                    key={`${ep.id}-${index}`}
                    {...tvFocusable(
                      `episode-${ep.id}-${index}`,
                      () => {
                        openPlayer(ep)
                        setEpisodesModal(false)
                      }
                    )}
                    style={focusStyle(
                      `episode-${ep.id}-${index}`,
                      styles.episodeItem
                    )}
                    onClick={() => {
                      openPlayer(ep)
                      setEpisodesModal(false)
                    }}
                  >
                    <span>
                      Episódio{' '}
                      {ep.episodeNumber !== 9999
                        ? ep.episodeNumber
                        : index + 1}
                    </span>

                    <small>
                      {ep.title}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const styles = {
  tvLayout: {
    display: 'grid',
    gridTemplateColumns: '420px 1fr',
    gap: 16,
    height: 'calc(100vh - 36px)'
  },

  tvListPanel: {
    background: 'linear-gradient(180deg,#07142b,#020617)',
    borderRadius: 22,
    border: '1px solid rgba(56,189,248,0.16)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },

  tvListHeader: {
    padding: 16,
    borderBottom: '1px solid rgba(56,189,248,0.14)'
  },

  tvTitle: {
    fontSize: 28,
    margin: 0,
    fontWeight: '900'
  },

  tvCounter: {
    color: '#94a3b8',
    margin: '6px 0 14px 0',
    fontSize: 13
  },

  tvSearchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 13,
    borderRadius: 14,
    border: 'none',
    background: '#020617',
    color: '#fff',
    outline: 'none'
  },

  channelList: {
    flex: 1,
    overflowY: 'auto',
    padding: 10
  },

  channelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#0b1736',
    border: '2px solid #111827',
    borderRadius: 14,
    padding: 9,
    marginBottom: 8,
    cursor: 'pointer',
    transition: '0.15s ease'
  },

  activeChannelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#0f2a4a',
    border: '2px solid #38bdf8',
    borderRadius: 14,
    padding: 9,
    marginBottom: 8,
    cursor: 'pointer',
    transition: '0.15s ease',
    boxShadow: '0 0 18px rgba(56,189,248,0.35)'
  },

  channelNumber: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    background: '#020617',
    color: '#facc15',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
    fontSize: 12
  },

  channelListLogo: {
    width: 42,
    height: 42,
    objectFit: 'contain',
    background: '#020617',
    borderRadius: 10
  },

  channelRowText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3
  },

  channelRowTitle: {
    color: '#fff',
    fontSize: 14,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  channelRowSub: {
    color: '#94a3b8',
    fontSize: 11,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  tvPlayerPanel: {
    background: 'linear-gradient(180deg,#07142b,#000)',
    borderRadius: 22,
    border: '1px solid rgba(56,189,248,0.16)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },

  tvPlayerTop: {
    minHeight: 105,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    borderBottom: '1px solid rgba(56,189,248,0.14)'
  },

  tvPlayerTitle: {
    fontSize: 28,
    margin: '12px 0 4px 0'
  },

  tvPlayerSub: {
    color: '#38bdf8',
    margin: 0,
    fontWeight: 'bold'
  },

  bigWatchButton: {
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    border: 'none',
    borderRadius: 16,
    padding: '16px 28px',
    fontWeight: '900',
    cursor: 'pointer',
    fontSize: 16
  },

  playerWrapLarge: {
    flex: 1,
    background: '#000'
  },

  videoLarge: {
    width: '100%',
    height: '100%',
    minHeight: 'calc(100vh - 180px)',
    objectFit: 'contain',
    background: '#000'
  },

  emptyPlayer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: 24,
    fontWeight: '900'
  },

  playerLoading: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.82)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    gap: 18
  },

  playerSpinner: {
    width: 60,
    height: 60,
    border: '5px solid #0f172a',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },

  playerError: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
    color: '#fff',
    gap: 15
  },

  playerErrorTitle: {
    margin: 0,
    color: '#ef4444'
  },

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
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },

  app: {
    display: 'flex',
    minHeight: '100vh',
    background: 'linear-gradient(180deg,#000814,#020617)',
    color: '#fff',
    fontFamily: 'Arial'
  },

  sidebar: {
    width: 260,
    background: 'linear-gradient(180deg,#021033,#000814)',
    padding: 18,
    borderRight: '1px solid rgba(56,189,248,0.15)',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh'
  },

  logo: {
    color: '#38bdf8',
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold'
  },

  userBox: {
    background: 'rgba(15,23,42,0.95)',
    padding: 18,
    borderRadius: 20,
    marginBottom: 20,
    border: '1px solid rgba(56,189,248,0.12)'
  },

  userType: {
    color: '#94a3b8',
    fontSize: 12
  },

  plan: {
    color: '#38bdf8'
  },

  menuButton: {
    background: '#07142b',
    border: 'none',
    padding: 13,
    borderRadius: 14,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10,
    transition: '0.2s'
  },

  activeMenuButton: {
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    border: 'none',
    padding: 13,
    borderRadius: 14,
    color: '#000',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10,
    boxShadow: '0 0 20px rgba(56,189,248,0.35)'
  },

  redButton: {
    marginTop: 'auto',
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  main: {
    flex: 1,
    padding: 18,
    overflowX: 'hidden'
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 20,
    flexWrap: 'wrap'
  },

  title: {
    fontSize: 30,
    margin: 0
  },

  counter: {
    color: '#94a3b8'
  },

  input: {
    width: 280,
    padding: 13,
    borderRadius: 14,
    border: 'none',
    background: '#020617',
    color: '#fff',
    outline: 'none'
  },

  hero: {
    background: 'linear-gradient(180deg,#07142b,#020617)',
    borderRadius: 24,
    padding: 12,
    marginBottom: 16,
    position: 'sticky',
    top: 10,
    zIndex: 100,
    boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
  },

  playerWrap: {
    background: '#000',
    borderRadius: 20,
    overflow: 'hidden'
  },

  video: {
    width: '100%',
    height: '64vh',
    objectFit: 'contain',
    background: '#000'
  },

  infoBox: {
    marginTop: 12
  },

  liveBadge: {
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 'bold'
  },

  channelTitle: {
    fontSize: 26,
    marginTop: 10
  },

  category: {
    color: '#38bdf8'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(82px,1fr))',
    gap: 8
  },

  card: {
    background: 'linear-gradient(180deg,#111827,#020617)',
    borderRadius: 12,
    padding: 8,
    textAlign: 'center',
    cursor: 'pointer',
    transition: '0.18s ease',
    border: '1px solid rgba(255,255,255,0.04)',
    position: 'relative'
  },

  activeCard: {
    background: 'linear-gradient(180deg,#0ea5e9,#0369a1)',
    borderRadius: 12,
    padding: 8,
    textAlign: 'center',
    cursor: 'pointer',
    transform: 'scale(1.05)',
    boxShadow: '0 0 25px rgba(56,189,248,0.45)',
    border: '1px solid #38bdf8'
  },

  channelLogo: {
    width: 38,
    height: 38,
    objectFit: 'contain',
    transition: '0.2s'
  },

  channelName: {
    fontSize: 9,
    marginTop: 5,
    lineHeight: '11px',
    minHeight: 22
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
    gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))',
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

  episodeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 5,
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    padding: '5px 8px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 'bold'
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
    background: 'linear-gradient(to top,rgba(0,0,0,0.98),rgba(0,0,0,0.08))',
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
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    border: 'none',
    padding: 10,
    borderRadius: 10,
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 10,
    fontSize: 12
  },

  episodesOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.82)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },

  episodesModal: {
    width: '90%',
    maxWidth: 760,
    maxHeight: '82vh',
    background: 'linear-gradient(180deg,#07142b,#020617)',
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    border: '1px solid rgba(56,189,248,0.25)'
  },

  episodesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12
  },

  episodesCounter: {
    color: '#94a3b8',
    margin: '6px 0 0',
    fontSize: 13
  },

  closeEpisodesButton: {
    background: '#ef4444',
    border: 'none',
    color: '#fff',
    width: 40,
    height: 40,
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 'bold'
  },

  seasonTabs: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 12,
    marginBottom: 12
  },

  seasonButton: {
    background: '#0f172a',
    border: '1px solid rgba(56,189,248,0.2)',
    color: '#cbd5e1',
    borderRadius: 999,
    padding: '9px 14px',
    cursor: 'pointer',
    fontWeight: 'bold',
    whiteSpace: 'nowrap'
  },

  activeSeasonButton: {
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    border: 'none',
    color: '#000',
    borderRadius: 999,
    padding: '9px 14px',
    cursor: 'pointer',
    fontWeight: 'bold',
    whiteSpace: 'nowrap'
  },

  episodesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    maxHeight: '56vh',
    paddingRight: 6
  },

  episodeItem: {
    background: 'rgba(15,23,42,0.95)',
    border: '1px solid rgba(56,189,248,0.15)',
    color: '#fff',
    borderRadius: 14,
    padding: 14,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 5
  }
}

export default ClientPanel