import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'https://api.nexoratvs.shop'


const PANEL = 'https://nexoratvs.shop'

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function getExpireColor(date) {
  if (!date) return '#94a3b8'
  const diffDays = Math.ceil((new Date(date).getTime() - Date.now()) / 1000 / 60 / 60 / 24)
  if (diffDays <= 0) return '#ef4444'
  if (diffDays <= 3) return '#facc15'
  return '#22c55e'
}

function ResellerPanel({ user, logout }) {
  const [reseller, setReseller] = useState(user)
  const [clients, setClients] = useState([])
  const [sales, setSales] = useState([])
  const [finance, setFinance] = useState({})
  const [creditHistory, setCreditHistory] = useState([])
  const [payments, setPayments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [clientName, setClientName] = useState('')
  const [search, setSearch] = useState('')
  const [createdLogin, setCreatedLogin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pixPackages, setPixPackages] = useState([])
  const [pixOrders, setPixOrders] = useState([])
  const [activePix, setActivePix] = useState(null)
  const [editingClient, setEditingClient] = useState(null)
  const [editName, setEditName] = useState('')
  const [editXtream, setEditXtream] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editConnections, setEditConnections] = useState(1)
  const [nowTime, setNowTime] = useState(Date.now())

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }), [])

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return clients
    return clients.filter(client => `${client.name || ''} ${client.email || ''} ${client.xtream_username || ''}`.toLowerCase().includes(q))
  }, [clients, search])

  async function loadPixData() {
    try {
      const [packagesRes, ordersRes] = await Promise.all([
        axios.get(`${API}/reseller/pix/packages`, { headers }),
        axios.get(`${API}/reseller/pix/orders`, { headers })
      ])

      setPixPackages(packagesRes.data || [])
      setPixOrders(ordersRes.data || [])
    } catch (err) {
      console.log('Erro PIX:', err.message)
    }
  }

  async function createPixOrder(pack) {
    try {
      setLoading(true)
      const res = await axios.post(
        `${API}/reseller/pix/create-order`,
        {
          credits: pack.credits
        },
        { headers }
      )

      setActivePix(res.data)
      await loadPixData()
      alert('PIX gerado')
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao gerar PIX')
    } finally {
      setLoading(false)
    }
  }

  function copyPixCode(code) {
    navigator.clipboard.writeText(code)
    alert('Código PIX copiado')
  }

  async function loadDashboard() {
    try {
      setLoading(true)
      const res = await axios.get(`${API}/reseller/dashboard`, { headers })
      setReseller(res.data.reseller || user)
      setClients(res.data.clients || [])
      setSales(res.data.sales || [])
      setFinance(res.data.finance || {})
      setCreditHistory(res.data.creditHistory || [])
      setPayments(res.data.payments || [])
      setNotifications(res.data.notifications || [])
      await loadPixData()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar painel revendedor')
    } finally {
      setLoading(false)
    }
  }

  async function createClient() {
    try {
      setLoading(true)
      const res = await axios.post(`${API}/reseller/clients/create-random`, { name: clientName }, { headers })
      setCreatedLogin(res.data.login)
      setClientName('')
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function createTest5h() {
    try {
      setLoading(true)
      const res = await axios.post(`${API}/reseller/clients/create-test`, { name: clientName || 'Teste 5H' }, { headers })
      setCreatedLogin(res.data.login)
      setClientName('')
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar teste 5h')
    } finally {
      setLoading(false)
    }
  }

  async function updateClient(client, data) {
    try {
      setLoading(true)
      await axios.patch(`${API}/reseller/clients/${client.id}`, data, { headers })
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function renameClient(client) {
    const name = prompt('Novo nome do cliente:', client.name)
    if (!name) return
    try {
      setLoading(true)
      await axios.patch(`${API}/reseller/clients/${client.id}/name`, { name }, { headers })
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao editar nome')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(client) {
    if (!confirm('Resetar senha deste cliente?')) return
    try {
      setLoading(true)
      const res = await axios.post(`${API}/reseller/clients/${client.id}/reset-password`, {}, { headers })
      setCreatedLogin(res.data.login)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao resetar senha')
    } finally {
      setLoading(false)
    }
  }

  async function renewClient(client) {
    if (!confirm('Renovar este cliente por 30 dias? Será descontado 1 crédito.')) return
    try {
      setLoading(true)
      await axios.post(`${API}/reseller/clients/${client.id}/renew-30-days`, {}, { headers })
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao renovar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function deleteClient(client) {
    if (!confirm('Excluir este cliente?')) return
    try {
      setLoading(true)
      await axios.delete(`${API}/reseller/clients/${client.id}`, { headers })
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir cliente')
    } finally {
      setLoading(false)
    }
  }

  function getShortLogin(client) {
    return (
      client.xtream_username ||
      String(client.email || '').replace(/\D/g, '') ||
      client.email ||
      ''
    )
  }

  function getM3ULink(client) {
    const username = getShortLogin(client)
    const password = client.password || ''

    if (!username || !password) return ''

    return `${API}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=mpegts`
  }

  function getShortLink(client) {
    const username = getShortLogin(client)

    if (!username) return ''

    return `${PANEL}/c/${encodeURIComponent(username)}`
  }

  function getExpirationInfo(client) {
    if (!client.expires_at) {
      return {
        expired: false,
        text: 'Sem vencimento',
        endTime: 'Sem horário'
      }
    }

    const expireDate = new Date(client.expires_at)
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

    return {
      expired: false,
      text: days > 0
        ? `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      endTime
    }
  }

  function copyXtream(client) {
    const username = getShortLogin(client)

    navigator.clipboard.writeText(`
Lista: Nexora TV

Servidor: ${API}

Usuário: ${username}

Senha: ${client.password || 'senha do cliente'}
    `)

    alert('Dados Xtream copiados')
  }

  function copyShortLink(client) {
    const link = getShortLink(client)

    if (!link) {
      alert('Login indisponível')
      return
    }

    navigator.clipboard.writeText(link)
    alert('Link curto copiado')
  }

  function copyM3U(client) {
    const link = getM3ULink(client)

    if (!link) {
      alert('Senha indisponível. Atualize o backend deste ZIP.')
      return
    }

    navigator.clipboard.writeText(link)
    alert('Link M3U copiado')
  }

  function openEditClient(client) {
    setEditingClient(client)
    setEditName(client.name || '')
    setEditXtream(getShortLogin(client))
    setEditPassword('')
    setEditConnections(Number(client.max_connections || 1))
  }

  async function saveClientEdit() {
    if (!editingClient) return

    if (!String(editName || '').trim()) {
      alert('Digite o nome do cliente')
      return
    }

    const login = String(editXtream || '')
      .replace(/\D/g, '')
      .trim()

    if (!login || login.length < 3) {
      alert('Digite um login Xtream numérico válido')
      return
    }

    try {
      setLoading(true)

      await axios.patch(
        `${API}/reseller/clients/${editingClient.id}/full-edit`,
        {
          name: String(editName || '').trim(),
          xtream_username: login,
          password: String(editPassword || '').trim() || undefined,
          max_connections: Number(editConnections || 1)
        },
        { headers }
      )

      setEditingClient(null)
      setEditName('')
      setEditXtream('')
      setEditPassword('')
      setEditConnections(1)

      await loadDashboard()

      alert('Cliente atualizado')
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao editar cliente')
    } finally {
      setLoading(false)
    }
  }

  function exportClientsCSV() {
    const rows = [
      ['Nome', 'Email', 'Login Xtream', 'Senha', 'Plano', 'Status', 'Conexoes', 'Vencimento', 'M3U'],
      ...clients.map(client => [
        client.name,
        client.email,
        getShortLogin(client),
        client.password || '',
        client.plan,
        client.status,
        client.max_connections || 1,
        client.expires_at ? new Date(client.expires_at).toLocaleString('pt-BR') : '',
        getM3ULink(client)
      ])
    ]
    const csv = rows.map(row => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'meus-clientes.csv'
    link.click()
    URL.revokeObjectURL(url)
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

  useEffect(() => { loadDashboard() }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const maxBar = Math.max(Number(finance.vendas_mes || 0), Number(finance.lucro_mes || 0), 8)

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.logo}>NEXORA TV</h1>

        <div style={styles.userBox}>
          <small style={styles.userType}>REVENDEDOR</small>
          <h2>{reseller?.name}</h2>
          <p style={styles.email}>{reseller?.email}</p>
          <h1 style={styles.credits}>{reseller?.credits || 0}</h1>
          <p style={styles.email}>Créditos disponíveis</p>
          <h2 style={styles.balance}>{money(reseller?.balance)}</h2>
          <p style={styles.email}>Saldo comissão</p>
          <p style={styles.email}>Comissão: {reseller?.commission_rate || 0}%</p>
          <p style={styles.email}>Preço venda: {money(reseller?.sale_price || 20)}</p>
        </div>

        <button style={styles.redButton} onClick={logout}>Sair</button>
      </aside>

      <main style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Painel Revendedor</h1>
            <p style={styles.subtitle}>Preço de venda configurado pelo admin. Clientes, saldo, gráficos, notificações e testes.</p>
          </div>
        </div>

        <div style={styles.notificationsBox}>
          <h2>🔔 Notificações</h2>
          {notifications.length === 0 && <p style={styles.email}>Nenhuma notificação agora.</p>}
          {notifications.map((item, index) => (
            <div key={index} style={styles.notificationItem}>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
            </div>
          ))}
        </div>

        <div style={styles.pixBuyBox}>
          <h2>Comprar créditos via PIX</h2>
          <p style={styles.subtitle}>Escolha um pacote, pague no PIX e aguarde a liberação dos créditos.</p>

          <div style={styles.pixPackages}>
            {(pixPackages.length ? pixPackages : [
              { credits: 10, amount: 80 },
              { credits: 20, amount: 150 },
              { credits: 50, amount: 350 }
            ]).map(pack => (
              <button
                key={pack.credits}
                style={styles.pixPackageButton}
                onClick={() => createPixOrder(pack)}
                disabled={loading}
              >
                <strong>{pack.credits} créditos</strong>
                <span>{money(pack.amount)}</span>
              </button>
            ))}
          </div>

          {activePix && (
            <div style={styles.pixCodeBox}>
              <strong>PIX gerado: {activePix.package_credits} créditos • {money(activePix.amount)}</strong>
              <textarea
                readOnly
                value={activePix.pix_code}
                style={styles.pixTextarea}
              />
              <button style={styles.greenButton} onClick={() => copyPixCode(activePix.pix_code)}>
                Copiar código PIX
              </button>
            </div>
          )}

          <h3>Meus pedidos PIX</h3>
          {pixOrders.slice(0, 5).map(order => (
            <div key={order.id} style={styles.pixOrderItem}>
              <span>{order.package_credits} créditos • {money(order.amount)}</span>
              <strong style={{ color: order.status === 'paid' ? '#22c55e' : '#facc15' }}>
                {order.status === 'paid' ? 'Pago' : 'Pendente'}
              </strong>
            </div>
          ))}
        </div>

        <div style={styles.createBox}>
          <input placeholder='Nome do cliente ou teste' value={clientName} onChange={e => setClientName(e.target.value)} style={styles.input} />
          <input placeholder='Pesquisar cliente...' value={search} onChange={e => setSearch(e.target.value)} style={styles.inputSearch} />
          <button style={styles.blueButton} onClick={createClient} disabled={loading || Number(reseller?.credits || 0) <= 0}>Criar cliente (-1 crédito)</button>
          <button style={styles.yellowButton} onClick={createTest5h} disabled={loading}>Gerar teste 5 horas</button>
          <button style={styles.greenButton} onClick={exportClientsCSV}>Exportar CSV</button>
          <button style={styles.grayButton} onClick={loadDashboard}>Atualizar</button>
        </div>

        {createdLogin && (
          <div style={styles.loginBox}>
            <h3>Login criado / Senha resetada</h3>
            <input readOnly value={`Nome: ${createdLogin.name}`} style={styles.copyInput} />
            <input readOnly value={`Email: ${createdLogin.email}`} style={styles.copyInput} />
            <input readOnly value={`Login Xtream: ${createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, '')}`} style={styles.copyInput} />
            <input readOnly value={`Servidor: ${API}`} style={styles.copyInput} />
            <input readOnly value={`Senha: ${createdLogin.password}`} style={styles.copyInput} />
            <input readOnly value={`M3U: ${API}/get.php?username=${encodeURIComponent(createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, ''))}&password=${encodeURIComponent(createdLogin.password)}&type=m3u_plus&output=mpegts`} style={styles.copyInput} />
            <input readOnly value={`Link curto: ${PANEL}/c/${encodeURIComponent(createdLogin.xtream_username || String(createdLogin.email || '').replace(/\D/g, ''))}`} style={styles.copyInput} />
            <button style={styles.greenButton} onClick={copyLogin}>Copiar login</button>
          </div>
        )}

        {editingClient && (
          <div style={styles.loginBox}>
            <h3>Editar Cliente</h3>

            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder='Nome do cliente'
              style={styles.copyInput}
            />

            <input
              value={editXtream}
              onChange={e => setEditXtream(e.target.value.replace(/\D/g, ''))}
              placeholder='Login Xtream curto'
              style={styles.copyInput}
            />

            <input
              value={editPassword}
              onChange={e => setEditPassword(e.target.value)}
              placeholder='Nova senha (deixe vazio para manter)'
              style={styles.copyInput}
            />

            <select
              value={editConnections}
              onChange={e => setEditConnections(e.target.value)}
              style={styles.copyInput}
            >
              <option value='1'>1 conexão</option>
              <option value='2'>2 conexões</option>
              <option value='3'>3 conexões</option>
              <option value='5'>5 conexões</option>
              <option value='10'>10 conexões</option>
            </select>

            <div style={styles.actionsLeft}>
              <button style={styles.greenButton} onClick={saveClientEdit} disabled={loading}>
                Salvar
              </button>

              <button style={styles.grayButton} onClick={() => setEditingClient(null)} disabled={loading}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading && <div style={styles.loading}>Processando...</div>}

        <div style={styles.statsGrid}>
          <div style={styles.cardBlue}><h1>{filteredClients.length}</h1><p>Clientes</p></div>
          <div style={styles.cardGreen}><h1>{clients.filter(c => c.status === 'active').length}</h1><p>Ativos</p></div>
          <div style={styles.cardRed}><h1>{clients.filter(c => c.status === 'blocked').length}</h1><p>Bloqueados</p></div>
          <div style={styles.cardPurple}><h1>{money(finance.vendas_mes)}</h1><p>Faturamento mês</p></div>
          <div style={styles.cardYellow}><h1>{money(finance.comissoes_mes)}</h1><p>Comissão mês</p></div>
          <div style={styles.cardCyan}><h1>{money(finance.vendas_hoje)}</h1><p>Faturamento hoje</p></div>
          <div style={styles.cardRed}><h1>{clients.filter(c => c.expires_at && new Date(c.expires_at).getTime() < Date.now()).length}</h1><p>Vencidos</p></div>
          <div style={styles.cardPurple}><h1>{clients.filter(c => c.plan === 'teste').length}</h1><p>Testes</p></div>
        </div>

        <div style={styles.chartBox}>
          <h2>📊 Gráfico mensal</h2>
          <div style={styles.barLine}>
            <span>Vendas</span>
            <div style={styles.barBg}><div style={{ ...styles.barFill, width: `${Math.min(100, (Number(finance.vendas_mes || 0) / maxBar) * 100)}%` }} /></div>
            <strong>{money(finance.vendas_mes)}</strong>
          </div>
          <div style={styles.barLine}>
            <span>Comissão</span>
            <div style={styles.barBg}><div style={{ ...styles.barFill, width: `${Math.min(100, (Number(finance.comissoes_mes || 0) / maxBar) * 100)}%` }} /></div>
            <strong>{money(finance.comissoes_mes)}</strong>
          </div>
          <div style={styles.barLine}>
            <span>Hoje</span>
            <div style={styles.barBg}><div style={{ ...styles.barFill, width: `${Math.min(100, (Number(finance.vendas_hoje || 0) / maxBar) * 100)}%` }} /></div>
            <strong>{money(finance.vendas_hoje)}</strong>
          </div>
        </div>

        <h2 style={styles.sectionTitle}>Clientes criados</h2>

        {filteredClients.map(client => {
          const expirationInfo = getExpirationInfo(client)

          return (
          <div key={client.id} style={styles.clientCard}>
            <div>
              <strong style={styles.clientName}>{client.name}</strong>
              <p style={styles.email}>{client.email}</p>
              <small style={styles.xtreamLogin}>Login Xtream: {getShortLogin(client)}</small><br />
              <small>Servidor: {API}</small><br />
              <small>Plano: {client.plan || 'premium'} • Conexões: {client.max_connections || 1}</small><br />
              <small>Status: {client.status}</small><br />
              <small style={{ color: getExpireColor(client.expires_at), fontWeight: 'bold' }}>
                Vence: {client.expires_at ? new Date(client.expires_at).toLocaleString('pt-BR') : 'Sem vencimento'}
              </small><br />
              <small style={{ color: expirationInfo.expired ? '#ef4444' : '#facc15', fontWeight: 'bold' }}>
                Tempo restante: {expirationInfo.text}
              </small><br />
              <small style={styles.expireTime}>Acaba às: {expirationInfo.endTime}</small><br />
              <small style={styles.watching}>Assistindo: {client.watching ? `${client.watching_type}: ${client.watching}` : 'Nada no momento'}</small>
            </div>

            <div style={styles.actions}>
              <button style={styles.greenButton} onClick={() => updateClient(client, { status: 'active' })}>Ativar</button>
              <button style={styles.redButtonSmall} onClick={() => updateClient(client, { status: 'blocked' })}>Bloquear</button>
              <button style={styles.grayButton} onClick={() => openEditClient(client)}>Editar cliente</button>
              <button style={styles.purpleButton} onClick={() => resetPassword(client)}>Resetar senha</button>
              <button style={styles.blueButton} onClick={() => copyXtream(client)}>Copiar Xtream</button>
              <button style={styles.purpleButton} onClick={() => copyM3U(client)}>Gerar M3U</button>
              <button style={styles.blueButton} onClick={() => copyShortLink(client)}>Link curto</button>
              <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 1 })}>1 conexão</button>
              <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 2 })}>2 conexões</button>
              <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 3 })}>3 conexões</button>
              <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 5 })}>5 conexões</button>
              <button style={styles.yellowButton} onClick={() => renewClient(client)}>+30 dias</button>
              <button style={styles.deleteButton} onClick={() => deleteClient(client)}>Excluir</button>
            </div>
          </div>
          )
        })}

        <div style={styles.historyGrid}>
          <div style={styles.historyBox}>
            <h2>Histórico de clientes criados</h2>
            {sales.map(item => (
              <div key={item.id} style={styles.historyItem}>
                <strong>{item.client_name}</strong>
                <p style={styles.email}>{item.client_email}</p>
                <small>{item.description}</small><br />
                <small>Venda: {money(item.sale_value)} • Comissão: {money(item.commission)} • Lucro Admin: {money(item.profit)}</small><br />
                <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>
              </div>
            ))}
          </div>

          <div style={styles.historyBox}>
            <h2>Histórico de créditos e pagamentos</h2>
            {creditHistory.map(item => (
              <div key={`c-${item.id}`} style={styles.historyItem}>
                <strong style={{ color: Number(item.amount) >= 0 ? '#22c55e' : '#ef4444' }}>{Number(item.amount) >= 0 ? '+' : ''}{item.amount} crédito(s)</strong>
                <p style={styles.email}>{item.description}</p>
                <small>{item.type}</small><br />
                <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>
              </div>
            ))}
            {payments.map(item => (
              <div key={`p-${item.id}`} style={styles.historyItem}>
                <strong style={{ color: '#22c55e' }}>Pagamento: {money(item.amount)}</strong>
                <p style={styles.email}>{item.description}</p>
                <small>{item.method} • {item.status}</small><br />
                <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

const cardBase = { padding: 24, borderRadius: 22, border: '1px solid rgba(255,255,255,0.06)' }

const styles = {
  app: { display: 'flex', minHeight: '100vh', background: '#000814', color: '#fff', fontFamily: 'Arial' },
  sidebar: { width: 280, background: '#020f2d', padding: 20, borderRight: '1px solid #0f2248', display: 'flex', flexDirection: 'column' },
  logo: { color: '#38bdf8', fontSize: 34, textAlign: 'center', marginBottom: 30, fontWeight: 'bold' },
  userBox: { background: 'linear-gradient(180deg,#09152f,#071127)', padding: 20, borderRadius: 24, marginBottom: 25, border: '1px solid rgba(255,255,255,0.05)' },
  userType: { color: '#94a3b8', fontSize: 12 },
  credits: { color: '#facc15', fontSize: 48, margin: '12px 0 0' },
  balance: { color: '#22c55e', margin: '12px 0 0' },
  main: { flex: 1, padding: 30, overflowY: 'auto' },
  title: { fontSize: 42, marginBottom: 5 },
  subtitle: { color: '#94a3b8' },
  topBar: { marginBottom: 24 },
  notificationsBox: { background: '#07142b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 18, padding: 16, marginBottom: 18 },
  notificationItem: { background: '#020617', padding: 12, borderRadius: 12, marginBottom: 8 },
  pixBuyBox: { background: '#07142b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 22, padding: 18, marginBottom: 22 },
  pixPackages: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  pixPackageButton: { minWidth: 160, padding: 18, border: 'none', borderRadius: 16, background: 'linear-gradient(180deg,#14532d,#052e16)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' },
  pixCodeBox: { background: '#020617', border: '1px solid #38bdf8', borderRadius: 16, padding: 14, marginBottom: 16 },
  pixTextarea: { width: '100%', minHeight: 95, marginTop: 10, marginBottom: 10, padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#07142b', color: '#fff', boxSizing: 'border-box' },
  pixOrderItem: { display: 'flex', justifyContent: 'space-between', gap: 12, background: '#020617', padding: 12, borderRadius: 12, marginTop: 8 },
  createBox: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22, background: '#07142b', padding: 18, borderRadius: 22 },
  input: { minWidth: 240, flex: 1, padding: 14, borderRadius: 14, border: '1px solid #334155', background: '#020617', color: '#fff' },
  inputSearch: { minWidth: 220, padding: 14, borderRadius: 14, border: '1px solid #334155', background: '#020617', color: '#fff' },
  loginBox: { background: '#020617', padding: 18, borderRadius: 18, marginBottom: 20, border: '1px solid #38bdf8' },
  copyInput: { width: '100%', padding: 12, marginBottom: 10, borderRadius: 12, border: '1px solid #334155', background: '#07142b', color: '#fff', boxSizing: 'border-box' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 18, marginBottom: 26 },
  cardBlue: { ...cardBase, background: 'linear-gradient(180deg,#0f172a,#111827)' },
  cardGreen: { ...cardBase, background: 'linear-gradient(180deg,#052e16,#14532d)' },
  cardRed: { ...cardBase, background: 'linear-gradient(180deg,#450a0a,#7f1d1d)' },
  cardPurple: { ...cardBase, background: 'linear-gradient(180deg,#3b0764,#581c87)' },
  cardYellow: { ...cardBase, background: 'linear-gradient(180deg,#713f12,#a16207)' },
  cardCyan: { ...cardBase, background: 'linear-gradient(180deg,#083344,#155e75)' },
  chartBox: { background: '#020617', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 20, padding: 18, marginBottom: 24 },
  barLine: { display: 'grid', gridTemplateColumns: '120px 1fr 130px', gap: 12, alignItems: 'center', marginBottom: 12 },
  barBg: { background: '#111827', height: 18, borderRadius: 999, overflow: 'hidden' },
  barFill: { background: 'linear-gradient(90deg,#38bdf8,#22c55e)', height: '100%', borderRadius: 999 },
  sectionTitle: { marginTop: 20 },
  clientCard: { display: 'flex', justifyContent: 'space-between', gap: 20, background: 'linear-gradient(180deg,#020617,#111827)', padding: 20, borderRadius: 20, marginTop: 16, border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' },
  clientName: { fontSize: 18 },
  email: { color: '#94a3b8' },
  watching: { color: '#38bdf8', fontWeight: 'bold' },
  xtreamLogin: { color: '#facc15', fontWeight: 'bold' },
  expireTime: { color: '#cbd5e1', fontWeight: 'bold' },
  actionsLeft: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', maxWidth: 780 },
  loading: { background: '#020617', border: '1px solid #12345f', padding: 14, borderRadius: 14, marginBottom: 20, color: '#38bdf8', fontWeight: 'bold' },
  historyGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 30 },
  historyBox: { background: '#020617', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 20, padding: 18 },
  historyItem: { background: '#07142b', borderRadius: 14, padding: 14, marginBottom: 10 },
  blueButton: { padding: '12px 16px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)', color: '#000', fontWeight: 'bold', cursor: 'pointer' },
  greenButton: { padding: '10px 14px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#000', fontWeight: 'bold', cursor: 'pointer' },
  redButton: { marginTop: 'auto', width: '100%', padding: 15, border: 'none', borderRadius: 14, background: 'linear-gradient(90deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  redButtonSmall: { padding: '10px 14px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  yellowButton: { padding: '10px 14px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#facc15,#eab308)', color: '#000', fontWeight: 'bold', cursor: 'pointer' },
  grayButton: { padding: '10px 14px', border: 'none', borderRadius: 12, background: '#334155', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  purpleButton: { padding: '10px 14px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#a855f7,#7e22ce)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  deleteButton: { padding: '10px 14px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#991b1b,#7f1d1d)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }
}

export default ResellerPanel
