import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import Hls from 'hls.js'

const API = 'http://localhost:3000'

export default function App() {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isRegister, setIsRegister] = useState(false)

  const [profiles, setProfiles] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)

  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)

  const [favorites, setFavorites] = useState([])
  const [history, setHistory] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [epgList, setEpgList] = useState([])

  const [search, setSearch] = useState('')
  const [m3uUrl, setM3uUrl] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const [newChannel, setNewChannel] = useState({
    name: '',
    url: '',
    category: '',
    logo: ''
  })

  const [loadingPlayer, setLoadingPlayer] = useState(false)
const [playerError, setPlayerError] = useState('')

/* SMART SERIES ENGINE */
const [seriesList, setSeriesList] = useState([])
const [selectedSeries, setSelectedSeries] = useState(null)
const [seriesEpisodes, setSeriesEpisodes] = useState([])
const [currentEpisode, setCurrentEpisode] = useState(null)
const [streamOptions, setStreamOptions] = useState([])
const [streamIndex, setStreamIndex] = useState(0)
const [failoverTried, setFailoverTried] = useState([])
  const [miniPlayer, setMiniPlayer] = useState(false)
  const [cinemaMode, setCinemaMode] = useState(false)

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }

  async function register() {
    try {
      await axios.post(`${API}/register`, { name, email, password })
      alert('Conta criada. Agora faça login.')
      setIsRegister(false)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar conta')
    }
  }

  async function login() {
    try {
      const res = await axios.post(`${API}/login`, { email, password })
      localStorage.setItem('token', res.data.token)
      setToken(res.data.token)
    } catch (err) {
      alert(err.response?.data?.error || 'Erro no login')
    }
  }

  function logout() {
    localStorage.clear()
    location.reload()
  }

  async function loadProfiles(authToken = token) {
    try {
      const res = await axios.get(`${API}/profiles`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })

      setProfiles(res.data)

      if (res.data.length > 0 && !selectedProfile) {
        setSelectedProfile(res.data[0])
      }
    } catch (err) {
      console.log(err)
    }
  }

  async function loadChannels() {
    try {
      const res = await axios.get(`${API}/channels`, authHeaders)
      setChannels(res.data)

      if (res.data.length > 0 && !selectedChannel) {
        setSelectedChannel(res.data[0])
      }
    } catch (err) {
      console.log(err)
    }
  }

  async function loadFavorites(profileId) {
    try {
      const res = await axios.get(`${API}/favorites/${profileId}`, authHeaders)
      setFavorites(res.data)
    } catch (err) {
      console.log(err)
    }
  }

  async function loadHistory(profileId) {
    try {
      const res = await axios.get(`${API}/history/${profileId}`, authHeaders)
      setHistory(res.data)
    } catch (err) {
      console.log(err)
    }
  }
  
  async function loadEpg(channel) {

  try {

    if (!channel?.name) return

    const cleanName = channel.name
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\bHD\b|\bFHD\b|\bSD\b|\b1080p\b|\b720p\b|\b480p\b/gi, '')
      .trim()

    const res = await axios.get(
      `${API}/epg/${encodeURIComponent(cleanName)}`,
      authHeaders
    )

    setEpgList(res.data || [])

  } catch (err) {

    console.log(err)
    setEpgList([])

  }

} 
  
async function loadRecommendations(profileId) {
  try {
    const res = await axios.get(`${API}/recommendations/${profileId}`, authHeaders)
    setRecommendations(res.data)
  } catch (err) {
    console.log(err)
  }
}

  async function loadSeries() {
  try {
    const res = await axios.get(`${API}/series`, authHeaders)
    setSeriesList(res.data)
  } catch (err) {
    console.log(err)
  }
}

