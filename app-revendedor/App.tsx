import React, { useMemo, useState } from 'react'
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  RefreshControl
} from 'react-native'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

function money(value: any) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function getExpireColor(date?: string) {
  if (!date) return '#94a3b8'

  const diffDays = Math.ceil(
    (new Date(date).getTime() - Date.now()) / 1000 / 60 / 60 / 24
  )

  if (diffDays <= 0) return '#ef4444'
  if (diffDays <= 3) return '#facc15'

  return '#22c55e'
}

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [dashboard, setDashboard] = useState<any>(null)
  const [clientName, setClientName] = useState('')
  const [search, setSearch] = useState('')
  const [createdLogin, setCreatedLogin] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const headers = useMemo(() => {
    return {
      Authorization: `Bearer ${token}`
    }
  }, [token])

  const clients = dashboard?.clients || []
  const reseller = dashboard?.reseller || {}
  const finance = dashboard?.finance || {}
  const notifications = dashboard?.notifications || []

  const filteredClients = clients.filter((client: any) => {
    const q = search.toLowerCase().trim()

    if (!q) return true

    return `${client.name || ''} ${client.email || ''}`
      .toLowerCase()
      .includes(q)
  })

  async function login() {
    try {
      setLoading(true)

      const res = await axios.post(`${API}/login`, {
        email,
        password
      })

      const loggedUser = res.data.user || res.data

      if (loggedUser.role !== 'reseller') {
        Alert.alert('Atenção', 'Este APK é somente para revendedores.')
        return
      }

      setToken(res.data.token)
      await loadDashboard(res.data.token)
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDashboard(customToken = token) {
    try {
      setLoading(true)

      const res = await axios.get(`${API}/reseller/dashboard`, {
        headers: {
          Authorization: `Bearer ${customToken}`
        }
      })

      setDashboard(res.data)
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao carregar painel.')
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
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao criar cliente.')
    } finally {
      setLoading(false)
    }
  }

  async function createTest() {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/reseller/clients/create-test`,
        { name: clientName || 'Teste 5H' },
        { headers }
      )

      setCreatedLogin(res.data.login)
      setClientName('')
      await loadDashboard()
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao criar teste.')
    } finally {
      setLoading(false)
    }
  }

  async function renewClient(client: any) {
    try {
      setLoading(true)

      await axios.post(
        `${API}/reseller/clients/${client.id}/renew-30-days`,
        {},
        { headers }
      )

      Alert.alert('Sucesso', 'Cliente renovado por 30 dias.')
      await loadDashboard()
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao renovar cliente.')
    } finally {
      setLoading(false)
    }
  }

  async function blockClient(client: any) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/reseller/clients/${client.id}`,
        { status: 'blocked' },
        { headers }
      )

      await loadDashboard()
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao bloquear cliente.')
    } finally {
      setLoading(false)
    }
  }

  async function activateClient(client: any) {
    try {
      setLoading(true)

      await axios.patch(
        `${API}/reseller/clients/${client.id}`,
        { status: 'active' },
        { headers }
      )

      await loadDashboard()
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao ativar cliente.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(client: any) {
    try {
      setLoading(true)

      const res = await axios.post(
        `${API}/reseller/clients/${client.id}/reset-password`,
        {},
        { headers }
      )

      setCreatedLogin(res.data.login)
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao resetar senha.')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setToken('')
    setDashboard(null)
    setCreatedLogin(null)
    setPassword('')
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle='light-content' backgroundColor='#000814' />

        <View style={styles.loginCard}>
          <Text style={styles.logo}>NEXORA TV</Text>
          <Text style={styles.loginTitle}>APK Revendedor</Text>
          <Text style={styles.muted}>Entre com seu login de revendedor.</Text>

          <TextInput
            placeholder='Email'
            placeholderTextColor='#94a3b8'
            value={email}
            onChangeText={setEmail}
            autoCapitalize='none'
            keyboardType='email-address'
            style={styles.input}
          />

          <TextInput
            placeholder='Senha'
            placeholderTextColor='#94a3b8'
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity
            onPress={login}
            disabled={loading}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle='light-content' backgroundColor='#000814' />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadDashboard()}
            tintColor='#38bdf8'
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logoSmall}>NEXORA TV</Text>
            <Text style={styles.title}>Painel Revendedor</Text>
            <Text style={styles.muted}>{reseller.email}</Text>
          </View>

          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{reseller.credits || 0}</Text>
            <Text style={styles.statLabel}>Créditos</Text>
          </View>

          <View style={styles.greenCard}>
            <Text style={styles.statNumber}>{money(reseller.balance)}</Text>
            <Text style={styles.statLabel}>Saldo</Text>
          </View>

          <View style={styles.blueCard}>
            <Text style={styles.statNumber}>{money(finance.vendas_mes)}</Text>
            <Text style={styles.statLabel}>Vendas mês</Text>
          </View>

          <View style={styles.purpleCard}>
            <Text style={styles.statNumber}>{clients.length}</Text>
            <Text style={styles.statLabel}>Clientes</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔔 Notificações</Text>

          {notifications.length === 0 && (
            <Text style={styles.muted}>Nenhuma notificação agora.</Text>
          )}

          {notifications.map((item: any, index: number) => (
            <View key={index} style={styles.notification}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.muted}>{item.message}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Criar cliente</Text>

          <TextInput
            placeholder='Nome do cliente ou teste'
            placeholderTextColor='#94a3b8'
            value={clientName}
            onChangeText={setClientName}
            style={styles.input}
          />

          <TouchableOpacity
            onPress={createClient}
            disabled={loading}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Criar cliente 30 dias</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={createTest}
            disabled={loading}
            style={styles.yellowButton}
          >
            <Text style={styles.yellowButtonText}>Gerar teste 5 horas</Text>
          </TouchableOpacity>
        </View>

        {createdLogin && (
          <View style={styles.loginCreated}>
            <Text style={styles.sectionTitle}>Login criado</Text>
            <Text style={styles.whiteText}>Nome: {createdLogin.name}</Text>
            <Text style={styles.whiteText}>Email: {createdLogin.email}</Text>
            <Text style={styles.whiteText}>Senha: {createdLogin.password}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Buscar cliente</Text>

          <TextInput
            placeholder='Pesquisar por nome ou email'
            placeholderTextColor='#94a3b8'
            value={search}
            onChangeText={setSearch}
            style={styles.input}
          />
        </View>

        <Text style={styles.sectionTitleOutside}>Meus clientes</Text>

        {filteredClients.map((client: any) => (
          <View key={client.id} style={styles.clientCard}>
            <Text style={styles.clientName}>{client.name}</Text>
            <Text style={styles.muted}>{client.email}</Text>

            <Text style={styles.whiteText}>
              Plano: {client.plan} • Conexões: {client.max_connections || 1}
            </Text>

            <Text style={styles.whiteText}>Status: {client.status}</Text>

            <Text style={{
              color: getExpireColor(client.expires_at),
              fontWeight: '900',
              marginTop: 4
            }}>
              Vence: {client.expires_at
                ? new Date(client.expires_at).toLocaleString('pt-BR')
                : 'Sem vencimento'}
            </Text>

            <View style={styles.clientActions}>
              <TouchableOpacity
                onPress={() => renewClient(client)}
                style={styles.smallYellow}
              >
                <Text style={styles.smallButtonText}>Renovar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => activateClient(client)}
                style={styles.smallGreen}
              >
                <Text style={styles.smallButtonText}>Ativar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => blockClient(client)}
                style={styles.smallRed}
              >
                <Text style={styles.smallButtonText}>Bloquear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => resetPassword(client)}
                style={styles.smallPurple}
              >
                <Text style={styles.smallButtonText}>Senha</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles: any = {
  screen: {
    flex: 1,
    backgroundColor: '#000814'
  },

  content: {
    flex: 1,
    padding: 16
  },

  loginCard: {
    margin: 20,
    marginTop: 80,
    backgroundColor: '#07142b',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#12345f'
  },

  logo: {
    color: '#38bdf8',
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 8
  },

  logoSmall: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '900'
  },

  loginTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8
  },

  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900'
  },

  muted: {
    color: '#94a3b8'
  },

  input: {
    backgroundColor: '#020617',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    color: '#fff',
    padding: 14,
    marginTop: 12
  },

  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 14,
    padding: 15,
    marginTop: 14,
    alignItems: 'center'
  },

  primaryButtonText: {
    color: '#000',
    fontWeight: '900'
  },

  yellowButton: {
    backgroundColor: '#facc15',
    borderRadius: 14,
    padding: 15,
    marginTop: 12,
    alignItems: 'center'
  },

  yellowButtonText: {
    color: '#000',
    fontWeight: '900'
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },

  logoutButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12
  },

  logoutText: {
    color: '#fff',
    fontWeight: '900'
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },

  statCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937'
  },

  greenCard: {
    width: '48%',
    backgroundColor: '#052e16',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#14532d'
  },

  blueCard: {
    width: '48%',
    backgroundColor: '#083344',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#155e75'
  },

  purpleCard: {
    width: '48%',
    backgroundColor: '#3b0764',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#581c87'
  },

  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900'
  },

  statLabel: {
    color: '#fff',
    marginTop: 8
  },

  card: {
    backgroundColor: '#07142b',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#12345f'
  },

  notification: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 12,
    marginTop: 10
  },

  notificationTitle: {
    color: '#fff',
    fontWeight: '900',
    marginBottom: 4
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900'
  },

  sectionTitleOutside: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8
  },

  loginCreated: {
    backgroundColor: '#020617',
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16
  },

  whiteText: {
    color: '#fff',
    marginTop: 4
  },

  clientCard: {
    backgroundColor: '#07142b',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#12345f'
  },

  clientName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900'
  },

  clientActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14
  },

  smallYellow: {
    backgroundColor: '#facc15',
    borderRadius: 10,
    padding: 10
  },

  smallGreen: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 10
  },

  smallRed: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    padding: 10
  },

  smallPurple: {
    backgroundColor: '#a855f7',
    borderRadius: 10,
    padding: 10
  },

  smallButtonText: {
    color: '#000',
    fontWeight: '900'
  }
}
