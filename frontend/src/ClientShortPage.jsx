import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'https://api.nexoratvs.shop'

function ClientShortPage({ username }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await axios.get(`${API}/short/${encodeURIComponent(username)}`)
        setData(res.data)
      } catch (err) {
        setError(err.response?.data?.error || 'Cliente não encontrado')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [username])

  const whatsappText = useMemo(() => {
    if (!data?.links) return ''

    return `Nexora TV\nServidor: ${data.links.server_url}\nUsuário: ${data.links.username}\nSenha: ${data.links.password}\nM3U: ${data.links.m3u}`
  }, [data])

  function copy(text) {
    navigator.clipboard.writeText(text)
    alert('Copiado!')
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.box}><h1 style={styles.logo}>NEXORA TV</h1><p>Carregando...</p></div></div>
  }

  if (error) {
    return <div style={styles.page}><div style={styles.box}><h1 style={styles.logo}>NEXORA TV</h1><p style={styles.error}>{error}</p></div></div>
  }

  const client = data.client
  const links = data.links
  const expires = client.expires_at ? new Date(client.expires_at).toLocaleString('pt-BR') : 'Sem vencimento'

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <h1 style={styles.logo}>NEXORA TV</h1>
        <p style={styles.subtitle}>Dados de acesso do cliente</p>

        <div style={styles.grid}>
          <div style={styles.card}><small>Cliente</small><strong>{client.name}</strong></div>
          <div style={styles.card}><small>Status</small><strong>{client.status}</strong></div>
          <div style={styles.card}><small>Servidor</small><strong>api.nexoratvs.shop</strong></div>
          <div style={styles.card}><small>Usuário</small><strong>{links.username}</strong></div>
          <div style={styles.card}><small>Senha</small><strong>{links.password}</strong></div>
          <div style={styles.card}><small>Vencimento</small><strong>{expires}</strong></div>
        </div>

        <label style={styles.label}>Link M3U</label>
        <input readOnly value={links.m3u} style={styles.input} />

        <div style={styles.qrBox}>
          <img
            alt='QR Code'
            style={styles.qr}
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(links.m3u)}`}
          />
        </div>

        <div style={styles.buttons}>
          <button style={styles.blueButton} onClick={() => copy(links.m3u)}>Copiar M3U</button>
          <button style={styles.greenButton} onClick={() => copy(`Servidor: ${links.server_url}\nUsuário: ${links.username}\nSenha: ${links.password}`)}>Copiar Xtream</button>
          <a style={styles.purpleButton} href={links.m3u}>Abrir M3U</a>
          <a style={styles.redButton} href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}>Enviar WhatsApp</a>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#000814',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: 'Arial'
  },
  box: {
    width: 'min(760px,100%)',
    background: 'linear-gradient(180deg,#07142b,#020617)',
    border: '1px solid rgba(56,189,248,0.25)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
  },
  logo: {
    color: '#38bdf8',
    margin: 0,
    fontSize: 34
  },
  subtitle: {
    color: '#94a3b8'
  },
  error: {
    color: '#ef4444',
    fontWeight: 'bold'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: 12,
    margin: '18px 0'
  },
  card: {
    background: '#020617',
    border: '1px solid #1e3a5f',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  input: {
    width: '100%',
    background: '#07142b',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: 14,
    padding: 12,
    boxSizing: 'border-box',
    marginTop: 8
  },
  qrBox: {
    display: 'flex',
    justifyContent: 'center',
    margin: '18px 0'
  },
  qr: {
    background: '#fff',
    padding: 12,
    borderRadius: 16,
    maxWidth: 220
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
    gap: 10
  },
  blueButton: { padding: 13, border: 'none', borderRadius: 14, background: '#38bdf8', color: '#000', fontWeight: 'bold', cursor: 'pointer' },
  greenButton: { padding: 13, border: 'none', borderRadius: 14, background: '#22c55e', color: '#000', fontWeight: 'bold', cursor: 'pointer' },
  purpleButton: { padding: 13, border: 'none', borderRadius: 14, background: '#a855f7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', textDecoration: 'none' },
  redButton: { padding: 13, border: 'none', borderRadius: 14, background: '#ef4444', color: '#fff', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }
}

export default ClientShortPage
