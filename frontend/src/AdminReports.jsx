import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function AdminReports() {
  const [data, setData] = useState({
    totals: {},
    resellers: [],
    monthly: [],
    creditHistory: []
  })
  const [loading, setLoading] = useState(true)

  const headers = useMemo(() => {
    return {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }, [])

  async function loadReports() {
    try {
      setLoading(true)

      const res = await axios.get(
        `${API}/admin/reports/resellers`,
        { headers }
      )

      setData(res.data || {})
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  return (
    <div style={styles.box}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Relatórios Financeiros</h1>
          <p style={styles.subtitle}>
            Vendas, comissões, lucro mensal e créditos dos revendedores.
          </p>
        </div>

        <button style={styles.blueButton} onClick={loadReports}>
          Atualizar
        </button>
      </div>

      {loading && <div style={styles.loading}>Carregando relatórios...</div>}

      <div style={styles.statsGrid}>
        <div style={styles.cardBlue}>
          <h1>{money(data.totals?.vendas)}</h1>
          <p>Vendas totais</p>
        </div>

        <div style={styles.cardYellow}>
          <h1>{money(data.totals?.comissoes)}</h1>
          <p>Comissões</p>
        </div>

        <div style={styles.cardGreen}>
          <h1>{money(data.totals?.lucro)}</h1>
          <p>Lucro líquido</p>
        </div>

        <div style={styles.cardPurple}>
          <h1>{data.totals?.clients || 0}</h1>
          <p>Clientes de revendedores</p>
        </div>
      </div>

      <h2>Vendas por Revendedor</h2>

      <div style={styles.table}>
        {(data.resellers || []).map(item => (
          <div key={item.id} style={styles.row}>
            <div>
              <strong>{item.name}</strong>
              <p style={styles.muted}>{item.email}</p>
            </div>

            <span>Clientes: {item.clients_count || 0}</span>
            <span>Créditos: {item.credits || 0}</span>
            <span>Vendas: {money(item.vendas)}</span>
            <span>Comissão: {money(item.comissoes)}</span>
            <span>Lucro: {money(item.lucro)}</span>
          </div>
        ))}
      </div>

      <h2>Lucro Mensal</h2>

      <div style={styles.table}>
        {(data.monthly || []).map((item, index) => (
          <div key={index} style={styles.row}>
            <strong>
              {item.mes
                ? new Date(item.mes).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric'
                  })
                : 'Mês'}
            </strong>

            <span>Vendas: {money(item.vendas)}</span>
            <span>Comissões: {money(item.comissoes)}</span>
            <span>Lucro: {money(item.lucro)}</span>
            <span>Total: {item.total_vendas || 0}</span>
          </div>
        ))}
      </div>

      <h2>Histórico de Créditos</h2>

      <div style={styles.table}>
        {(data.creditHistory || []).map(item => (
          <div key={item.id} style={styles.row}>
            <div>
              <strong>{item.reseller_name || 'Revendedor'}</strong>
              <p style={styles.muted}>{item.description}</p>
            </div>

            <span style={{
              color: Number(item.amount) >= 0 ? '#22c55e' : '#ef4444',
              fontWeight: 'bold'
            }}>
              {Number(item.amount) >= 0 ? '+' : ''}{item.amount}
            </span>

            <span>{item.type}</span>

            <span>
              {item.created_at
                ? new Date(item.created_at).toLocaleString('pt-BR')
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const cardBase = {
  padding: 24,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.06)'
}

const styles = {
  box: {
    background: 'linear-gradient(180deg,#07142b,#020617)',
    padding: 22,
    borderRadius: 24
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 20
  },

  title: {
    margin: 0,
    fontSize: 38
  },

  subtitle: {
    color: '#94a3b8'
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

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: 18,
    marginBottom: 24
  },

  cardBlue: {
    ...cardBase,
    background: 'linear-gradient(180deg,#0f172a,#111827)'
  },

  cardYellow: {
    ...cardBase,
    background: 'linear-gradient(180deg,#713f12,#a16207)'
  },

  cardGreen: {
    ...cardBase,
    background: 'linear-gradient(180deg,#052e16,#14532d)'
  },

  cardPurple: {
    ...cardBase,
    background: 'linear-gradient(180deg,#3b0764,#581c87)'
  },

  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 28
  },

  row: {
    background: '#020617',
    border: '1px solid rgba(56,189,248,0.15)',
    borderRadius: 14,
    padding: 14,
    display: 'grid',
    gridTemplateColumns: '2fr repeat(5, 1fr)',
    gap: 10,
    alignItems: 'center'
  },

  muted: {
    color: '#94a3b8',
    margin: '4px 0 0'
  },

  blueButton: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#38bdf8,#0ea5e9)',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}

export default AdminReports
