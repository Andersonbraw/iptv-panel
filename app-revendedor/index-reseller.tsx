// index-reseller.tsx
// Arquivo base para criar um APK separado do Revendedor.
// Copie para um projeto Android/React Native separado quando quiser gerar o APK Revendedor próprio.

import React, { useMemo, useState } from 'react'
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import axios from 'axios'

const API = 'https://iptv-backend-cuxf.onrender.com'

export default function ResellerMobileApp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [user, setUser] = useState<any>(null)
  const [dashboard, setDashboard] = useState<any>(null)
  const [clientName, setClientName] = useState('')

  const headers = useMemo(() => {
    return {
      Authorization: `Bearer ${token}`
    }
  }, [token])

  async function login() {
    try {
      const res = await axios.post(`${API}/login`, {
        email,
        password
      })

      if (res.data.user.role !== 'reseller') {
        Alert.alert('Atenção', 'Este APK é somente para revendedores')
        return
      }

      setToken(res.data.token)
      setUser(res.data.user)
      await loadDashboard(res.data.token)
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao entrar')
    }
  }

  async function loadDashboard(customToken = token) {
    try {
      const res = await axios.get(`${API}/reseller/dashboard`, {
        headers: {
          Authorization: `Bearer ${customToken}`
        }
      })

      setDashboard(res.data)
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao carregar painel')
    }
  }

  async function createClient() {
    try {
      const res = await axios.post(
        `${API}/reseller/clients/create-random`,
        { name: clientName },
        { headers }
      )

      Alert.alert(
        'Cliente criado',
        `Email: ${res.data.login.email}\nSenha: ${res.data.login.password}`
      )

      setClientName('')
      await loadDashboard()
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao criar cliente')
    }
  }

  async function createTest() {
    try {
      const res = await axios.post(
        `${API}/reseller/clients/create-test`,
        { name: clientName || 'Teste 5H' },
        { headers }
      )

      Alert.alert(
        'Teste criado',
        `Email: ${res.data.login.email}\nSenha: ${res.data.login.password}`
      )

      setClientName('')
      await loadDashboard()
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao criar teste')
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000814', padding: 20 }}>
        <Text style={{ color: '#38bdf8', fontSize: 32, fontWeight: 'bold' }}>
          Nexora Revendedor
        </Text>

        <TextInput
          placeholder='Email'
          placeholderTextColor='#94a3b8'
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />

        <TextInput
          placeholder='Senha'
          placeholderTextColor='#94a3b8'
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={inputStyle}
        />

        <TouchableOpacity onPress={login} style={buttonStyle}>
          <Text style={buttonText}>Entrar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000814' }}>
      <ScrollView style={{ padding: 16 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: 'bold' }}>
          Painel Revendedor
        </Text>

        <Text style={{ color: '#facc15', fontSize: 42, fontWeight: 'bold' }}>
          {dashboard?.reseller?.credits || 0}
        </Text>

        <Text style={{ color: '#94a3b8' }}>Créditos disponíveis</Text>

        <Text style={{ color: '#22c55e', fontSize: 22, fontWeight: 'bold', marginTop: 10 }}>
          Saldo: R$ {Number(dashboard?.reseller?.balance || 0).toFixed(2)}
        </Text>

        <TextInput
          placeholder='Nome do cliente'
          placeholderTextColor='#94a3b8'
          value={clientName}
          onChangeText={setClientName}
          style={inputStyle}
        />

        <TouchableOpacity onPress={createClient} style={buttonStyle}>
          <Text style={buttonText}>Criar cliente</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={createTest} style={yellowButtonStyle}>
          <Text style={buttonText}>Criar teste 5 horas</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => loadDashboard()} style={grayButtonStyle}>
          <Text style={buttonText}>Atualizar</Text>
        </TouchableOpacity>

        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 25 }}>
          Meus Clientes
        </Text>

        {(dashboard?.clients || []).map((client: any) => (
          <View key={client.id} style={{ backgroundColor: '#07142b', padding: 14, borderRadius: 14, marginTop: 10 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{client.name}</Text>
            <Text style={{ color: '#94a3b8' }}>{client.email}</Text>
            <Text style={{ color: '#38bdf8' }}>Plano: {client.plan}</Text>
            <Text style={{ color: '#22c55e' }}>Status: {client.status}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const inputStyle = {
  backgroundColor: '#020617',
  borderColor: '#334155',
  borderWidth: 1,
  borderRadius: 12,
  color: '#fff',
  padding: 14,
  marginTop: 14
}

const buttonStyle = {
  backgroundColor: '#38bdf8',
  padding: 14,
  borderRadius: 12,
  marginTop: 14,
  alignItems: 'center' as const
}

const yellowButtonStyle = {
  backgroundColor: '#facc15',
  padding: 14,
  borderRadius: 12,
  marginTop: 14,
  alignItems: 'center' as const
}

const grayButtonStyle = {
  backgroundColor: '#334155',
  padding: 14,
  borderRadius: 12,
  marginTop: 14,
  alignItems: 'center' as const
}

const buttonText = {
  color: '#000',
  fontWeight: 'bold' as const
}
