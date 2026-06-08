import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function getExpireColor(date) {
  if (!date) return '#94a3b8'

  const diffDays = Math.ceil(
    (new Date(date).getTime() - Date.now()) / 1000 / 60 / 60 / 24
  )

  if (diffDays <= 0) return '#ef4444'
  if (diffDays <= 3) return '#facc15'
  return '#22c55e'
}

function ResellerPanel({ user, setUser, logout }) {
  const [reseller, setReseller] = useState(user)
  const [clients, setClients] = useState([])
  const [sales, setSales] = useState([])
  const [finance, setFinance] = useState({})
  const [creditHistory, setCreditHistory] = useState([])
  const [clientName, setClientName] = useState('')
  const [search, setSearch] = useState('')
  const [createdLogin, setCreatedLogin] = useState(null)
  const [loading, setLoading] = useState(true)

  const headers = useMemo(() => {
    return {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }, [])

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim()

    if (!q) return clients

    return clients.filter(client =>
      `${client.name || ''} ${client.email || ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [clients, search])

  async function loadDashboard() {
    try {
      setLoading(true)

      const res = await axios.get(
        `${API}/reseller/dashboard`,
        { headers }
      )

      setReseller(res.data.reseller || user)
      setClients(res.data.clients || [])
      setSales(res.data.sales || [])
      setFinance(res.data.finance || {})
      setCreditHistory(res.data.creditHistory || [])
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar painel revendedor')
    } finally {
      setLoading(false)
    }
  }

  async function createClient() {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/reseller/clients/create-random`,
        { name: clientName },
        { headers }
      )

      setCreatedLogin(res.data.login)
      setClientName('')
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function createTest24h() {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/reseller/clients/create-test`,
        { name: clientName || 'Teste 24H' },
        { headers }
      )

      setCreatedLogin(res.data.login)
      setClientName('')
      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar teste 24h')
    } finally {
      setLoading(false)
    }
  }

  async function updateClient(client, data) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/reseller/clients/${client.id}`,
        data,
        { headers }
      )

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

      await axios.patch(
        `${API}/reseller/clients/${client.id}/name`,
        { name },
        { headers }
      )

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

      const res = await axios.post(
        `${API}/reseller/clients/${client.id}/reset-password`,
        {},
        { headers }
      )

      setCreatedLogin(res.data.login)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao resetar senha')
    } finally {
      setLoading(false)
    }
  }

  async function addDays(client, days) {
    const now = new Date()
    const currentExpire = client.expires_at ? new Date(client.expires_at) : null
    const baseDate = currentExpire && currentExpire > now ? currentExpire : now

    baseDate.setDate(baseDate.getDate() + days)

    await updateClient(client, {
      expires_at: baseDate.toISOString()
    })
  }

  async function deleteClient(client) {
    if (!confirm('Excluir este cliente?')) return

    try {
      setLoading(true)

      await axios.delete(
        `${API}/reseller/clients/${client.id}`,
        { headers }
      )

      await loadDashboard()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir cliente')
    } finally {
      setLoading(false)
    }
  }

  function copyLogin() {
    if (!createdLogin) return

    navigator.clipboard.writeText(`
Nome: ${createdLogin.name}

Email: ${createdLogin.email}

Senha: ${createdLogin.password}
    `)

    alert('Login copiado')
  }

  useEffect(() => {
    loadDashboard()
  }, [])

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
        </div>

        <button style={styles.redButton} onClick={logout}>Sair</button>
      </aside>

      <main style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Painel Revendedor</h1>
            <p style={styles.subtitle}>Clientes, créditos, vendas, comissões e lucro.</p>
          </div>
        </div>

        <div style={styles.createBox}>
          <input
            placeholder='Nome do cliente'
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder='Pesquisar cliente...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.inputSearch}
          />

          <button
            style={styles.blueButton}
            onClick={createClient}
            disabled={loading || Number(reseller?.credits || 0) <= 0}
          >
            Criar cliente (-1 crédito)
          </button>

          <button
            style={styles.yellowButton}
            onClick={createTest24h}
            disabled={loading}
          >
            Gerar teste 24h
          </button>

          <button style={styles.grayButton} onClick={loadDashboard}>Atualizar</button>
        </div>

        {createdLogin && (
          <div style={styles.loginBox}>
            <h3>Login criado</h3>
            <input readOnly value={`Nome: ${createdLogin.name}`} style={styles.copyInput} />
            <input readOnly value={`Email: ${createdLogin.email}`} style={styles.copyInput} />
            <input readOnly value={`Senha: ${createdLogin.password}`} style={styles.copyInput} />
            <button style={styles.greenButton} onClick={copyLogin}>Copiar login</button>
          </div>
        )}

        {loading && <div style={styles.loading}>Processando...</div>}

        <div style={styles.statsGrid}>
          <div style={styles.cardBlue}><h1>{filteredClients.length}</h1><p>Clientes</p></div>
          <div style={styles.cardGreen}><h1>{clients.filter(c => c.status === 'active').length}</h1><p>Ativos</p></div>
          <div style={styles.cardRed}><h1>{clients.filter(c => c.status === 'blocked').length}</h1><p>Bloqueados</p></div>
          <div style={styles.cardPurple}><h1>{money(finance.vendas)}</h1><p>Vendas</p></div>
          <div style={styles.cardYellow}><h1>{money(finance.comissoes)}</h1><p>Comissão</p></div>
          <div style={styles.cardCyan}><h1>{money(finance.lucro)}</h1><p>Lucro</p></div>
        </div>

        <h2 style={styles.sectionTitle}>Clientes criados</h2>

        {filteredClients.map(client => (
          <div key={client.id} style={styles.clientCard}>
            <div>
              <strong style={styles.clientName}>{client.name}</strong>
              <p style={styles.email}>{client.email}</p>
              <small>Plano: {client.plan || 'premium'} • Conexões: {client.max_connections || 1}</small><br />
              <small>Status: {client.status}</small><br />
              <small style={{ color: getExpireColor(client.expires_at), fontWeight: 'bold' }}>
                Vence: {client.expires_at ? new Date(client.expires_at).toLocaleDateString('pt-BR') : 'Sem vencimento'}
              </small><br />
              <small style={styles.watching}>
                Assistindo: {client.watching ? `${client.watching_type}: ${client.watching}` : 'Nada no momento'}
              </small>
            </div>

            <div style={styles.actions}>
              <button style={styles.greenButton} onClick={() => updateClient(client, { status: 'active' })}>Ativar</button>
              <button style={styles.redButtonSmall} onClick={() => updateClient(client, { status: 'blocked' })}>Bloquear</button>
              <button style={styles.grayButton} onClick={() => renameClient(client)}>Editar nome</button>
              <button style={styles.grayButton} onClick={() => resetPassword(client)}>Resetar senha</button>
              <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 1 })}>1 conexão</button>
              <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 2 })}>2 conexões</button>
              <button style={styles.yellowButton} onClick={() => addDays(client, 30)}>+30 dias</button>
              <button style={styles.deleteButton} onClick={() => deleteClient(client)}>Excluir</button>
            </div>
          </div>
        ))}

        <div style={styles.historyGrid}>
          <div style={styles.historyBox}>
            <h2>Histórico de clientes criados</h2>
            {sales.map(item => (
              <div key={item.id} style={styles.historyItem}>
                <strong>{item.client_name}</strong>
                <p style={styles.email}>{item.client_email}</p>
                <small>{item.description}</small><br />
                <small>Venda: {money(item.sale_value)} • Comissão: {money(item.commission)} • Lucro: {money(item.profit)}</small><br />
                <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>
              </div>
            ))}
          </div>

          <div style={styles.historyBox}>
            <h2>Histórico de créditos</h2>
            {creditHistory.map(item => (
              <div key={item.id} style={styles.historyItem}>
                <strong style={{ color: Number(item.amount) >= 0 ? '#22c55e' : '#ef4444' }}>
                  {Number(item.amount) >= 0 ? '+' : ''}{item.amount} crédito(s)
                </strong>
                <p style={styles.email}>{item.description}</p>
                <small>{item.type}</small><br />
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
  main: { flex: 1, padding: 30, overflowY: 'auto' },
  title: { fontSize: 42, marginBottom: 5 },
  subtitle: { color: '#94a3b8' },
  topBar: { marginBottom: 24 },
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
  sectionTitle: { marginTop: 20 },
  clientCard: { display: 'flex', justifyContent: 'space-between', gap: 20, background: 'linear-gradient(180deg,#020617,#111827)', padding: 20, borderRadius: 20, marginTop: 16, border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' },
  clientName: { fontSize: 18 },
  email: { color: '#94a3b8' },
  watching: { color: '#38bdf8', fontWeight: 'bold' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', minWidth: 340 },
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
  deleteButton: { padding: '10px 14px', border: 'none', borderRadius: 12, background: 'linear-gradient(90deg,#991b1b,#7f1d1d)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }
}

export default ResellerPanel
