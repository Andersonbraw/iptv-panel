import { useEffect, useState } from 'react'
import axios from 'axios'

import Login from './Login'
import AdminPanel from './AdminPanel'
import ClientPanel from './ClientPanel'

const API = 'http://paineliptvonline.kesug.com:3000'

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  async function validateSession() {
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
  }

  useEffect(() => {
    if (!user) return

    validateSession()

    const interval = setInterval(() => {
      validateSession()
    }, 5000)

    return () => clearInterval(interval)
  }, [user?.id])

  if (!user) {
    return <Login setUser={setUser} />
  }

  const role = String(user.role || '').trim().toLowerCase()

  if (role === 'admin') {
    return (
      <AdminPanel
        user={user}
        setUser={setUser}
      />
    )
  }

  return (
    <ClientPanel
      user={user}
      setUser={setUser}
    />
  )
}

export default App