async function openSeries(series) {
  try {
    const res = await axios.get(`${API}/series/${series.slug}`, authHeaders)
    setSelectedSeries(res.data)
    setSeriesEpisodes(res.data.episodes || [])
  } catch (err) {
    console.log(err)
  }
}

  async function addChannel() {
    try {
      if (!newChannel.name || !newChannel.url) {
        alert('Preencha nome e URL')
        return
      }

      await axios.post(`${API}/channels`, newChannel, authHeaders)

      setNewChannel({
        name: '',
        url: '',
        category: '',
        logo: ''
      })

      await loadChannels()
      alert('Canal adicionado')
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao adicionar')
    }
  }

  async function importM3U() {
    try {
      const res = await axios.post(`${API}/import-m3u`, { url: m3uUrl }, authHeaders)
      alert(res.data.message || 'Importado')
      await loadChannels()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao importar M3U')
    }
  }

  async function saveSource() {
    try {
      await axios.post(
        `${API}/sources`,
        {
          name: sourceName || 'Fonte IPTV',
          url: sourceUrl
        },
        authHeaders
      )

      setSourceName('')
      setSourceUrl('')
      alert('Fonte salva')
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar fonte')
    }
  }

  async function updateSources() {
    try {
      const res = await axios.post(`${API}/sources/import-all`, {}, authHeaders)
      alert(res.data.message || 'Fontes atualizadas')
      await loadChannels()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao atualizar fontes')
    }
  }

  async function checkOnline() {
    try {
      const res = await axios.post(`${API}/channels/check-online`, {}, authHeaders)
      alert(res.data.message || 'Verificação concluída')
      await loadChannels()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao verificar canais')
    }
  }

  async function removeOffline() {
    try {
      const res = await axios.delete(`${API}/channels/offline/remove`, authHeaders)
      alert(res.data.message || 'Offline removidos')
      await loadChannels()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover offline')
    }
  }

  async function toggleFavorite(channel) {
    if (!selectedProfile) return

    try {
      const exists = favorites.find(f => f.id === channel.id)

      if (exists) {
        await axios.delete(`${API}/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            profileId: selectedProfile.id,
            channelId: channel.id
          }
        })
      } else {
        await axios.post(
          `${API}/favorites`,
          {
            profileId: selectedProfile.id,
            channelId: channel.id
          },
          authHeaders
        )
      }

      await loadFavorites(selectedProfile.id)
    } catch (err) {
      console.log(err)
    }
  }

  async function saveHistory(channel, progress = 20) {
    if (!selectedProfile || !channel) return

    try {
      await axios.post(
        `${API}/history`,
        {
          profileId: selectedProfile.id,
          channelId: channel.id,
          progress,
          watchedSeconds: 300
        },
        authHeaders
      )

      await loadHistory(selectedProfile.id)
      await loadRecommendations(selectedProfile.id)
    } catch (err) {
      console.log(err)
    }
  }

  function findSimilarChannel(channel) {
  if (!channel) return null

  const baseName = channel.name
    ?.toLowerCase()
    .replace(/hd|fhd|sd|1080p|720p|480p|\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()

  if (!baseName) return null

  return channels.find(item => {
    if (!item?.url || item.id === channel.id) return false
    if (failoverTried.includes(item.id)) return false

    const itemName = item.name
      ?.toLowerCase()
      .replace(/hd|fhd|sd|1080p|720p|480p|\(.*?\)/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim()

    return itemName && (
      itemName.includes(baseName) ||
      baseName.includes(itemName)
    )
  })
}

function autoReplaceStream() {
  const replacement = findSimilarChannel(selectedChannel)

  if (!replacement) {
    setPlayerError('Nenhum stream reserva encontrado para este canal.')
    return
  }

  setFailoverTried(prev => [...prev, selectedChannel.id, replacement.id])
  setPlayerError(`Trocando automaticamente para ${replacement.name}...`)

  setTimeout(() => {
    playChannel(replacement)
  }, 800)
}

async function loadStreamOptions(channel) {
  try {
    const res = await axios.get(`${API}/channels/${channel.id}/streams`, authHeaders)

    const options = [
      {
        id: channel.id,
        name: channel.name,
        url: channel.url,
        main: true
      },
      ...(res.data.streams || [])
    ]

    setStreamOptions(options)
    setStreamIndex(0)

    return options
  } catch (err) {
    console.log(err)
    setStreamOptions([
      {
        id: channel.id,
        name: channel.name,
        url: channel.url,
        main: true
      }
    ])
    setStreamIndex(0)

    return [channel]
  }
}

async function switchToNextStream() {
  if (!streamOptions.length) return false

  const nextIndex = streamIndex + 1
  const next = streamOptions[nextIndex]

  if (!next) {
    setPlayerError('Nenhum stream reserva funcionando para este canal.')
    return false
  }

  setStreamIndex(nextIndex)
  setPlayerError(`Tentando stream reserva: ${next.name || 'Alternativo'}...`)

  setSelectedChannel(prev => ({
    ...prev,
    url: next.url,
    name: prev.name
  }))

  return true
}
  async function playChannel(channel) {
  setSelectedChannel(channel)
  loadEpg(channel)
  setMiniPlayer(false)
  setPlayerError('')
  setFailoverTried([])
  setStreamOptions([])
  setStreamIndex(0)

  await loadStreamOptions(channel)

  saveHistory(channel, 25)
}
  function playNextEpisode() {
  if (!currentEpisode || seriesEpisodes.length === 0) return

  const ordered = [...seriesEpisodes].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })

  const currentIndex = ordered.findIndex(ep => ep.id === currentEpisode.id)

  if (currentIndex === -1) return

  const nextEpisode = ordered[currentIndex + 1]

  if (!nextEpisode) {
    setPlayerError('Fim da temporada ou da série.')
    return
  }

  setCurrentEpisode(nextEpisode)
  playChannel(nextEpisode)
}
  function reconnectPlayer() {
    if (!selectedChannel) return
    setSelectedChannel({ ...selectedChannel })
  }

  function openFullscreen() {
    const video = videoRef.current
    if (video?.requestFullscreen) video.requestFullscreen()
  }

  useEffect(() => {
  if (token) {
    loadProfiles(token)
    loadChannels()
    loadSeries()
  }
}, [token])

  useEffect(() => {
    if (selectedProfile) {
      loadFavorites(selectedProfile.id)
      loadHistory(selectedProfile.id)
      loadRecommendations(selectedProfile.id)
    }
  }, [selectedProfile])

  useEffect(() => {
  if (!selectedChannel || !videoRef.current) return

  setPlayerError('')

  const video = videoRef.current
  let hls = null

  video.pause()
  video.removeAttribute('src')
  video.load()

  const startTimeout = setTimeout(() => {
    switchToNextStream()
  }, 15000)

  if (selectedChannel.url?.includes('.m3u8')) {
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        liveSyncDuration: 5
      })

      hls.loadSource(selectedChannel.url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad()
          return
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }

        hls.destroy()
        switchToNextStream()
      })
    } else {
      video.src = selectedChannel.url
      video.play().catch(() => {})
    }
  } else {
    video.src = selectedChannel.url
    video.play().catch(() => {})
  }

  const loadedHandler = () => {
    clearTimeout(startTimeout)
    setPlayerError('')
  }

  const errorHandler = () => {
    switchToNextStream()
  }

  video.addEventListener('loadeddata', loadedHandler)
  video.addEventListener('error', errorHandler)

  return () => {
    clearTimeout(startTimeout)

    video.removeEventListener('loadeddata', loadedHandler)
    video.removeEventListener('error', errorHandler)

    if (hls) {
      hls.destroy()
    }
  }
}, [selectedChannel])

const currentEpg = epgList[0] || null
const nextEpg = epgList[1] || null
  const groupedChannels = useMemo(() => {
    const filtered = channels.filter(channel =>
      channel.name?.toLowerCase().includes(search.toLowerCase())
    )

    const groups = {}

    filtered.forEach(channel => {
      const cat = channel.category || 'Outros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(channel)
    })

    return groups
  }, [channels, search])

  if (!token) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginBox}>
          <h1 style={styles.loginLogo}>IPTV PANEL</h1>

          {isRegister && (
            <input
              placeholder="Nome"
              value={name}
              onChange={e => setName(e.target.value)}
              style={styles.input}
            />
          )}

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

          <button onClick={isRegister ? register : login} style={styles.redButton}>
            {isRegister ? 'Criar conta' : 'Entrar'}
          </button>

          <button onClick={() => setIsRegister(!isRegister)} style={styles.grayButton}>
            {isRegister ? 'Já tenho conta' : 'Criar conta'}
          </button>
        </div>
      </div>
    )
  }

  if (!selectedProfile) {
    return (
      <div style={styles.loginPage}>
        <h1 style={styles.profileTitle}>Quem está assistindo?</h1>

        <div style={styles.profileGrid}>
          {profiles.map(profile => (
            <div
              key={profile.id}
              style={styles.profileCard}
              onClick={() => setSelectedProfile(profile)}
            >
              <div style={{ ...styles.avatar, background: profile.color }}>
                {profile.avatar}
              </div>

              <h2>{profile.name}</h2>
            </div>
          ))}
        </div>

        <button onClick={logout} style={styles.redButtonSmall}>
          Sair da conta
        </button>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.profileMini}>
          <div style={{ ...styles.profileIcon, background: selectedProfile.color }}>
            {selectedProfile.avatar}
          </div>

          <div>
            <small style={{ color: '#94a3b8' }}>Perfil ativo</small>
            <strong style={{ display: 'block' }}>{selectedProfile.name}</strong>
          </div>
        </div>

        <h1 style={styles.logo}>IPTV PANEL</h1>

        <button style={styles.redButton} onClick={() => setSelectedProfile(null)}>
          Trocar perfil
        </button>

        <button style={styles.grayButton} onClick={logout}>
          Sair da conta
        </button>

        <div style={styles.dashboard}>
          <h2 style={styles.dashboardTitle}>Dashboard Admin</h2>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <h1>{channels.length}</h1>
              <p>Canais</p>
            </div>

            <div style={styles.statCard}>
              <h1>{favorites.length}</h1>
              <p>Favoritos</p>
            </div>

            <div style={styles.statCard}>
              <h1>{Object.keys(groupedChannels).length}</h1>
              <p>Categorias</p>
            </div>

            <div style={styles.statCard}>
              <h1>ON</h1>
              <p>Sistema</p>
            </div>
          </div>
        </div>

        <input
          placeholder="Buscar canais"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.input}
        />

        <hr style={styles.hr} />

        <h3>Importar M3U</h3>

        <input
          placeholder="URL M3U"
          value={m3uUrl}
          onChange={e => setM3uUrl(e.target.value)}
          style={styles.input}
        />

        <button style={styles.blueButton} onClick={importM3U}>
          Importar canais
        </button>

        <hr style={styles.hr} />

        <h3>IPTV automático</h3>

        <input
          placeholder="Nome da fonte"
          value={sourceName}
          onChange={e => setSourceName(e.target.value)}
          style={styles.input}
        />

        <input
          placeholder="URL M3U da fonte"
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          style={styles.input}
        />

        <button style={styles.blueButton} onClick={saveSource}>
          Salvar fonte
        </button>

        <button style={styles.blueButton} onClick={updateSources}>
          Atualizar fontes
        </button>

        <button style={styles.yellowButton} onClick={checkOnline}>
          Verificar online
        </button>

        <button style={styles.redButton} onClick={removeOffline}>
          Remover offline
        </button>

        <hr style={styles.hr} />

        <h3>Adicionar canal</h3>

        <input
          placeholder="Nome"
          value={newChannel.name}
          onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
          style={styles.input}
        />

        <input
          placeholder="URL Stream"
          value={newChannel.url}
          onChange={e => setNewChannel({ ...newChannel, url: e.target.value })}
          style={styles.input}
        />

        <input
          placeholder="Categoria"
          value={newChannel.category}
          onChange={e => setNewChannel({ ...newChannel, category: e.target.value })}
          style={styles.input}
        />

        <input
          placeholder="URL Logo"
          value={newChannel.logo}
          onChange={e => setNewChannel({ ...newChannel, logo: e.target.value })}
          style={styles.input}
        />

        <button style={styles.blueButton} onClick={addChannel}>
          Adicionar
        </button>
      </aside>

      <main style={styles.main}>
        {selectedChannel && (
          <section style={cinemaMode ? styles.heroCinema : styles.hero}>
            {selectedChannel.logo && (
              <img src={selectedChannel.logo} style={styles.heroBg} />
            )}

            <div style={styles.heroDark}></div>

            <div style={styles.heroContent}>
              <div style={styles.heroInfo}>
                <span style={styles.liveBadge}>AO VIVO</span>

                <h1 style={styles.heroTitle}>{selectedChannel.name}</h1>

                <h2 style={styles.heroCat}>{selectedChannel.category}</h2>

                <div style={styles.epgBox}>

  <strong style={{ color: '#38bdf8' }}>
    GUIA AO VIVO
  </strong>

  {currentEpg ? (
    <>

      <h2>
        {currentEpg.title}
      </h2>

      <p>
        {currentEpg.description || 'Programação ao vivo'}
      </p>

    </>
  ) : (
    <>

      <h2>
        Programação ao vivo
      </h2>

      <p>
        EPG indisponível para este canal
      </p>

    </>
  )}

  {nextEpg && (
    <p style={styles.nextEpg}>
      Próximo: {nextEpg.title}
    </p>
  )}

</div>

                <div style={styles.heroButtons}>
                  <button style={styles.watchButton} onClick={() => videoRef.current?.play()}>
                    ▶ Assistir
                  </button>

                  <button style={styles.favoriteButton} onClick={() => toggleFavorite(selectedChannel)}>
                    ★ Favoritar
                  </button>

                  <button style={styles.blueSmall} onClick={reconnectPlayer}>
                    ↻ Reconectar
                  </button>

                  <button style={styles.blueSmall} onClick={openFullscreen}>
                    ⛶ Fullscreen
                  </button>

                  <button style={styles.blueSmall} onClick={() => setMiniPlayer(true)}>
                    ◱ Mini player
                  </button>

                  <button style={styles.blueSmall} onClick={() => setCinemaMode(!cinemaMode)}>
                    🎬 Cinema
                  </button>
                </div>
              </div>

              <div style={styles.playerBox}>
                {loadingPlayer && <div style={styles.loading}>Carregando stream...</div>}
                {playerError && <div style={styles.error}>{playerError}</div>}

                <video
                                              ref={videoRef}
                                              controls
                                              autoPlay
                                              playsInline
                                              style={styles.video}
                                              onTimeUpdate={() => saveHistory(selectedChannel, 50)}
                                              onEnded={playNextEpisode}
                                         />
              </div>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <ChannelRow title="▶ Continue Assistindo" channels={history} onPlay={playChannel} />
        )}

        {favorites.length > 0 && (
          <ChannelRow title="★ Favoritos" channels={favorites} onPlay={playChannel} />
        )}

        {recommendations.length > 0 && (
          <ChannelRow title="🔥 Recomendados" channels={recommendations} onPlay={playChannel} />
        )}
        
        {seriesList.length > 0 && (
  <SeriesRow
    title="🎬 Séries Agrupadas"
    seriesList={seriesList}
    onOpenSeries={openSeries}
  />
)}

{selectedSeries && (
  <div style={styles.seriesModal}>
    <div style={styles.seriesModalBox}>
      <button
        style={styles.closeSeries}
        onClick={() => {
          setSelectedSeries(null)
          setSeriesEpisodes([])
        }}
      >
        ×
      </button>

      <h1 style={styles.seriesTitle}>{selectedSeries.name}</h1>

      <p style={styles.seriesSub}>
        {seriesEpisodes.length} episódio(s) disponíveis
      </p>

      {Object.entries(
        seriesEpisodes.reduce((acc, ep) => {
          const season = ep.season || 1
          if (!acc[season]) acc[season] = []
          acc[season].push(ep)
          return acc
        }, {})
      ).map(([season, episodes]) => (
        <div key={season} style={styles.seasonBlock}>
          <h2 style={styles.seasonTitle}>Temporada {season}</h2>

          <div style={styles.episodeGrid}>
            {episodes.map(ep => (
              <div
                key={ep.id}
                style={styles.episodeCard}
                onClick={() => {
                     setCurrentEpisode(ep)
                     playChannel(ep)
                     setSelectedSeries(null)
                 }}
              >
                <div style={styles.episodeThumb}>
                  {ep.logo ? (
                    <img src={ep.logo} style={styles.cardLogo} />
                  ) : (
                    <div style={styles.cardFallback}>{ep.name?.[0]}</div>
                  )}
                </div>

                <div style={styles.cardBody}>
                  <h3 style={styles.cardTitle}>
                    T{ep.season} EP{ep.episode}
                  </h3>

                  <p style={styles.cardCategory}>{ep.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)} 

        {Object.entries(groupedChannels).map(([category, items]) => (
          <ChannelRow
            key={category}
            title={category}
            channels={items}
            onPlay={playChannel}
            onFavorite={toggleFavorite}
          />
        ))}
      </main>

      {miniPlayer && selectedChannel && (
        <div style={styles.miniPlayer}>
          <button style={styles.closeMini} onClick={() => setMiniPlayer(false)}>
            ×
          </button>

          <video
            src={selectedChannel.url}
            controls
            autoPlay
            muted
            style={styles.miniVideo}
          />

          <strong>{selectedChannel.name}</strong>
        </div>
      )}
    </div>
  )
}

function SeriesRow({ title, seriesList, onOpenSeries }) {
  return (
    <section style={styles.section}>
      <h1 style={styles.sectionTitle}>{title}</h1>

      <div style={styles.row}>
        {seriesList.map(series => (
          <div
            key={series.slug}
            style={styles.card}
            onClick={() => onOpenSeries(series)}
          >
            <div style={styles.cardTop}>
              {series.poster ? (
                <img src={series.poster} style={styles.cardLogo} />
              ) : (
                <div style={styles.cardFallback}>{series.name?.[0]}</div>
              )}
            </div>

            <div style={styles.cardBody}>
              <h2 style={styles.cardTitle}>{series.name}</h2>

              <p style={styles.cardCategory}>
                {series.seasons} temporada(s)
              </p>

              <p style={styles.cardCategory}>
                {series.totalEpisodes} episódio(s)
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChannelRow({ title, channels, onPlay, onFavorite }) {
  return (
    <section style={styles.section}>
      <h1 style={styles.sectionTitle}>{title}</h1>

      <div style={styles.row}>
        {channels.map(channel => (
          <div key={channel.id} style={styles.card} onClick={() => onPlay(channel)}>
            <div style={styles.cardTop}>
              {channel.logo ? (
                <img src={channel.logo} style={styles.cardLogo} />
              ) : (
                <div style={styles.cardFallback}>{channel.name?.[0]}</div>
              )}

              {channel.is_online === false && (
                <div style={styles.offlineBadge}>OFFLINE</div>
              )}
            </div>

            <div style={styles.cardBody}>
              <h2 style={styles.cardTitle}>{channel.name}</h2>

                                  <p style={styles.cardCategory}>{channel.category}</p>

                                  {Number(channel.reserve_count || 0) > 0 && (
                                       <p style={styles.reserveText}>
                                            +{channel.reserve_count} stream(s) reserva
                                       </p>
                                   )}

              {typeof channel.progress !== 'undefined' && (
                <>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${channel.progress || 10}%`
                      }}
                    />
                  </div>

                  <small>{channel.progress || 10}% assistido</small>
                </>
              )}

              {onFavorite && (
                <button
                  style={styles.favoriteMini}
                  onClick={e => {
                    e.stopPropagation()
                    onFavorite(channel)
                  }}
                >
                  ★ Favoritar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const styles = {
  app: {
  display: 'flex',
  background: '#000814',
  color: '#fff',
  minHeight: '100vh',
  fontFamily: 'Arial'
},

  loginPage: {
    background: '#000814',
    minHeight: '100vh',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
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

  profileTitle: {
    fontSize: 56,
    marginBottom: 40
  },

  profileGrid: {
    display: 'flex',
    gap: 30
  },

  profileCard: {
    width: 190,
    height: 220,
    background: '#07142b',
    borderRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer'
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 42
  },

  sidebar: {
    width: 330,
    minWidth: 330,
    background: '#021033',
    padding: 14,
    borderRight: '1px solid #10234d',
    overflowY: 'auto',
    height: '100vh',
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0
  },

  profileMini: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#0b1736',
    padding: 12,
    borderRadius: 16
  },

  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 24
  },

  logo: {
    color: '#38bdf8',
    fontSize: 46,
    textAlign: 'center',
    margin: '22px 0'
  },

  dashboard: {
    background: '#0a1737',
    borderRadius: 24,
    padding: 18,
    margin: '18px 0'
  },

  dashboardTitle: {
    color: '#38bdf8',
    marginTop: 0
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },

  statCard: {
    background: '#000a25',
    borderRadius: 18,
    padding: 16,
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
    marginBottom: 8
  },

  redButtonSmall: {
    padding: 14,
    border: 'none',
    borderRadius: 12,
    background: '#ef4444',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 30
  },

  grayButton: {
    width: '100%',
    padding: 13,
    border: 'none',
    borderRadius: 12,
    background: '#334155',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: 8
  },

  blueButton: {
    width: '100%',
    padding: 13,
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(90deg,#2563eb,#38bdf8)',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: 8
  },

  yellowButton: {
    width: '100%',
    padding: 13,
    border: 'none',
    borderRadius: 12,
    background: '#facc15',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: 8
  },

  hr: {
    borderColor: '#16325f',
    margin: '20px 0'
  },

  main: {
    flex: 1,
    padding: 24,
    overflowX: 'hidden'
  },

  hero: {
    position: 'relative',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 40,
    minHeight: 620,
    background: '#000'
  },

  heroCinema: {
    position: 'relative',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 40,
    minHeight: 680,
    background: '#000',
    boxShadow: '0 0 80px rgba(56,189,248,0.35)'
  },

  heroBg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    filter: 'blur(45px)',
    opacity: 0.28,
    transform: 'scale(1.25)'
  },

  heroDark: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg,rgba(1,8,23,0.97),rgba(0,0,0,0.75),rgba(2,26,68,0.95))'
  },

  heroContent: {
    position: 'relative',
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '0.85fr 1.55fr',
    gap: 30,
    padding: 34,
    alignItems: 'center',
    minHeight: 620
  },

  heroInfo: {
    display: 'flex',
    flexDirection: 'column'
  },

  liveBadge: {
    background: '#ef4444',
    padding: '8px 14px',
    borderRadius: 50,
    width: 'fit-content',
    fontWeight: 'bold'
  },

  heroTitle: {
    fontSize: 68,
    margin: '20px 0 0',
    lineHeight: 1
  },

  heroCat: {
    color: '#38bdf8',
    fontWeight: 'normal'
  },

  epgBox: {
  nextEpg: {
          marginTop: 12,
          color: '#38bdf8',
          fontWeight: 'bold',
          fontSize: 16
      },
    background: '#0a1737',
    padding: 22,
    borderRadius: 20,
    marginTop: 25
  },

  heroButtons: {
    display: 'flex',
    gap: 10,
    marginTop: 24,
    flexWrap: 'wrap'
  },

  watchButton: {
    padding: '15px 24px',
    border: 'none',
    borderRadius: 14,
    background: '#fff',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  favoriteButton: {
    padding: '15px 24px',
    border: 'none',
    borderRadius: 14,
    background: '#facc15',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  blueSmall: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: 12,
    background: '#0284c7',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  playerBox: {
    position: 'relative',
    background: '#000',
    borderRadius: 28,
    overflow: 'hidden',
    boxShadow: '0 0 55px rgba(56,189,248,0.22)'
  },

  video: {
    width: '100%',
    height: 520,
    background: '#000',
    objectFit: 'cover',
    display: 'block'
  },

  loading: {
    position: 'absolute',
    zIndex: 5,
    top: '45%',
    left: '50%',
    transform: 'translate(-50%,-50%)',
    background: 'rgba(0,0,0,0.8)',
    padding: 18,
    borderRadius: 14
  },

  error: {
    position: 'absolute',
    zIndex: 5,
    top: '45%',
    left: '50%',
    transform: 'translate(-50%,-50%)',
    background: '#ef4444',
    padding: 18,
    borderRadius: 14
  },

  section: {
    marginBottom: 40
  },

  sectionTitle: {
    fontSize: 36,
    marginBottom: 18
  },

  row: {
    display: 'flex',
    gap: 20,
    overflowX: 'auto',
    paddingBottom: 20
  },

  card: {
    minWidth: 250,
    width: 250,
    background: '#081327',
    borderRadius: 24,
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    transition: '0.3s'
  },

  cardTop: {
    height: 160,
    background: 'linear-gradient(90deg,#2563eb,#38bdf8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },

  cardLogo: {
    width: 110,
    maxHeight: 100,
    objectFit: 'contain'
  },

  cardFallback: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 50
  },

  offlineBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    background: '#ef4444',
    color: '#fff',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 'bold'
  },

  cardBody: {
    padding: 16
  },

  cardTitle: {
    fontSize: 20,
    margin: 0,
    marginBottom: 6
  },

  cardCategory: {
    color: '#38bdf8',
    marginTop: 0
  },

  reserveText: {
          color: '#22c55e',
          fontSize: 13,
          fontWeight: 'bold',
          marginTop: 6
      },

  favoriteMini: {
    width: '100%',
    padding: 10,
    border: 'none',
    borderRadius: 10,
    background: '#facc15',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },

  progressBar: {
    height: 7,
    background: '#1e293b',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 7
  },

  progressFill: {
    height: '100%',
    background: '#38bdf8'
  },

  miniPlayer: {
    position: 'fixed',
    right: 24,
    bottom: 24,
    width: 360,
    background: '#020617',
    borderRadius: 20,
    padding: 12,
    zIndex: 999,
    boxShadow: '0 0 40px rgba(0,0,0,0.8)'
  },

  miniVideo: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    background: '#000'
  },

  closeMini: {
  position: 'absolute',
  top: -12,
  right: -12,
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: 'none',
  background: '#ef4444',
  color: '#fff',
  fontWeight: 'bold',
  cursor: 'pointer'
},

/* SMART SERIES ENGINE */

seriesModal: {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.88)',
  zIndex: 2000,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 30
},

seriesModalBox: {
  width: '92%',
  maxWidth: 1300,
  maxHeight: '92vh',
  overflowY: 'auto',
  background: '#020617',
  borderRadius: 30,
  padding: 30,
  position: 'relative',
  boxShadow: '0 0 80px rgba(56,189,248,0.25)'
},

closeSeries: {
  position: 'absolute',
  top: 18,
  right: 18,
  width: 42,
  height: 42,
  borderRadius: '50%',
  border: 'none',
  background: '#ef4444',
  color: '#fff',
  fontSize: 24,
  fontWeight: 'bold',
  cursor: 'pointer'
},

seriesTitle: {
  fontSize: 52,
  marginTop: 0,
  marginBottom: 10
},

seriesSub: {
  color: '#38bdf8',
  fontSize: 20,
  marginBottom: 30
},

episodeGrid: {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))',
  gap: 20
},

episodeCard: {
  background: '#081327',
  borderRadius: 22,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: '0.25s'
},

episodeThumb: {
  height: 150,
  background: 'linear-gradient(90deg,#2563eb,#38bdf8)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
},

seasonBlock: {
  marginBottom: 35
},

seasonTitle: {
  fontSize: 30,
  color: '#fff',
  marginBottom: 18
}

}