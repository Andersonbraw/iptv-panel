import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API =
  'https://iptv-backend-cuxf.onrender.com'

function AdminUsers({
  users,
  reloadUsers
}) {
  const [credits, setCredits] = useState(1)
  const [createdLogin, setCreatedLogin] = useState(null)
  const [search, setSearch] = useState('')
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingLoginUser, setEditingLoginUser] = useState(null)
  const [newXtreamLogin, setNewXtreamLogin] = useState('')

  const headers = useMemo(() => {
    return {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      reloadUsers()
    }, 5000)

    return () => clearInterval(interval)
  }, [reloadUsers])

  function normalize(text = '') {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function getUserStatus(user) {
    if (!user.watching_updated_at) {
      return {
        online: false,
        text: '🔴 Offline'
      }
    }

    const lastUpdate = new Date(user.watching_updated_at).getTime()
    const diffMinutes = (Date.now() - lastUpdate) / 1000 / 60

    if (diffMinutes <= 2) {
      return {
        online: true,
        text: '🟢 Online agora'
      }
    }

    return {
      online: false,
      text: `🔴 Offline há ${Math.floor(diffMinutes)} min`
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const text = normalize(`
        ${user.name || ''}
        ${user.email || ''}
        ${user.xtream_username || ''}
      `)

      return text.includes(normalize(search))
    })
  }, [users, search])

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      blocked: users.filter(u => u.status === 'blocked').length
    }
  }, [users])

  async function updateUser(id, data) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/users/${id}`,
        data,
        { headers }
      )

      reloadUsers()
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao atualizar usuário'
      )
    } finally {
      setLoading(false)
    }
  }

  async function addDays(user, days) {
    try {
      const now = new Date()

      const currentExpire =
        user.expires_at
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
      setLoading(true)

      await axios.post(
        `${API}/admin/credits/add`,
        {
          amount: Number(credits)
        },
        { headers }
      )

      alert('Créditos adicionados')
      reloadUsers()
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao adicionar créditos'
      )
    } finally {
      setLoading(false)
    }
  }

  async function createRandomLogin() {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/admin/users/create-random`,
        {
          name: clientName
        },
        { headers }
      )

      setCreatedLogin({
        ...res.data.login,
        name: clientName || 'Cliente'
      })

      setClientName('')
      reloadUsers()
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao criar login'
      )
    } finally {
      setLoading(false)
    }
  }

  function getShortLogin(user) {
    return (
      user.xtream_username ||
      String(user.email || '').replace(/\D/g, '') ||
      user.email ||
      ''
    )
  }

  async function saveXtreamLogin() {
    if (!editingLoginUser) return

    const login = String(newXtreamLogin || '')
      .replace(/\D/g, '')
      .trim()

    if (!login || login.length < 3) {
      alert('Digite um login numérico com pelo menos 3 números')
      return
    }

    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/resellers/clients/${editingLoginUser.id}/xtream-login`,
        {
          xtream_username: login
        },
        { headers }
      )

      alert('Login Xtream atualizado')

      setEditingLoginUser(null)
      setNewXtreamLogin('')

      reloadUsers()
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao editar login Xtream'
      )
    } finally {
      setLoading(false)
    }
  }

  function openEditLogin(user) {
    setEditingLoginUser(user)
    setNewXtreamLogin(getShortLogin(user))
  }

  function copyUserXtreamLogin(user) {
    const shortLogin = getShortLogin(user)

    navigator.clipboard.writeText(`
Lista: Nexora TV

Servidor: ${API}

Usuário: ${shortLogin}

Senha: ${user.password || 'senha do cliente'}
    `)

    alert('Dados Xtream copiados')
  }

  async function deleteUser(id) {
    const confirmDelete = confirm('Excluir este cliente?')

    if (!confirmDelete) return

    try {
      setLoading(true)

      await axios.delete(
        `${API}/admin/users/${id}`,
        { headers }
      )

      reloadUsers()
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao excluir cliente'
      )
    } finally {
      setLoading(false)
    }
  }

  function copyLogin() {
    if (!createdLogin) return

    navigator.clipboard.writeText(`
Nome: ${createdLogin.name}

Email: ${createdLogin.email}

Login Xtream: ${createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, '')}

