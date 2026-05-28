import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

function PlayerModal({ open, onClose, stream }) {
  const videoRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !stream?.url || !videoRef.current) return

    const video = videoRef.current
    let hls = null

    setLoading(true)
    setError(false)

    video.pause()
    video.removeAttribute('src')
    video.load()

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
        setLoading(false)
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

        setLoading(false)
        setError(true)
        hls.destroy()
      })
    } else {
      video.src = stream.url

      video.onloadeddata = () => {
        setLoading(false)
      }

      video.onerror = () => {
        setLoading(false)
        setError(true)
      }

      video.play().catch(() => {
        setLoading(false)
      })
    }

    return () => {
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
          {loading && !error && (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <p>Carregando vídeo...</p>
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              <h3 style={styles.errorTitle}>
                Vídeo indisponível
              </h3>

              <p style={styles.errorText}>
                Este conteúdo pode estar offline ou bloqueado.
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
    background: 'rgba(0,0,0,0.96)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backdropFilter: 'blur(8px)'
  },

  modal: {
    width: '96%',
    maxWidth: 1450,
    background: '#020817',
    borderRadius: 24,
    overflow: 'hidden',
    border: '1px solid rgba(56,189,248,0.7)',
    boxShadow: '0 0 50px rgba(14,165,233,0.35)'
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    gap: 20
  },

  badge: {
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
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
    fontSize: 30
  },

  close: {
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    border: 'none',
    width: 50,
    height: 50,
    borderRadius: 14,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 24,
    flexShrink: 0
  },

  videoContainer: {
    position: 'relative',
    background: '#000'
  },

  loading: {
    position: 'absolute',
    inset: 0,
    color: '#fff',
    fontSize: 22,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.35)'
  },

  spinner: {
    width: 54,
    height: 54,
    border: '5px solid #1e293b',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%',
    marginBottom: 14
  },

  errorBox: {
    position: 'absolute',
    inset: 0,
    zIndex: 3,
    textAlign: 'center',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.72)',
    padding: 20
  },

  errorTitle: {
    fontSize: 32,
    marginBottom: 10
  },

  errorText: {
    color: '#cbd5e1',
    marginBottom: 20
  },

  openButton: {
    background: 'linear-gradient(90deg,#0ea5e9,#0284c7)',
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