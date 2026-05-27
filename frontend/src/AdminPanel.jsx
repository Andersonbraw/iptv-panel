import { useEffect, useState } from 'react'
import axios from 'axios'

import AdminUsers from './AdminUsers'
import AdminChannels from './AdminChannels'
import AdminMovies from './AdminMovies'
import AdminSeries from './AdminSeries'

const API = 'https://iptv-backend-cuxf.onrender.com'

function AdminPanel({ user, setUser }) {
  const [adminUsers, setAdminUsers] = useState([])
  const [page, setPage] = useState('dashboard')

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

  async function loadAdminUsers() {
    try {
      const res = await axios.get(`${API}/admin/users`, authHeaders)
      setAdminUsers(res.data)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    loadAdminUsers()
  }, [])

  const totalUsers = adminUsers.length
  const activeUsers = adminUsers.filter(u => u.status === 'active').length
  const blockedUsers = adminUsers.filter(u => u.status === 'blocked').length
  const premiumUsers = adminUsers.filter(u => u.plan === 'premium').length
  const freeUsers = adminUsers.filter(u => u.plan === 'free').length
  const totalCredits = adminUsers.reduce(
    (total, item) => total + Number(item.credits || 0),
    0
  )

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.logo}>IPTV PANEL</h1>

        <div style={styles.userBox}>
          <small style={{ color: '#94a3b8' }}>ADMINISTRADOR</small>
          <h2>{user.name}</h2>
        </div>

        <div style={styles.menu}>
          <button
            type="button"
            style={page === 'dashboard' ? styles.activeMenuButton : styles.menuButton}
            onClick={() => setPage('dashboard')}
          >
            Dashboard
          </button>

          <button
            type="button"
            style={page === 'users' ? styles.activeMenuButton : styles.menuButton}
            onClick={() => setPage('users')}
          >
            Usuários
          </button>

          <button
            type="button"
            style={page === 'channels' ? styles.activeMenuButton : styles.menuButton}
            onClick={() => setPage('channels')}
          >
            Canais
          </button>

          <button
            type="button"
            style={page === 'movies' ? styles.activeMenuButton : styles.menuButton}
            onClick={() => setPage('movies')}
          >
            Filmes
          </button>

          <button
            type="button"
            style={page === 'series' ? styles.activeMenuButton : styles.menuButton}
            onClick={() => setPage('series')}
          >
            Séries
          </button>

          <button type="button" style={styles.menuButton}>EPG</button>
          <button type="button" style={styles.menuButton}>Financeiro</button>
          <button type="button" style={styles.menuButton}>Revendedores</button>
        </div>

        <button type="button" style={styles.redButton} onClick={logout}>
          Sair
        </button>
      </aside>

      <main style={styles.main}>
        {page === 'dashboard' && (
          <>
            <h1 style={styles.title}>Dashboard Admin</h1>

            <div style={styles.statsGrid}>
              <div style={styles.blueCard}>
                <h1>{totalUsers}</h1>
                <p>Total usuários</p>
              </div>

              <div style={styles.greenCard}>
                <h1>{activeUsers}</h1>
                <p>Usuários ativos</p>
              </div>

              <div style={styles.redCard}>
                <h1>{blockedUsers}</h1>
                <p>Bloqueados</p>
              </div>

              <div style={styles.purpleCard}>
                <h1>{premiumUsers}</h1>
                <p>Premium</p>
              </div>

              <div style={styles.orangeCard}>
                <h1>{freeUsers}</h1>
                <p>Free</p>
              </div>

              <div style={styles.yellowCard}>
                <h1>{totalCredits}</h1>
                <p>Créditos totais</p>
              </div>
            </div>

            <div style={styles.infoBox}>
              <h2>Sistema IPTV Online</h2>
              <p>Backend Render conectado</p>
              <p>Banco Supabase ativo</p>
              <p>Painel admin operacional</p>
            </div>
          </>
        )}

        {page === 'users' && (
          <AdminUsers users={adminUsers} reloadUsers={loadAdminUsers} />
        )}

        {page === 'channels' && <AdminChannels />}
        {page === 'movies' && <AdminMovies />}
        {page === 'series' && <AdminSeries />}
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
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 30
  },

  userBox: {
    background: '#0b1736',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20
  },

  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20
  },

  menuButton: {
    background: '#07142b',
    border: 'none',
    padding: 14,
    borderRadius: 12,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left'
  },

  activeMenuButton: {
    background: '#38bdf8',
    border: 'none',
    padding: 14,
    borderRadius: 12,
    color: '#000',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left'
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
    padding: 30
  },

  title: {
    fontSize: 42,
    marginBottom: 30
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: 20
  },

  blueCard: {
    background: '#0f172a',
    padding: 30,
    borderRadius: 24
  },

  greenCard: {
    background: '#052e16',
    padding: 30,
    borderRadius: 24
  },

  redCard: {
    background: '#450a0a',
    padding: 30,
    borderRadius: 24
  },

  purpleCard: {
    background: '#3b0764',
    padding: 30,
    borderRadius: 24
  },

  orangeCard: {
    background: '#7c2d12',
    padding: 30,
    borderRadius: 24
  },

  yellowCard: {
    background: '#713f12',
    padding: 30,
    borderRadius: 24
  },

  infoBox: {
    marginTop: 30,
    background: '#07142b',
    padding: 30,
    borderRadius: 24
  }
}

export default AdminPanel