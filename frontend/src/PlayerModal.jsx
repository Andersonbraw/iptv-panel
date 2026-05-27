import React from 'react'

function PlayerModal({
  open,
  onClose,
  stream
}) {
  if (!open || !stream) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        <div style={styles.top}>
          <h2 style={styles.title}>
            {stream.title}
          </h2>

          <button
            onClick={onClose}
            style={styles.close}
          >
            ✕
          </button>
        </div>

        <video
          src={stream.url}
          controls
          autoPlay
          style={styles.video}
        />

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
    alignItems: 'center'
  },

  modal: {
    width: '90%',
    maxWidth: 1200,
    background: '#020817',
    borderRadius: 20,
    overflow: 'hidden',
    border: '2px solid #0ea5e9'
  },

  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20
  },

  title: {
    color: '#fff'
  },

  close: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  video: {
    width: '100%',
    height: '75vh',
    background: '#000'
  }
}

export default PlayerModal