import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

function PlayerModal({ open, onClose, stream }) {
  const videoRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showInfo, setShowInfo] = useState(true)

  useEffect(() => {
    if (!open || !stream?.url || !videoRef.current) return

    const video = videoRef.current
    let hls = null
    let timer = null

    setLoading(true)
    setError(false)
    setShowInfo(true)

    video.pause()
    video.removeAttribute('src')
    video.load()

    timer = setTimeout(() => {
      setLoading(false)
      setError(true)
    }, 18000)

    function ready() {
      clearTimeout(timer)
      setLoading(false)
      setError(false)

      setTimeout(() => {
        setShowInfo(false)
      }, 4000)
    }

    function fail() {
      clearTimeout(timer)
      setLoading(false)
      setError(true)
    }

    if (stream.url.includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      })

      hls.loadSource(stream.url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        ready()
        video.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad()
          return
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }

        fail()
        hls.destroy()
      })
    } else {
      video.src = stream.url

      video.onloadeddata = () => {
        ready()
      }

      video.onerror = () => {
        fail()
      }

      video.play().catch(() => {
        setLoading(false)
      })
    }

    return () => {
      clearTimeout(timer)

      video.pause()
      video.removeAttribute('src')
      video.load()

      if (hls) {
        hls.destroy()
      }
    }
  }, [open, stream?.url])

  if (!open || !stream) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.backdrop}>
          <div style={styles.glowOne}></div>
          <div style={styles.glowTwo}></div>
        </div>

        <div style={styles.top}>
          <div>
            <div style={styles.badge}>
              PLAYER PREMIUM
            </div>

            <h2 style={styles.title}>
              {stream.title}
            </h2>
          </div>

          <button
            type='button'
            onClick={onClose}
            style={styles.close}
          >
            ✕
          </button>
        </div>

        <div style={styles.videoContainer}>
          {showInfo && !loading && !error && (
            <div style={styles.infoOverlay}>
              <div style={styles.infoBadge}>
                REPRODUZINDO AGORA
              </div>

              <h1 style={styles.infoTitle}>
                {stream.title}
              </h1>
            </div>
          )}

          {loading && !error && (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>

              <h2 style={styles.loadingTitle}>
                Preparando transmissão...
              </h2>

              <p style={styles.loadingText}>
                Aguarde enquanto carregamos o conteúdo.
              </p>
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              <h3 style={styles.errorTitle}>
                Vídeo indisponível
              </h3>

              <p style={styles.errorText}>
                Este conteúdo pode estar offline, expirado ou bloqueado.
              </p>

              <a
                href={stream.url}
                target='_blank'
                rel='noreferrer'
                style={styles.openButton}
              >
                Abrir em nova aba
              </a>
            </div>
          )}

          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            style={styles.video}
          />
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background:
      'radial-gradient(circle at top,#0f172a 0%,#000 55%,#000 100%)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backdropFilter: 'blur(10px)'
  },

  modal: {
    width: '96%',
    maxWidth: 1480,
    background: '#020817',
    borderRadius: 26,
    overflow: 'hidden',
    border: '1px solid rgba(56,189,248,0.65)',
    boxShadow:
      '0 0 55px rgba(14,165,233,0.35)',
    position: 'relative'
  },

  backdrop: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden'
  },

  glowOne: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'rgba(56,189,248,0.18)',
    filter: 'blur(60px)'
  },

  glowTwo: {
    position: 'absolute',
    right: -140,
    bottom: -140,
    width: 360,
    height: 360,
    borderRadius: '50%',
    background: 'rgba(239,68,68,0.16)',
    filter: 'blur(70px)'
  },

  top: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    gap: 20,
    background:
      'linear-gradient(90deg,rgba(2,8,23,0.96),rgba(15,23,42,0.85))'
  },

  badge: {
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 'bold',
    display: 'inline-block',
    marginBottom: 10
  },

  title: {
    color: '#fff',
    margin: 0,
    fontSize: 30,
    lineHeight: '34px'
  },

  close: {
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    border: 'none',
    width: 52,
    height: 52,
    borderRadius: 16,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 24,
    flexShrink: 0,
    boxShadow:
      '0 8px 25px rgba(239,68,68,0.35)'
  },

  videoContainer: {
    position: 'relative',
    background: '#000'
  },

  infoOverlay: {
    position: 'absolute',
    left: 26,
    bottom: 80,
    zIndex: 4,
    color: '#fff',
    pointerEvents: 'none',
    maxWidth: '70%'
  },

  infoBadge: {
    display: 'inline-block',
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12
  },

  infoTitle: {
    margin: 0,
    fontSize: 42,
    lineHeight: '46px',
    textShadow: '0 4px 18px rgba(0,0,0,0.9)'
  },

  loading: {
    position: 'absolute',
    inset: 0,
    color: '#fff',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background:
      'linear-gradient(180deg,rgba(0,0,0,0.85),rgba(0,0,0,0.55))',
    textAlign: 'center'
  },

  spinner: {
    width: 62,
    height: 62,
    border: '5px solid #1e293b',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%',
    marginBottom: 18,
    animation: 'spin 1s linear infinite'
  },

  loadingTitle: {
    margin: 0,
    fontSize: 26
  },

  loadingText: {
    color: '#cbd5e1',
    marginTop: 8
  },

  errorBox: {
    position: 'absolute',
    inset: 0,
    zIndex: 6,
    textAlign: 'center',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background:
      'linear-gradient(180deg,rgba(0,0,0,0.92),rgba(0,0,0,0.75))',
    padding: 20
  },

  errorTitle: {
    fontSize: 32,
    marginBottom: 10,
    color: '#ef4444'
  },

  errorText: {
    color: '#cbd5e1',
    marginBottom: 20
  },

  openButton: {
    background:
      'linear-gradient(90deg,#0ea5e9,#0284c7)',
    color: '#fff',
    padding: '12px 22px',
    borderRadius: 12,
    textDecoration: 'none',
    fontWeight: 'bold'
  },

  video: {
    width: '100%',
    height: '78vh',
    background: '#000',
    display: 'block'
  }
}

export default PlayerModal