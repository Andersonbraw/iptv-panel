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

function AdminResellers() {
  const [resellers, setResellers] = useState([])
  const [clients, setClients] = useState([])
  const [selectedReseller, setSelectedReseller] = useState(null)
  const [name, setName] = useState('')
  const [credits, setCredits] = useState(10)
  const [addAmount, setAddAmount] = useState(10)
  const [createdLogin, setCreatedLogin] = useState(null)
  const [loading, setLoading] = useState(false)

  const headers = useMemo(() => {
    return {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }, [])

  async function loadResellers() {
    try {
      setLoading(true)

      const res = await axios.get(
        `${API}/admin/resellers`,
        { headers }
      )

      setResellers(res.data || [])
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar revendedores')
    } finally {
      setLoading(false)
    }
  }

  async function loadClients(reseller) {
    try {
      setSelectedReseller(reseller)

      const res = await axios.get(
        `${API}/admin/resellers/${reseller.id}/clients`,
        { headers }
      )

      setClients(res.data || [])
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar clientes')
    }
  }

  async function createReseller() {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/admin/resellers/create`,
        {
          name,
          credits: Number(credits || 0)
        },
        { headers }
      )

      setCreatedLogin(res.data.login)
      setName('')
      setCredits(10)
      await loadResellers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar revendedor')
    } finally {
      setLoading(false)
    }
  }

  async function addCredits(reseller) {
    try {
      setLoading(true)

      await axios.post(
        `${API}/admin/resellers/${reseller.id}/add-credits`,
        {
          amount: Number(addAmount || 0)
        },
        { headers }
      )

      await loadResellers()

      if (selectedReseller?.id === reseller.id) {
        await loadClients(reseller)
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao adicionar créditos')
    } finally {
      setLoading(false)
    }
  }

  async function updateReseller(reseller, data) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/resellers/${reseller.id}`,
        data,
        { headers }
      )

      await loadResellers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar revendedor')
    } finally {
      setLoading(false)
    }
  }

  async function updateClient(client, data) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/resellers/clients/${client.id}`,
        data,
        { headers }
      )

      if (selectedReseller) await loadClients(selectedReseller)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function renameClient(client) {
    const newName = prompt('Novo nome do cliente:', client.name)

    if (!newName) return

    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/resellers/clients/${client.id}/name`,
        { name: newName },
        { headers }
      )

      if (selectedReseller) await loadClients(selectedReseller)
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
        `${API}/admin/resellers/clients/${client.id}/reset-password`,
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

  async function renewClient(client) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/admin/resellers/clients/${client.id}/renew-30-days`,
        {},
        { headers }
      )

      if (selectedReseller) await loadClients(selectedReseller)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao renovar cliente')
    } finally {
      setLoading(false)
    }
  }

  async function deleteReseller(reseller) {
    if (!confirm('Excluir este revendedor? Os clientes dele continuam no sistema.')) return

    try {
      setLoading(true)

      await axios.delete(
        `${API}/admin/resellers/${reseller.id}`,
        { headers }
      )

      setSelectedReseller(null)
      setClients([])
      await loadResellers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir revendedor')
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
    loadResellers()
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Revendedores</h1>
          <p style={styles.subtitle}>
            Cada crédito vendido vale R$ 8,00. Gerencie revendedores e clientes.
          </p>
        </div>
      </div>

      <div style={styles.createBox}>
        <input
          placeholder='Nome do revendedor'
          value={name}
          onChange={e => setName(e.target.value)}
          style={styles.input}
        />

        <input
          type='number'
          min='0'
          value={credits}
          onChange={e => setCredits(e.target.value)}
          style={styles.smallInput}
        />

        <button style={styles.blueButton} onClick={createReseller} disabled={loading}>
          Criar Revendedor
        </button>

        <button style={styles.grayButton} onClick={loadResellers} disabled={loading}>
          Atualizar
        </button>
      </div>

      {createdLogin && (
        <div style={styles.loginBox}>
          <h3>Login criado / Senha resetada</h3>
          <input readOnly value={`Nome: ${createdLogin.name}`} style={styles.copyInput} />
          <input readOnly value={`Email: ${createdLogin.email}`} style={styles.copyInput} />
          <input readOnly value={`Senha: ${createdLogin.password}`} style={styles.copyInput} />
          <button style={styles.greenButton} onClick={copyLogin}>Copiar login</button>
        </div>
      )}

      {loading && <div style={styles.loading}>Processando...</div>}

      <div style={styles.mainGrid}>
        <div>
          {resellers.map(reseller => (
            <div key={reseller.id} style={styles.card}>
              <div>
                <strong style={styles.name}>{reseller.name}</strong>
                <p style={styles.email}>{reseller.email}</p>
                <small>Créditos: {reseller.credits || 0}</small><br />
                <small>Clientes: {reseller.clients_count || 0}</small><br />
                <small>Vendas: {money(reseller.vendas)}</small><br />
                <small>Comissão: {money(reseller.comissoes)}</small><br />
                <small>Lucro: {money(reseller.lucro)}</small><br />
                <small>Status: {reseller.status}</small>
              </div>

              <div style={styles.actions}>
                <input
                  type='number'
                  min='1'
                  value={addAmount}
                  onChange={e => setAddAmount(e.target.value)}
                  style={styles.creditInput}
                />

                <button style={styles.yellowButton} onClick={() => addCredits(reseller)}>
                  + Créditos
                </button>

                <button style={styles.greenButton} onClick={() => updateReseller(reseller, { status: 'active' })}>
                  Ativar
                </button>

                <button style={styles.redButton} onClick={() => updateReseller(reseller, { status: 'blocked' })}>
                  Bloquear
                </button>

                <button style={styles.blueButton} onClick={() => loadClients(reseller)}>
                  Ver clientes
                </button>

                <button style={styles.deleteButton} onClick={() => deleteReseller(reseller)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.clientsBox}>
          <h2 style={styles.clientsTitle}>
            {selectedReseller ? `Clientes de ${selectedReseller.name}` : 'Clientes do revendedor'}
          </h2>

          {!selectedReseller && (
            <p style={styles.subtitle}>Clique em "Ver clientes" em um revendedor.</p>
          )}

          {clients.map(client => (
            <div key={client.id} style={styles.clientCard}>
              <div style={styles.clientInfo}>
                <strong style={styles.clientName}>{client.name}</strong>
                <p style={styles.email}>{client.email}</p>
                <small>Status: {client.status}</small><br />
                <small>Plano: {client.plan}</small><br />
                <small>Conexões: {client.max_connections || 1}</small><br />
                <small style={{ color: getExpireColor(client.expires_at), fontWeight: 'bold' }}>
                  Vence: {client.expires_at ? new Date(client.expires_at).toLocaleString('pt-BR') : 'Sem vencimento'}
                </small>
              </div>

              <div style={styles.clientActions}>
                <button style={styles.grayButton} onClick={() => renameClient(client)}>
                  Editar nome
                </button>

                <button style={styles.purpleButton} onClick={() => resetPassword(client)}>
                  Resetar senha
                </button>

                <button style={styles.greenButton} onClick={() => updateClient(client, { status: 'active' })}>
                  Ativar
                </button>

                <button style={styles.redButton} onClick={() => updateClient(client, { status: 'blocked' })}>
                  Bloquear
                </button>

                <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 1 })}>
                  1 conexão
                </button>

                <button style={styles.grayButton} onClick={() => updateClient(client, { max_connections: 2 })}>
                  2 conexões
                </button>

                <button style={styles.yellowButton} onClick={() => renewClient(client)}>
                  Renovar 30 dias
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: 'linear-gradient(180deg,#07142b,#020617)',
    padding: 22,
    borderRadius: 24
  },

  header: {
    marginBottom: 18
  },

  title: {
    margin: 0,
    fontSize: 38
  },

  subtitle: {
    color: '#94a3b8'
  },

  createBox: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 20
  },

  input: {
    minWidth: 260,
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff'
  },

  smallInput: {
    width: 120,
    padding: 13,
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff'
  },

  creditInput: {
    width: 80,
    padding: 10,
    borderRadius: 10,
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

  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.35fr',
    gap: 18
  },

  card: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    background: 'linear-gradient(180deg,#020617,#111827)',
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    border: '1px solid rgba(255,255,255,0.05)',
    flexWrap: 'wrap'
  },

  name: {
    fontSize: 18
  },

  email: {
    color: '#94a3b8',
    margin: '6px 0'
  },

  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },

  clientsBox: {
    background: '#020617',
    borderRadius: 18,
    padding: 16,
    border: '1px solid rgba(56,189,248,0.15)',
    minHeight: 260
  },

  clientsTitle: {
    marginTop: 0
  },

  clientCard: {
    background: '#07142b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    border: '1px solid rgba(56,189,248,0.12)'
  },

  clientInfo: {
    marginBottom: 12
  },

  clientName: {
    fontSize: 18
  },

  clientActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 12
  },

  blueButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  greenButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#22c55e,#16a34a)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  yellowButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#facc15,#eab308)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  redButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#ef4444,#dc2626)',
    color: '#fff',
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

  purpleButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#a855f7,#7e22ce)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  deleteButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#991b1b,#7f1d1d)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminResellers
