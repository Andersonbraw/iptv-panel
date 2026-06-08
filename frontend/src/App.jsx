import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

import Login from './Login'
import AdminPanel from './AdminPanel'
import ClientPanel from './ClientPanel'
import ResellerPanel from './ResellerPanel'

const API = 'https://iptv-backend-cuxf.onrender.com'

function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      localStorage.removeItem('user')
      return null
    }
  })

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      logout()
      return
    }

    try {
      const res = await axios.get(`${API}/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      localStorage.setItem('user', JSON.stringify(res.data))
      setUser(res.data)
    } catch (err) {
      const status = err.response?.status

      if (status === 401 || status === 403) {
        alert(err.response?.data?.error || 'Acesso encerrado')
        logout()
        return
      }

      console.log('Erro temporário ao validar sessão:', err.message)
    }
  }, [logout])

  useEffect(() => {
    if (!user?.id) return

    validateSession()

    const interval = setInterval(() => {
      validateSession()
    }, 30000)

    return () => clearInterval(interval)
  }, [user?.id, validateSession])

  if (!user) {
    return <Login setUser={setUser} />
  }

  const role = String(user.role || '').trim().toLowerCase()

  if (role === 'admin') {
    return (
      <AdminPanel
        user={user}
        setUser={setUser}
        logout={logout}
      />
    )
  }

  if (role === 'reseller') {
    return (
      <ResellerPanel
        user={user}
        setUser={setUser}
        logout={logout}
      />
    )
  }

  return (
    <ClientPanel
      user={user}
      setUser={setUser}
      logout={logout}
    />
  )
}

export default App