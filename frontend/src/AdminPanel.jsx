import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

import AdminUsers from './AdminUsers'
import AdminChannels from './AdminChannels'
import AdminMovies from './AdminMovies'
import AdminSeries from './AdminSeries'
import AdminResellers from './AdminResellers'
import AdminReports from './AdminReports'

const API = 'https://api.nexoratvs.shop'

function AdminPanel({ user, setUser, logout }) {
  const [adminUsers, setAdminUsers] = useState([])

  const [stats, setStats] = useState({
    channels: 0,
    movies: 0,
    series: 0
  })

  const [loading, setLoading] = useState(true)

  const [page, setPage] = useState('dashboard')

  const authHeaders = useMemo(() => {
    return {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    }
  }, [])

  async function loadAdminUsers() {
    try {
      const res = await axios.get(
        `${API}/admin/users`,
        authHeaders
      )

      setAdminUsers(res.data || [])
    } catch (err) {
      console.log('Erro usuários:', err)
    }
  }

  async function loadCounts() {
    try {
      const res = await axios.get(
        `${API}/admin/stats`,
        authHeaders
      )

      setStats({
        channels: res.data?.channels || 0,
        movies: res.data?.movies || 0,
        series: res.data?.series || 0
      })
    } catch (err) {
      console.log('Erro contadores:', err)
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true)

      await Promise.all([
        loadAdminUsers(),
        loadCounts()
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const dashboard = useMemo(() => {
    const totalUsers = adminUsers.length

    const activeUsers =
      adminUsers.filter(
        user => user.status === 'active'
      ).length

    const blockedUsers =
      adminUsers.filter(
        user => user.status === 'blocked'
      ).length

    const premiumUsers =
      adminUsers.filter(
        user => user.plan === 'premium'
      ).length

    const freeUsers =
      adminUsers.filter(
        user => user.plan === 'free'
      ).length

    const totalCredits =
      adminUsers.reduce(
        (total, item) =>
          total + Number(item.credits || 0),
        0
      )

    return {
      totalUsers,
      activeUsers,
      blockedUsers,
      premiumUsers,
      freeUsers,
      totalCredits
    }
  }, [adminUsers])

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.logo}>
          IPTV PANEL
        </h1>

        <div style={styles.userBox}>
          <small style={styles.userType}>
            ADMINISTRADOR
          </small>

          <h2 style={styles.userName}>
            {user?.name}
          </h2>

          <p style={styles.userEmail}>
            {user?.email}
          </p>
        </div>

        <div style={styles.menu}>
          <button
            type='button'
            style={
              page === 'dashboard'
                ? styles.activeMenuButton
                : styles.menuButton
            }
            onClick={() =>
              setPage('dashboard')
            }
          >
            Dashboard
          </button>

          <button
            type='button'
            style={
              page === 'users'
                ? styles.activeMenuButton
                : styles.menuButton
            }
            onClick={() =>
              setPage('users')
            }
          >
            Usuários
          </button>

          <button
            type='button'
            style={
              page === 'resellers'
                ? styles.activeMenuButton
                : styles.menuButton
            }
            onClick={() =>
              setPage('resellers')
            }
          >
            Revendedores
          </button>

          <button
            type='button'
            style={
              page === 'reports'
                ? styles.activeMenuButton
                : styles.menuButton
            }
            onClick={() =>
              setPage('reports')
            }
          >
            Relatórios
          </button>

          <button
            type='button'
            style={
              page === 'channels'
                ? styles.activeMenuButton
                : styles.menuButton
            }
            onClick={() =>
              setPage('channels')
            }
          >
            Canais
          </button>

          <button
            type='button'
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
            type='button'
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
        </div>

        <button
          type='button'
          style={styles.redButton}
          onClick={logout}
        >
          Sair
        </button>
      </aside>

      <main style={styles.main}>
        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.loader}></div>

            <h2>Carregando painel...</h2>
          </div>
        ) : (
          <>
            {page === 'dashboard' && (
              <>
                <div style={styles.topBar}>
                  <div>
                    <h1 style={styles.title}>
                      Dashboard Admin
                    </h1>

                    <p style={styles.subtitle}>
                      Controle total do sistema IPTV
                    </p>
                  </div>
                </div>

                <div style={styles.statsGrid}>
                  <div style={styles.cardBlue}>
                    <h1>
                      {dashboard.totalUsers}
                    </h1>

                    <p>Total usuários</p>
                  </div>

                  <div style={styles.cardGreen}>
                    <h1>
                      {dashboard.activeUsers}
                    </h1>

                    <p>Usuários ativos</p>
                  </div>

                  <div style={styles.cardRed}>
                    <h1>
                      {dashboard.blockedUsers}
                    </h1>

                    <p>Bloqueados</p>
                  </div>

                  <div style={styles.cardPurple}>
                    <h1>
                      {dashboard.premiumUsers}
                    </h1>

                    <p>Premium</p>
                  </div>

                  <div style={styles.cardOrange}>
                    <h1>
                      {dashboard.freeUsers}
                    </h1>

                    <p>Free</p>
                  </div>

                  <div style={styles.cardYellow}>
                    <h1>
                      {dashboard.totalCredits}
                    </h1>

                    <p>Créditos</p>
                  </div>

                  <div style={styles.cardCyan}>
                    <h1>
                      {stats.channels}
                    </h1>

                    <p>Canais IPTV</p>
                  </div>

                  <div style={styles.cardMovie}>
                    <h1>
                      {stats.movies}
                    </h1>

                    <p>Filmes</p>
                  </div>

                  <div style={styles.cardSeries}>
                    <h1>
                      {stats.series}
                    </h1>

                    <p>Séries</p>
                  </div>
                </div>

                <div style={styles.infoBox}>
                  <h2 style={styles.infoTitle}>
                    Sistema Online
                  </h2>

                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      Backend Render conectado
                    </div>

                    <div style={styles.infoItem}>
                      Banco Supabase ativo
                    </div>

                    <div style={styles.infoItem}>
                      Importador M3U online
                    </div>

                    <div style={styles.infoItem}>
                      Player HLS funcionando
                    </div>

                    <div style={styles.infoItem}>
                      Filmes online
                    </div>

                    <div style={styles.infoItem}>
                      Séries online
                    </div>
                  </div>
                </div>
              </>
            )}

            {page === 'users' && (
              <AdminUsers
                users={adminUsers}
                reloadUsers={loadAdminUsers}
              />
            )}

            {page === 'resellers' && (
              <AdminResellers />
            )}

            {page === 'reports' && (
              <AdminReports />
            )}

            {page === 'channels' && (
              <AdminChannels />
            )}

            {page === 'movies' && (
              <AdminMovies />
            )}

            {page === 'series' && (
              <AdminSeries />
            )}
          </>
        )}
      </main>
    </div>
  )
}

const cardBase = {
  padding: 28,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.05)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  transition: '0.2s'
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
    width: 280,
    background: '#020f2d',
    padding: 20,
    borderRight: '1px solid #0f2248',
    display: 'flex',
    flexDirection: 'column'
  },

  logo: {
    color: '#38bdf8',
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: 'bold'
  },

  userBox: {
    background:
      'linear-gradient(180deg,#09152f,#071127)',
    padding: 20,
    borderRadius: 24,
    marginBottom: 25,
    border: '1px solid rgba(255,255,255,0.05)'
  },

  userType: {
    color: '#94a3b8',
    fontSize: 12
  },

  userName: {
    marginTop: 8,
    marginBottom: 5
  },

  userEmail: {
    color: '#94a3b8',
    fontSize: 13
  },

  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },

  menuButton: {
    background: '#07142b',
    border: '1px solid transparent',
    padding: 14,
    borderRadius: 14,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    textAlign: 'left',
    transition: '0.2s'
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
    textAlign: 'left'
  },

  redButton: {
    marginTop: 'auto',
    width: '100%',
    padding: 15,
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
    padding: 30,
    overflowY: 'auto'
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30
  },

  title: {
    fontSize: 42,
    marginBottom: 5
  },

  subtitle: {
    color: '#94a3b8'
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(220px,1fr))',
    gap: 20
  },

  cardBlue: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#0f172a,#111827)'
  },

  cardGreen: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#052e16,#14532d)'
  },

  cardRed: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#450a0a,#7f1d1d)'
  },

  cardPurple: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#3b0764,#581c87)'
  },

  cardOrange: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#7c2d12,#c2410c)'
  },

  cardYellow: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#713f12,#a16207)'
  },

  cardCyan: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#083344,#155e75)'
  },

  cardMovie: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#1e1b4b,#312e81)'
  },

  cardSeries: {
    ...cardBase,
    background:
      'linear-gradient(180deg,#3f6212,#4d7c0f)'
  },

  infoBox: {
    marginTop: 30,
    background: '#07142b',
    padding: 30,
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.05)'
  },

  infoTitle: {
    marginBottom: 20
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(250px,1fr))',
    gap: 15
  },

  infoItem: {
    background: '#0b1736',
    padding: 18,
    borderRadius: 16,
    color: '#cbd5e1'
  },

  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80vh',
    gap: 20
  },

  loader: {
    width: 60,
    height: 60,
    border: '5px solid #0f172a',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
}

export default AdminPanel