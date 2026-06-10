import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API =
  'https://api.nexoratvs.shop'


const PANEL = 'https://nexoratvs.shop'

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
  const [newClientName, setNewClientName] = useState('')
  const [newClientPassword, setNewClientPassword] = useState('')
  const [nowTime, setNowTime] = useState(Date.now())

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

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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

  function getExpirationInfo(user) {
    if (!user.expires_at) {
      return {
        expired: false,
        text: 'Sem vencimento',
        endTime: 'Sem horário'
      }
    }

    const expireDate = new Date(user.expires_at)
    const diffMs = expireDate.getTime() - nowTime

    const endTime = expireDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    if (diffMs <= 0) {
      return {
        expired: true,
        text: 'Expirado',
        endTime
      }
    }

    const totalSeconds = Math.floor(diffMs / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const parts = []

    if (days > 0) {
      parts.push(`${days}d`)
    }

    parts.push(String(hours).padStart(2, '0'))
    parts.push(String(minutes).padStart(2, '0'))
    parts.push(String(seconds).padStart(2, '0'))

    return {
      expired: false,
      text: days > 0
        ? `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      endTime
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

  async function createTest5h() {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/admin/users/create-test-5h`,
        {
          name: clientName || 'Teste 5 Horas'
        },
        { headers }
      )

      setCreatedLogin({
        ...res.data.login,
        name: clientName || 'Teste 5 Horas'
      })

      setClientName('')
      reloadUsers()

      alert('Teste 5 horas criado')
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao criar teste 5 horas'
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

  function getM3ULink(user) {
    const username = getShortLogin(user)
    const password = user.password || ''

    if (!username || !password) {
      return ''
    }

    return `${API}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=mpegts`
  }

  function getShortLink(client) {
    const username = getShortLogin(client)

    if (!username) return ''

    return `${PANEL}/c/${encodeURIComponent(username)}`
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

    if (!String(newClientName || '').trim()) {
      alert('Digite o nome do cliente')
      return
    }

    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/users/${editingLoginUser.id}`,
        {
          name: String(newClientName || '').trim(),
          password: String(newClientPassword || '').trim() || undefined,
          xtream_username: login
        },
        { headers }
      )

      alert('Cliente atualizado')

      setEditingLoginUser(null)
      setNewXtreamLogin('')
      setNewClientName('')
      setNewClientPassword('')

      reloadUsers()
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Erro ao editar cliente'
      )
    } finally {
      setLoading(false)
    }
  }

  function openEditLogin(user) {
    setEditingLoginUser(user)
    setNewXtreamLogin(getShortLogin(user))
    setNewClientName(user.name || '')
    setNewClientPassword('')
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

  function copyUserShortLink(user) {
    const link = getShortLink(user)

    if (!link) {
      alert('Login indisponível')
      return
    }

    navigator.clipboard.writeText(link)
    alert('Link curto copiado')
  }

  function copyUserM3U(user) {
    const link = getM3ULink(user)

    if (!link) {
      alert('Senha não disponível. Atualize o backend enviado junto neste ZIP.')
      return
    }

    navigator.clipboard.writeText(link)
    alert('Link M3U copiado')
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

    const shortLogin =
      createdLogin.xtream_username ||
      String(createdLogin.email || '').replace(/\D/g, '')

    navigator.clipboard.writeText(`
Nome: ${createdLogin.name}

Email: ${createdLogin.email}

Login Xtream: ${shortLogin}

Senha: ${createdLogin.password}

Servidor: ${API}

M3U: ${API}/get.php?username=${encodeURIComponent(shortLogin)}&password=${encodeURIComponent(createdLogin.password)}&type=m3u_plus&output=mpegts

Link curto: ${PANEL}/c/${encodeURIComponent(shortLogin)}
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

          <button
            style={styles.orangeButton}
            onClick={createTest5h}
            disabled={loading}
          >
            Teste 5h
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
            value={`Login Xtream: ${createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, '')}`}
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

          <input
            readOnly
            value={`M3U: ${API}/get.php?username=${encodeURIComponent(createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, ''))}&password=${encodeURIComponent(createdLogin.password)}&type=m3u_plus&output=mpegts`}
            style={styles.copyInput}
          />

          <input
            readOnly
            value={`Link curto: ${PANEL}/c/${encodeURIComponent(createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, ''))}`}
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
            Use números curtos para facilitar na TV Box, exemplo: 823966.
          </p>

          <input
            type='text'
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            placeholder='Nome do cliente'
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
            placeholder='Login Xtream curto. Ex: 823966'
            style={styles.copyInput}
          />

          <input
            type='text'
            value={newClientPassword}
            onChange={e => setNewClientPassword(e.target.value)}
            placeholder='Nova senha (deixe vazio para manter a atual)'
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
                setNewClientName('')
                setNewClientPassword('')
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
        const expirationInfo = getExpirationInfo(user)

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

              <small
                style={{
                  color: expirationInfo.expired ? '#ef4444' : '#facc15',
                  fontWeight: 'bold'
                }}
              >
                Tempo restante: {expirationInfo.text}
              </small>

              <br />

              <small style={styles.expireTime}>
                Acaba às: {expirationInfo.endTime}
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
                      Editar cliente
                    </button>

                    <button
                      style={styles.smallDarkButton}
                      onClick={() => copyUserXtreamLogin(user)}
                    >
                      Copiar Xtream
                    </button>

                    <button
                      style={styles.purpleButton}
                      onClick={() => copyUserM3U(user)}
                    >
                      Gerar M3U
                    </button>

                    <button
                      style={styles.blueButton}
                      onClick={() => copyUserShortLink(user)}
                    >
                      Link curto
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
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, auto)',
    gap: 20,
    background:
      'linear-gradient(180deg,#020617,#111827)',
    padding: 20,
    borderRadius: 20,
    marginTop: 16,
    border: '1px solid rgba(255,255,255,0.05)',
    alignItems: 'start'
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

  expireTime: {
    color: '#cbd5e1',
    fontWeight: 'bold'
  },

  right: {
    minWidth: 360,
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start'
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
    marginTop: 10,
    maxWidth: 650
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

  orangeButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#fb923c,#ea580c)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(249,115,22,0.25)',
    whiteSpace: 'nowrap'
  },

  purpleButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background:
      'linear-gradient(90deg,#a855f7,#7e22ce)',
    color: '#fff',
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