Senha: ${createdLogin.password}

Servidor: ${API}
    `)

    alert('Login copiado')
  }

  return (
    <div style={styles.box}>
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h2>{stats.total}</h2>
          <p>Total usuários</p>
        </div>

        <div style={styles.statCardGreen}>
          <h2>{stats.active}</h2>
          <p>Ativos</p>
        </div>

        <div style={styles.statCardRed}>
          <h2>{stats.blocked}</h2>
          <p>Bloqueados</p>
        </div>
      </div>

      <div style={styles.topBar}>
        <div>
          <h2 style={styles.title}>
            Usuários do sistema
          </h2>

          <p style={styles.subtitle}>
            Controle completo dos clientes
          </p>
        </div>

        <div style={styles.topActions}>
          <input
            type='text'
            placeholder='Buscar usuário...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          <input
            type='text'
            placeholder='Nome do cliente'
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            style={styles.nameInput}
          />

          <input
            type='number'
            min='1'
            value={credits}
            onChange={e => setCredits(e.target.value)}
            style={styles.creditInput}
          />

          <button
            style={styles.yellowButton}
            onClick={addCredits}
            disabled={loading}
          >
            Créditos
          </button>

          <button
            style={styles.blueButton}
            onClick={createRandomLogin}
            disabled={loading}
          >
            Login aleatório
          </button>
        </div>
      </div>

      {createdLogin && (
        <div style={styles.loginBox}>
          <h3>Login criado</h3>

          <input
            readOnly
            value={`Nome: ${createdLogin.name}`}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Email: ${createdLogin.email}`}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Login Xtream: ${createdLogin.xtream_username || String(createdLogin.email || '').replace(/\\D/g, '')}`}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Servidor: ${API}`}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Senha: ${createdLogin.password}`}
            style={styles.copyInput}
          />

          <button
            style={styles.greenButton}
            onClick={copyLogin}
          >
            Copiar login
          </button>
        </div>
      )}

      {editingLoginUser && (
        <div style={styles.loginBox}>
          <h3>Editar Login Xtream</h3>

          <p style={styles.subtitle}>
            Este é o usuário curto para apps como XCIPTV, Smarters, TiviMate e Televizo.
          </p>

          <input
            readOnly
            value={`Cliente: ${editingLoginUser.name || ''}`}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Email interno: ${editingLoginUser.email || ''}`}
            style={styles.copyInput}
          />

          <input
            type='text'
            value={newXtreamLogin}
            onChange={e =>
              setNewXtreamLogin(
                e.target.value.replace(/\D/g, '')
              )
            }
            placeholder='Ex: 823966'
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Servidor: ${API}`}
            style={styles.copyInput}
          />

          <div style={styles.modalActions}>
            <button
              style={styles.greenButton}
              onClick={saveXtreamLogin}
              disabled={loading}
            >
              Salvar login
            </button>

            <button
              style={styles.grayButton}
              onClick={() => {
                setEditingLoginUser(null)
                setNewXtreamLogin('')
              }}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.loading}>
          Processando...
        </div>
      )}

      {filteredUsers.map(user => {
        const userStatus = getUserStatus(user)

        return (
          <div
            key={user.id}
            style={styles.card}
          >
            <div>
              <strong style={styles.userName}>
                {user.name}
              </strong>

              <p style={styles.email}>
                {user.email}
              </p>

              <small style={styles.xtreamLogin}>
                Login Xtream: {getShortLogin(user)}
              </small>

              <br />

              <small>
                Servidor: {API}
              </small>

              <br />

              <small>
                Plano: {user.plan || 'free'} • Conexões:{' '}
                {user.max_connections || 1}
              </small>

              <br />

              <small>
                Créditos: {user.credits || 0}
              </small>

              <br />

              <small>
                Vence em:{' '}
                {user.expires_at
                  ? new Date(user.expires_at).toLocaleDateString('pt-BR')
                  : 'Sem vencimento'}
              </small>

              <br />

              <small style={styles.watchingText}>
                Assistindo:{' '}
                {user.watching
                  ? `${user.watching_type || 'Conteúdo'}: ${user.watching}`
                  : 'Nada no momento'}
              </small>

              <br />

              <small
                style={{
                  color: userStatus.online
                    ? '#22c55e'
                    : '#ef4444',
                  fontWeight: 'bold'
                }}
              >
                {userStatus.text}
              </small>

              {user.watching_updated_at && (
                <>
                  <br />

                  <small style={styles.watchingTime}>
                    Atualizado:{' '}
                    {new Date(user.watching_updated_at).toLocaleString('pt-BR')}
                  </small>
                </>
              )}

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
              <span style={styles.role}>
                {user.role}
              </span>

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

                {user.role === 'client' && (
                  <>
                    <button
                      style={styles.yellowButton}
                      onClick={() => openEditLogin(user)}
                    >
                      Editar login
                    </button>

                    <button
                      style={styles.smallDarkButton}
                      onClick={() => copyUserXtreamLogin(user)}
                    >
                      Copiar Xtream
                    </button>
                  </>
                )}

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
        )
      })}
    </div>
  )
}

const styles = {
  box: {
    background:
      'linear-gradient(180deg,#07142b,#020617)',
    padding: 22,
    borderRadius: 24
  },

  stats: {
    display: 'flex',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap'
  },

  statCard: {
    background:
      'linear-gradient(180deg,#111827,#020617)',
    padding: 20,
    borderRadius: 20,
    minWidth: 180
  },

  statCardGreen: {
    background:
      'linear-gradient(180deg,#14532d,#052e16)',
    padding: 20,
    borderRadius: 20,
    minWidth: 180
  },

  statCardRed: {
    background:
      'linear-gradient(180deg,#7f1d1d,#450a0a)',
    padding: 20,
    borderRadius: 20,
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

  title: {
    marginBottom: 6
  },

  subtitle: {
    color: '#94a3b8'
  },

  topActions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap'
  },

  searchInput: {
    padding: 12,
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff',
    width: 220
  },

  nameInput: {
    padding: 12,
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff',
    width: 220
  },

  creditInput: {
    width: 90,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff'
  },

  loginBox: {
    background: '#020617',
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    border: '1px solid #38bdf8'
  },

  copyInput: {
    width: '100%',
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#07142b',
    color: '#fff',
    boxSizing: 'border-box'
  },

  loading: {
    background: '#020617',
    border: '1px solid #12345f',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  card: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    background:
      'linear-gradient(180deg,#020617,#111827)',
    padding: 20,
    borderRadius: 20,
    marginTop: 16,
    border: '1px solid rgba(255,255,255,0.05)',
    flexWrap: 'wrap'
  },

  userName: {
    fontSize: 18
  },

  email: {
    color: '#94a3b8'
  },

  xtreamLogin: {
    color: '#facc15',
    fontWeight: 'bold'
  },

  watchingText: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  watchingTime: {
    color: '#94a3b8'
  },

  right: {
    minWidth: 320,
    textAlign: 'right'
  },

  role: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },

  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 10
  },

  modalActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap'
  },

  quickActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 14
  },

  smallDarkButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: 10,
    background: '#1e293b',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  smallYellowButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: 10,
    background:
      'linear-gradient(90deg,#facc15,#eab308)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  greenButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#22c55e,#16a34a)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  redButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  blueButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  grayButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: '#334155',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  yellowButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#facc15,#eab308)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  deleteButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#991b1b,#7f1d1d)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminUsers