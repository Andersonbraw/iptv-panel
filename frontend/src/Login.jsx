import { useState } from 'react'
import axios from 'axios'

const API = 'http://paineliptvonline.kesug.com:3000'

function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function login() {
    try {
      const res = await axios.post(`${API}/login`, {
        email,
        password
      })

      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))

      setUser(res.data.user)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro no login')
    }
  }

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginBox}>
        <h1 style={styles.loginLogo}>IPTV PANEL</h1>

        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={styles.input}
        />

        <button
          onClick={login}
          style={styles.redButton}
        >
          Entrar
        </button>
      </div>
    </div>
  )
}

const styles = {
  loginPage: {
    background: '#000814',
    minHeight: '100vh',
    color: '#fff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },

  loginBox: {
    width: 420,
    background: '#07142b',
    padding: 40,
    borderRadius: 24
  },

  loginLogo: {
    color: '#38bdf8',
    fontSize: 42,
    textAlign: 'center'
  },

  input: {
    width: '100%',
    padding: 13,
    borderRadius: 12,
    border: '1px solid #1e3a5f',
    background: '#07142b',
    color: '#fff',
    marginBottom: 10,
    boxSizing: 'border-box'
  },

  redButton: {
    width: '100%',
    padding: 13,
    border: 'none',
    borderRadius: 12,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 8
  }
}

export default Login