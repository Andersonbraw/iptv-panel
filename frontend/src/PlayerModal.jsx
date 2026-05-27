import React, { useState } from 'react'

function PlayerModal({
  open,
  onClose,
  stream
}) {
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(false)

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
            onClick={onClose}
            style={styles.close}
          >
            ✕
          </button>
        </div>

        <div style={styles.videoContainer}>

          {loading && !error && (
            <div style={styles.loading}>
              Carregando vídeo...
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              <h3 style={styles.errorTitle}>
                Vídeo indisponível
              </h3>

              <p style={styles.errorText}>
                Este conteúdo pode estar offline
                ou bloqueado.
              </p>

              <a
                href={stream.url}
                target="_blank"
                rel="noreferrer"
                style={styles.openButton}
              >
                Abrir em nova aba
              </a>
            </div>
          )}

          <video
            src={stream.url}
            controls
            autoPlay
            playsInline
            style={styles.video}
            onLoadedData={() => {
              setLoading(false)
            }}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />

        </div>

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.95)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },

  modal: {
    width: '95%',
    maxWidth: 1400,
    background: '#020817',
    borderRadius: 20,
    overflow: 'hidden',
    border: '2px solid #0ea5e9',
    boxShadow: '0 0 40px rgba(14,165,233,0.4)'
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 25,
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },

  badge: {
    background: '#ef4444',
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
    fontSize: 32
  },

  close: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    width: 50,
    height: 50,
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 24
  },

  videoContainer: {
    position: 'relative',
    background: '#000'
  },

  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontSize: 24,
    zIndex: 2
  },

  errorBox: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 3,
    textAlign: 'center',
    color: '#fff'
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
    background: '#0ea5e9',
    color: '#fff',
    padding: '12px 22px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 'bold'
  },

  video: {
    width: '100%',
    height: '78vh',
    background: '#000'
  }
}

export default PlayerModal