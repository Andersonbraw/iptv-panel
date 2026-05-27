import { useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function AdminUsers({ users, reloadUsers }) {
  const token = localStorage.getItem('token')

  const [credits, setCredits] = useState(1)
  const [createdLogin, setCreatedLogin] = useState(null)
  const [search, setSearch] = useState('')

  const headers = {
    Authorization: `Bearer ${token}`
  }

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.status === 'active').length
  const blockedUsers = users.filter(u => u.status === 'blocked').length

  async function updateUser(id, data) {
    try {
      await axios.patch(`${API}/admin/users/${id}`, data, { headers })
      reloadUsers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar usuário')
    }
  }

  async function addDays(user, days) {
    try {
      const now = new Date()

      const currentExpire = user.expires_at
        ? new Date(user.expires_at)
        : null

      const baseDate =
        currentExpire && currentExpire > now
          ? currentExpire
          : now

      baseDate.setDate(baseDate.getDate() + days)

      await updateUser(user.id, {
        expires_at: baseDate.toISOString()
      })
    } catch {
      alert('Erro ao adicionar dias')
    }
  }

  async function addCredits() {
    try {
      await axios.post(
        `${API}/admin/credits/add`,
        { amount: Number(credits) },
        { headers }
      )

      alert('Créditos adicionados')
      reloadUsers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao adicionar créditos')
    }
  }

  async function createRandomLogin() {
    try {
      const res = await axios.post(
        `${API}/admin/users/create-random`,
        {},
        { headers }
      )

      setCreatedLogin(res.data.login)

      reloadUsers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar login')
    }
  }

  async function deleteUser(id) {
    if (!confirm('Excluir este cliente?')) return

    try {
      await axios.delete(
        `${API}/admin/users/${id}`,
        { headers }
      )

      reloadUsers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir cliente')
    }
  }

  function copyLogin() {
    if (!createdLogin) return

    navigator.clipboard.writeText(
      `Email: ${createdLogin.email}\nSenha: ${createdLogin.password}`
    )

    alert('Login copiado')
  }

  return (
    <div style={styles.box}>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>{totalUsers}</h3>
          <p>Total usuários</p>
        </div>

        <div style={styles.statCardGreen}>
          <h3>{activeUsers}</h3>
          <p>Ativos</p>
        </div>

        <div style={styles.statCardRed}>
          <h3>{blockedUsers}</h3>
          <p>Bloqueados</p>
        </div>
      </div>

      <div style={styles.topBar}>
        <h2>Usuários do sistema</h2>

        <div style={styles.topActions}>

          <input
            type="text"
            placeholder="Buscar usuário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          <input
            type="number"
            min="1"
            value={credits}
            onChange={e => setCredits(e.target.value)}
            style={styles.creditInput}
          />

          <button
            style={styles.yellowButton}
            onClick={addCredits}
          >
            Adicionar créditos
          </button>

          <button
            style={styles.blueButton}
            onClick={createRandomLogin}
          >
            Criar login aleatório
          </button>

        </div>
      </div>

      {createdLogin && (
        <div style={styles.loginBox}>
          <h3>Login criado</h3>

          <input
            readOnly
            value={createdLogin.email}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={createdLogin.password}
            style={styles.copyInput}
          />

          <button
            style={styles.greenButton}
            onClick={copyLogin}
          >
            Copiar email e senha
          </button>
        </div>
      )}

      {filteredUsers.map(user => (
        <div key={user.id} style={styles.card}>

          <div>
            <strong>{user.name}</strong>

            <p style={styles.email}>
              {user.email}
            </p>

            <small>
              Plano: {user.plan || 'free'} |
              {' '}Conexões: {user.max_connections || 1}
            </small>

            <br />

            <small>
              Créditos: {user.credits || 0}
            </small>

            <br />

            <small>
              Vence em:{' '}
              {user.expires_at
                ? new Date(user.expires_at)
                    .toLocaleDateString('pt-BR')
                : 'Sem vencimento'}
            </small>

            <div style={styles.quickActions}>

              <button
                style={styles.smallDarkButton}
                onClick={() =>
                  updateUser(user.id, {
                    max_connections: 1
                  })
                }
              >
                1 conexão
              </button>

              <button
                style={styles.smallDarkButton}
                onClick={() =>
                  updateUser(user.id, {
                    max_connections: 2
                  })
                }
              >
                2 conexões
              </button>

              <button
                style={styles.smallDarkButton}
                onClick={() =>
                  updateUser(user.id, {
                    max_connections: 5
                  })
                }
              >
                5 conexões
              </button>

              <button
                style={styles.smallYellowButton}
                onClick={() => addDays(user, 7)}
              >
                +7 dias
              </button>

              <button
                style={styles.smallYellowButton}
                onClick={() => addDays(user, 15)}
              >
                +15 dias
              </button>

              <button
                style={styles.smallYellowButton}
                onClick={() => addDays(user, 30)}
              >
                +30 dias
              </button>

            </div>
          </div>

          <div style={styles.right}>

            <span>{user.role}</span>

            <p
              style={{
                color:
                  user.status === 'active'
                    ? '#22c55e'
                    : '#ef4444'
              }}
            >
              {user.status}
            </p>

            <div style={styles.actions}>

              <button
                style={styles.greenButton}
                onClick={() =>
                  updateUser(user.id, {
                    status: 'active'
                  })
                }
              >
                Ativar
              </button>

              <button
                style={styles.redButton}
                onClick={() =>
                  updateUser(user.id, {
                    status: 'blocked'
                  })
                }
              >
                Bloquear
              </button>

              <button
                style={styles.blueButton}
                onClick={() =>
                  updateUser(user.id, {
                    plan: 'premium'
                  })
                }
              >
                Premium
              </button>

              <button
                style={styles.grayButton}
                onClick={() =>
                  updateUser(user.id, {
                    plan: 'free'
                  })
                }
              >
                Free
              </button>

              {user.role !== 'admin' && (
                <button
                  style={styles.deleteButton}
                  onClick={() => deleteUser(user.id)}
                >
                  Excluir
                </button>
              )}

            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const styles = {
  box: {
    background: '#07142b',
    padding: 20,
    borderRadius: 24
  },

  stats: {
    display: 'flex',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap'
  },

  statCard: {
    background: '#020617',
    padding: 20,
    borderRadius: 18,
    minWidth: 180
  },

  statCardGreen: {
    background: '#052e16',
    padding: 20,
    borderRadius: 18,
    minWidth: 180
  },

  statCardRed: {
    background: '#450a0a',
    padding: 20,
    borderRadius: 18,
    minWidth: 180
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 20,
    flexWrap: 'wrap'
  },

  topActions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap'
  },

  searchInput: {
    padding: 10,
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff',
    width: 220
  },

  creditInput: {
    width: 90,
    padding: 10,
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff'
  },

  loginBox: {
    background: '#020617',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    border: '1px solid #38bdf8'
  },

  copyInput: {
    width: '100%',
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#07142b',
    color: '#fff',
    boxSizing: 'border-box'
  },

  card: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    background: '#020617',
    padding: 18,
    borderRadius: 16,
    marginTop: 14
  },

  email: {
    color: '#94a3b8'
  },

  right: {
    minWidth: 420,
    textAlign: 'right'
  },

  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },

  quickActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 14
  },

  smallDarkButton: {
    padding: '7px 10px',
    border: 'none',
    borderRadius: 8,
    background: '#1e293b',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  smallYellowButton: {
    padding: '7px 10px',
    border: 'none',
    borderRadius: 8,
    background: '#facc15',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  greenButton: {
    padding: '9px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#22c55e',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  redButton: {
    padding: '9px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  blueButton: {
    padding: '9px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#38bdf8',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  grayButton: {
    padding: '9px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#334155',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  yellowButton: {
    padding: '9px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#facc15',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  deleteButton: {
    padding: '9px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#991b1b',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminUsers