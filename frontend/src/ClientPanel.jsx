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

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState(false)

  useEffect(() => {
    if (!src || !videoRef.current)
      return

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

    if (
      src.includes('.m3u8') &&
      Hls.isSupported()
    ) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      })

      hls.loadSource(src)

      hls.attachMedia(video)

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          ready()

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
                failed()

                hls.destroy()

                break
            }
          }
        }
      )
    } else {
      video.src = src

      video.onloadeddata =
        () => {
          ready()
        }

      video.onerror = () => {
        failed()
      }

      video
        .play()
        .catch(() => {})
    }

    return () => {
      clearTimeout(timeout)

      if (hls) hls.destroy()
    }
  }, [src])

  return (
    <div
      style={{
        position: 'relative'
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'rgba(0,0,0,0.82)',
            display: 'flex',
            flexDirection:
              'column',
            justifyContent:
              'center',
            alignItems:
              'center',
            zIndex: 10,
            gap: 18
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              border:
                '5px solid #0f172a',
              borderTop:
                '5px solid #38bdf8',
              borderRadius:
                '50%',
              animation:
                'spin 1s linear infinite'
            }}
          />

          <h2
            style={{
              color: '#fff',
              margin: 0
            }}
          >
            Carregando canal...
          </h2>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection:
              'column',
            justifyContent:
              'center',
            alignItems:
              'center',
            zIndex: 11,
            color: '#fff',
            gap: 15
          }}
        >
          <h2
            style={{
              margin: 0,
              color: '#ef4444'
            }}
          >
            Canal offline
          </h2>

          <p
            style={{
              color: '#cbd5e1'
            }}
          >
            Este canal pode
            estar indisponível.
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
      const grouped = {}

      onlyMovies.forEach(movie => {
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

        const matchesSearch =
          normalizedTitle.includes(
            normalize(
              movieSearch
            )
          )

        if (!matchesSearch) {
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
            episodes: 1
          }
        } else {
          grouped[
            normalizedTitle
          ].episodes++
        }
      })

      return Object.values(grouped)
    }, [onlyMovies, movieSearch])

  const filteredSeries =
    useMemo(() => {
      const grouped = {}

      onlySeries.forEach(item => {
        const originalTitle =
          item.title || ''

        const cleanTitle =
          cleanGroupTitle(
            originalTitle
          )

        const normalizedTitle =
          normalize(
            cleanTitle ||
              originalTitle
          )

        const matchesSearch =
          normalizedTitle.includes(
            normalize(
              seriesSearch
            )
          )

        if (!matchesSearch) {
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
            ...item,
            title:
              cleanTitle ||
              originalTitle,
            episodes: 1
          }
        } else {
          grouped[
            normalizedTitle
          ].episodes++
        }
      })

      return Object.values(grouped)
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
      {/* RESTANTE DO SEU JSX CONTINUA IGUAL */}
    </div>
  )
}

export default ClientPanel