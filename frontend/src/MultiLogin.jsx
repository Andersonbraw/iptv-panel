import React from 'react'
import axios from 'axios'
import {
  Home,
  Tv,
  Film,
  Clapperboard,
  Radio,
  CalendarDays,
  Star,
  Monitor,
  Settings,
  LogOut,
  Play,
  User,
  Crown,
  Server,
  RefreshCw,
  ChevronRight
} from 'lucide-react'

const API = 'http://paineliptvonline.kesug.com:3000'

async function toggleUserStatus(user, reloadUsers) {
  try {
    const token = localStorage.getItem('token')

    const newStatus =
      user.status === 'active'
        ? 'blocked'
        : 'active'

    await axios.put(
      `${API}/admin/users/${user.id}/status`,
      {
        status: newStatus
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    reloadUsers()

  } catch (err) {
    console.log(err)
  }
}
export default function MultiLogin({
  onBack,
  adminUsers,
  reloadUsers
}) {
  
  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <Tv size={56} color="#ff8a00" />
          <h1>IPTV</h1>
        </div>

        <MenuItem icon={<Home />} text="Painel" active />
        <MenuItem
          icon={<Tv />}
          text="TV ao Vivo"
          onClick={onBack}
        />

        <MenuItem icon={<Film />} text="Filmes" />
        <MenuItem icon={<Clapperboard />} text="Séries" />
        <MenuItem icon={<Radio />} text="Rádios" />
        <MenuItem icon={<CalendarDays />} text="EPG / Programação" />
        <MenuItem icon={<Star />} text="Favoritos" />
        <MenuItem icon={<Monitor />} text="Multi-Screen" />
        <MenuItem icon={<Settings />} text="Configurações" />
        <MenuItem
          icon={<LogOut />}
          text="Sair"
          danger
          onClick={() => {
            localStorage.clear()
            window.location.reload()
          }}
        />
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h2>Bem-vindo!</h2>
            <p>Painel de controle da sua conta IPTV</p>
          </div>

          <div style={styles.userBox}>
            <span>🕘 20:30</span>
            <div style={styles.userIcon}>
              <User />
            </div>
            <div>
              <strong>Usuário</strong>
              <p>Plano Premium</p>
            </div>
          </div>
        </header>

        <section style={styles.cards}>
          <BigCard color="#ff8a00" icon={<Tv size={70} />} number="1524" label="CANAIS" sub="ao vivo" />
          <BigCard color="#54b82f" icon={<Film size={70} />} number="3287" label="FILMES" sub="disponíveis" />
          <BigCard color="#ef2d2d" icon={<Clapperboard size={70} />} number="842" label="SÉRIES" sub="disponíveis" />
        </section>

        <section style={styles.bottomGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>Conexão</h3>
              <span style={styles.online}>● Ativa</span>
            </div>

            <div style={styles.connectionContent}>
              <div style={styles.serverIcon}>
                <Server size={52} />
              </div>

              <div>
                <p>Servidor: <strong>Servidor Premium 01</strong></p>
                <p>Status: <span style={styles.green}>Conectado</span></p>
                <p>Expira em: 23/06/2024</p>
                <p>Dispositivos conectados: 2 / 5</p>
              </div>
            </div>

            <button style={styles.checkButton}>
              <RefreshCw size={18} /> Verificar conexão
            </button>
          </div>

          <div style={styles.panel}>
            <h3>Atalhos rápidos</h3>

            <div style={styles.quickGrid}>
              <Quick icon={<Tv />} text="TV ao Vivo" color="#ff8a00" />
              <Quick icon={<Film />} text="Filmes" color="#54b82f" />
              <Quick icon={<Clapperboard />} text="Séries" color="#ef4444" />
              <Quick icon={<Star />} text="Favoritos" color="#ff8a00" />
            </div>
          </div>

          <div style={styles.panel}>
            <h3>Informações da conta</h3>

<div
  style={{
    marginTop: 20,
    width: '100%',
    fontSize: 12,
    background: '#101826',
    borderRadius: 20,
    padding: 20
  }}
>
  <h2>Usuários IPTV</h2>

  {adminUsers?.map(user => (
  <div
    key={user.id}
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: 10,
      padding: 12,
      marginTop: 10,
      borderRadius: 12,
      background: '#0b1120'
    }}
  >
    <div>
      <strong>{user.name}</strong>

      <div style={{ color: '#94a3b8' }}>
        {user.email}
      </div>
    </div>

    <div style={{ minWidth: 90 }}>
      <div>{user.role}</div>

      <button
        onClick={() => toggleUserStatus(user, reloadUsers)}
        style={{
          marginTop: 8,
          width: '100%',
          fontSize: 12,
          background:
            user.status === 'active'
              ? '#ef4444'
              : '#22c55e',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        {user.status === 'active'
          ? 'Bloquear'
          : 'Ativar'}
      </button>

      <button
        onClick={async () => {
          const token = localStorage.getItem('token')

          await axios.patch(
            `${API}/admin/users/${user.id}`,
            {
              plan:
                user.plan === 'premium'
                  ? 'free'
                  : 'premium',

              max_connections:
                user.plan === 'premium'
                  ? 1
                  : 5
            },
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          )

          reloadUsers()
        }}
        style={{
          marginTop: 6,
          width: '100%',
          fontSize: 12,
          background: '#f59e0b',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 8,
          color: '#000',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        {user.plan === 'premium'
          ? 'Plano Free'
          : 'Premium'}
      </button>

      <button
        onClick={async () => {
          const token = localStorage.getItem('token')

          const future = new Date()
          future.setDate(future.getDate() + 30)

          await axios.patch(
            `${API}/admin/users/${user.id}`,
            {
              expires_at: future.toISOString()
            },
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          )

          reloadUsers()
        }}
        style={{
          marginTop: 6,
          width: '100%',
          fontSize: 12,
          background: '#2563eb',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        +30 Dias
      </button>

      <div
        style={{
          marginTop: 6,
          color:
            user.status === 'active'
              ? '#22c55e'
              : '#ef4444'
        }}
      >
        {user.status}
      </div>

      <div
        style={{
          marginTop: 4,
          color: '#94a3b8',
          fontSize: 12
        }}
      >
        {user.expires_at
          ? new Date(user.expires_at).toLocaleDateString()
          : 'Sem vencimento'}
      </div>
    </div>
  </div>
))}
</div>

            <Info icon={<Crown />} label="Plano:" value="Premium" color="#ff8a00" />
            <Info icon={<Monitor />} label="Conexões:" value="2 / 5 dispositivos" color="#54b82f" />
            <Info icon={<CalendarDays />} label="Vencimento:" value="23/06/2024" color="#ef4444" />
            <Info icon={<Star />} label="Status:" value="Ativo" color="#54b82f" />
          </div>
        </section>

        <footer style={styles.footer}>
          © 2026 IPTV - Todos os direitos reservados.
        </footer>
      </main>
    </div>
  )
}

function MenuItem({ icon, text, active, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.menuItem,
        ...(active ? styles.menuActive : {}),
        ...(danger ? styles.menuDanger : {})
      }}
    >
      {icon}
      <span>{text}</span>
    </button>
  )
}

function BigCard({ color, icon, number, label, sub }) {
  return (
    <div style={{ ...styles.bigCard, background: `linear-gradient(160deg, ${color}, #111)` }}>
      <div style={styles.bigIcon}>{icon}</div>
      <div>
        <h1>{number}</h1>
        <h2>{label}</h2>
        <p>{sub}</p>
      </div>
      <div style={styles.cardFooter}>Ver todos <ChevronRight /></div>
    </div>
  )
}

function Quick({ icon, text, color }) {
  return (
    <div style={styles.quick}>
      <div style={{ color }}>{icon}</div>
      <p>{text}</p>
    </div>
  )
}

function Info({ icon, label, value, color }) {
  return (
    <div style={styles.info}>
      <div style={{ color }}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong style={{ color }}>{value}</strong>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: 'radial-gradient(circle at top, #1d2529, #050707 70%)',
    color: '#fff',
    fontFamily: 'Arial, sans-serif'
  },
  sidebar: {
    width: 280,
    padding: 28,
    background: 'rgba(10,15,17,.9)',
    borderRight: '1px solid rgba(255,255,255,.08)'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 50
  },
  menuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    padding: '18px 24px',
    border: 'none',
    borderRadius: 12,
    background: 'transparent',
    color: '#ddd',
    fontSize: 18,
    cursor: 'pointer',
    marginBottom: 10
  },
  menuActive: {
    background: 'linear-gradient(90deg,#ff8a00,#ff5a00)',
    color: '#fff'
  },
  menuDanger: {
    color: '#ef4444'
  },
  main: {
    flex: 1,
    padding: 40
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 35
  },
  userBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 18
  },
  userIcon: {
    border: '2px solid #ff8a00',
    color: '#ff8a00',
    borderRadius: '50%',
    padding: 10
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24
  },
  bigCard: {
    position: 'relative',
    minHeight: 230,
    borderRadius: 14,
    padding: 35,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: 35,
    boxShadow: '0 20px 40px rgba(0,0,0,.35)'
  },
  bigIcon: {
    opacity: .8,
    border: '3px solid rgba(255,255,255,.35)',
    borderRadius: '50%',
    padding: 24
  },
  cardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 22,
    background: 'rgba(0,0,0,.35)',
    display: 'flex',
    justifyContent: 'space-between'
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1.2fr',
    gap: 24,
    marginTop: 30
  },
  panel: {
    background: 'rgba(255,255,255,.045)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 14,
    padding: 26,
    boxShadow: '0 20px 40px rgba(0,0,0,.25)'
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  online: {
    color: '#54b82f'
  },
  connectionContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 30,
    marginTop: 25
  },
  serverIcon: {
    background: 'rgba(84,184,47,.18)',
    color: '#54b82f',
    borderRadius: '50%',
    padding: 24
  },
  green: {
    color: '#54b82f'
  },
  checkButton: {
    marginTop: 25,
    width: '100%',
    padding: 15,
    borderRadius: 8,
    border: '1px solid #54b82f',
    background: 'transparent',
    color: '#54b82f',
    fontWeight: 'bold',
    fontSize: 16,
    cursor: 'pointer'
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginTop: 25
  },
  quick: {
    background: 'rgba(0,0,0,.25)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12,
    padding: 25,
    textAlign: 'center'
  },
  info: {
    display: 'flex',
    gap: 18,
    alignItems: 'center',
    marginTop: 24
  },
  footer: {
    textAlign: 'center',
    marginTop: 30,
    color: '#aaa'
  }
}