import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoomMap from '../components/RoomMap'
import { sendEmailToUser } from '../lib/emailService'
import { supabase } from '../lib/supabaseClient'

export default function Operadores() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [isOperator, setIsOperator] = useState(false)
  const [tab, setTab] = useState('rooms')
  const [roomView, setRoomView] = useState('map')
  // theme
  const [theme, setTheme] = useState(() => typeof window!=='undefined' ? (localStorage.getItem('theme')||'dark') : 'dark')
  const isDark = theme === 'dark'
  const panelCls = isDark ? 'rounded-xl border border-white/15 p-5 bg-black/20' : 'rounded-xl border border-black/10 p-5 bg-white'
  const inputBase = 'w-full rounded-lg px-3 py-2 outline-none'
  const inputCls = isDark ? `${inputBase} bg-transparent border border-white/15` : `${inputBase} bg-white border border-black/20`
  // rooms
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [roomsQ, setRoomsQ] = useState('')
  const [roomsPage, setRoomsPage] = useState(1)
  const [roomsTotal, setRoomsTotal] = useState(0)
  const [roomsOcc, setRoomsOcc] = useState({ occupied: 0, open: 0, total: 0, occupiedIds: new Set() })
  // reservations
  const [reservations, setReservations] = useState([])
  const [resQ, setResQ] = useState('')
  const [resPage, setResPage] = useState(1)
  const [resTotal, setResTotal] = useState(0)
  const [resStatus, setResStatus] = useState('all')
  const [payingId, setPayingId] = useState(null)
  const [users, setUsers] = useState([])
  // consultations
  const [consultations, setConsultations] = useState([])
  const [consQ, setConsQ] = useState('')
  const [consPage, setConsPage] = useState(1)
  const [consTotal, setConsTotal] = useState(0)
  const [consStatus, setConsStatus] = useState('all')
  const [respondingId, setRespondingId] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [sendingConsultation, setSendingConsultation] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
      if (data.session?.user?.id) {
        checkOperator(data.session.user.id)
      }
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (s?.user?.id && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        checkOperator(s.user.id)
      }
      if (event === 'SIGNED_OUT') {
        setIsOperator(false)
      }
    })
    return () => { sub.subscription.unsubscribe(); mounted = false }
  }, [])


  const checkOperator = async (_userId) => {
    try {
      const { data: sess } = await supabase.auth.getUser()
      const uid = sess?.user?.id || null
      if (!uid) { setIsOperator(false); return }
      const { data: ok, error } = await supabase.rpc('is_admin')
      if (error) throw error
      setIsOperator(Boolean(ok))
    } catch (_e) {
      setIsOperator(false)
    }
  }

  const onLogout = async () => {
    try {
      setLoading(true)
      setIsOperator(false)
      
      // Primero limpiar el estado local
      setSession(null)
      
      // Limpiar localStorage antes de signOut
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-')) {
          keys.push(key)
        }
      }
      keys.forEach(key => localStorage.removeItem(key))
      
      // Luego hacer signOut
      await supabase.auth.signOut()
      
      // Navegar al login
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      // Forzar navegación incluso si hay error
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  // Load data when operator is verified
  useEffect(() => {
    if (!isOperator) return
    loadRooms()
    loadUsers()
    loadRoomsOccupancy()
    loadConsultations()
  }, [isOperator])

  // Realtime: reflect changes instantly
  useEffect(() => {
    if (!isOperator) return
    const channel = supabase.channel('operadores-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reserve' }, () => { loadReservations(); loadRoomsOccupancy() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => { loadRooms(); loadRoomsOccupancy() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, () => { loadConsultations() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isOperator])

  // Theme effect
  useEffect(() => {
    try {
      const root = document.documentElement
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  if (loading && !session) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="opacity-80">Cargando…</p>
      </div>
    )
  }

  // Ya no necesitamos el formulario de login interno porque RequireAdmin maneja la autenticación
  if (!isOperator) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6">
          <h1 className="text-2xl font-semibold mb-4">Verificando permisos...</h1>
          <p className="text-sm opacity-80">Cargando panel de operador</p>
        </div>
      </div>
    )
  }

  // Data loaders

  const loadRooms = async (page = roomsPage, q = roomsQ) => {
    try {
      const limit = 10
      const from = (page-1)*limit
      const to = from + limit - 1
      
      // Get room types first
      const { data: types } = await supabase.from('room_type').select('id_room_type, name').order('name')
      setRoomTypes(types||[])
      const typesMap = Object.fromEntries((types || []).map(t => [t.id_room_type, t.name]))
      
      // Query rooms with separate type mapping
      let qry = supabase
        .from('rooms')
        .select('id_room, room_number, capacity, base_price, is_open, id_room_type', { count: 'exact' })
        .order('room_number', { ascending: true })
        .range(from, to)
      
      // Search filter (simple text search on room_number)
      if (q) qry = qry.ilike('room_number', `%${q}%`)
      
      const { data, error, count } = await qry
      if (error) throw error
      
      // Map room types manually
      const roomsWithTypes = (data || []).map(r => ({
        ...r,
        room_type: { name: typesMap[r.id_room_type] || '', id_room_type: r.id_room_type }
      }))
      
      setRooms(roomsWithTypes)
      setRoomsTotal(count||0)
    } catch (_) { setRooms([]) }
  }

  const loadRoomsOccupancy = async () => {
    try {
      const today = new Date().toISOString().slice(0,10)
      const { count: total } = await supabase.from('rooms').select('id_room', { count: 'exact', head: true })
      const { count: open } = await supabase.from('rooms').select('id_room', { count: 'exact', head: true }).eq('is_open', true)
      
      // Habitaciones ocupadas hoy = reservas activas que se solapan con hoy
      const activeStatuses = ['confirmada', 'pendiente']
      const { data, error } = await supabase
        .from('reserve')
        .select('id_room, check_in, check_out, status')
        // Buscar reservas que se solapan con hoy: check_in <= hoy <= check_out
        .lte('check_in', today)
        .gte('check_out', today)
        .in('status', activeStatuses)
      
      if (error) {
        console.error('Error loading occupancy:', error)
        throw error
      }
      
      console.log('Reservas activas hoy:', data)
      
      const occSet = new Set()
      for (const r of (data||[])) {
        occSet.add(r.id_room)
      }
      
      console.log('Habitaciones ocupadas:', occSet)
      setRoomsOcc({ occupied: occSet.size, open: open||0, total: total||0, occupiedIds: occSet })
    } catch (err) {
      console.error('Error en loadRoomsOccupancy:', err)
      setRoomsOcc({ occupied: 0, open: 0, total: 0, occupiedIds: new Set() })
    }
  }

  const loadUsers = async () => {
    try {
      // Get all users (needed for displaying user info in reservations)
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id_user, email_user, name_user, surname_user')
        .order('created_at', { ascending: false })
      if (usersError) throw usersError
      setUsers(allUsers || [])
    } catch (_) { setUsers([]) }
  }

  const loadReservations = async (page = resPage, q = resQ, status = resStatus) => {
    try {
      console.log('Loading reservations...', { page, q, status })
      const limit = 10
      const from = (page-1)*limit
      const to = from + limit - 1
      
      let qry = supabase
        .from('reserve')
        .select('*, rooms:id_room(room_number, id_room), users:id_user(email_user, name_user, surname_user)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (status !== 'all') qry = qry.eq('status', status)
      
      const { data, error, count } = await qry
      
      if (error) {
        console.error('Error loading reservations:', error)
        throw error
      }
      
      console.log('Reservations loaded:', { count, data })
      setReservations(data||[])
      setResTotal(count||0)
    } catch (err) {
      console.error('Error en loadReservations:', err)
      setReservations([])
      setResTotal(0)
    }
  }

  const loadConsultations = async (page = consPage, q = consQ, status = consStatus) => {
    try {
      const limit = 10
      const from = (page-1)*limit
      const to = from + limit - 1
      let qry = supabase
        .from('consultations')
        .select('id_consultation, email_contact, name_contact, subject, message, status, admin_response, responded_at, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (q) qry = qry.or(`email_contact.ilike.%${q}%,subject.ilike.%${q}%,message.ilike.%${q}%`)
      if (status !== 'all') qry = qry.eq('status', status)
      const { data, error, count } = await qry
      if (error) throw error
      setConsultations(data||[])
      setConsTotal(count||0)
    } catch (_) { setConsultations([]) }
  }

  const respondConsultation = async (id, email, subject, name) => {
    if (!responseText.trim()) return alert('Escribí una respuesta')
    setSendingConsultation(true)
    try {
      const { error } = await supabase
        .from('consultations')
        .update({
          admin_response: responseText,
          responded_by: session.user.id,
          responded_at: new Date().toISOString(),
          status: 'respondida'
        })
        .eq('id_consultation', id)
      if (error) throw error
      
      // Enviar email al usuario
      try {
        await sendEmailToUser({
          to: email,
          userName: name,
          subject: subject,
          adminResponse: responseText
        })
      } catch (emailError) {
        console.error('Error sending email:', emailError)
        alert('Respuesta guardada pero el email falló. Contactá al usuario manualmente.')
      }
      
      setResponseText('')
      setRespondingId(null)
      await loadConsultations()
      alert('Respuesta enviada correctamente')
    } catch (e) {
      alert(e.message || 'Error al responder')
    } finally {
      setSendingConsultation(false)
      setRespondingId(null)
    }
  }

  const toggleOpen = async (id, curr) => {
    const { error } = await supabase.from('rooms').update({ is_open: !curr }).eq('id_room', id)
    if (!error) loadRooms()
  }


  return (
    <div className={`min-h-[calc(100vh-4rem)] px-6 py-10 ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Panel de Operadores</h1>
          <div className="flex items-center gap-2">
            <button onClick={()=>setTheme(t=> t==='dark'?'light':'dark')} title="Cambiar tema" className="rounded-lg px-3 py-2 border border-white/20 hover:border-white/30 transition-colors flex items-center gap-2">
              <span className="inline-block" aria-hidden>
                {theme==='dark' ? '🌙' : '☀️'}
              </span>
              <span className="text-sm">{theme==='dark'?'Oscuro':'Claro'}</span>
            </button>
            <button onClick={onLogout} className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors">Cerrar sesión</button>
          </div>
        </div>

        {errorMsg && <div className="mb-4 rounded-md border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm">{errorMsg}</div>}

        <div className="mb-6 flex gap-3">
          <button onClick={()=>setTab('rooms')} className={`px-4 py-2 rounded-lg border ${tab==='rooms'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Habitaciones</button>
          <button onClick={()=>{ setTab('reservations'); loadReservations(1, resQ, resStatus); }} className={`px-4 py-2 rounded-lg border ${tab==='reservations'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Reservas</button>
          <button onClick={()=>{ setTab('consultations'); loadConsultations(1, consQ, consStatus); }} className={`px-4 py-2 rounded-lg border ${tab==='consultations'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Consultas</button>
        </div>

        {tab==='reservations' && (
          <div className={panelCls}>
            <h2 className="font-semibold mb-3">Reservas</h2>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input value={resQ} onChange={(e)=>{ setResQ(e.target.value); setResPage(1); }} placeholder="Buscar por email o habitación" className="flex-1 bg-transparent rounded-lg border border-white/15 px-3 py-2" />
              <select value={resStatus} onChange={(e)=>{ setResStatus(e.target.value); setResPage(1); }} className="bg-transparent rounded-lg border border-white/15 px-3 py-2">
                <option value="all">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="cancelado">Cancelado</option>
                <option value="no_show">No‑show</option>
              </select>
              <button onClick={()=>loadReservations(1, resQ, resStatus)} className="px-3 py-2 rounded-lg border border-white/20">Buscar</button>
            </div>
            <ul className="divide-y divide-white/10 text-sm">
              {reservations.map(r=> (
                <li key={r.id_reserve} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.users?.email_user || '(sin email)'} · Hab. #{r.rooms?.room_number || '-'} · ${Number(r.total_amount||0).toFixed(2)}</div>
                    <div className="opacity-80">{String(r.check_in)} → {String(r.check_out)} · {r.status} · {r.payment_status}</div>
                  </div>
                  <div className="flex gap-2">
                    {r.status!=='cancelado' && (
                      <button onClick={async()=>{ const { error } = await supabase.from('reserve').update({ status: 'cancelado' }).eq('id_reserve', r.id_reserve); if (!error) loadReservations(); else setErrorMsg(error.message) }} className="px-3 py-1 rounded-md border border-red-400/40 text-xs">Cancelar</button>
                    )}
                    {r.status==='confirmada' && r.payment_status!=='pagado' && (
                      <button onClick={async()=>{
                        try {
                          setPayingId(r.id_reserve)
                          const amount = Number(r.total_amount||0)
                          const ins = await supabase.from('payments').insert({ id_reserve: r.id_reserve, amount, method: 'manual', status: 'aprobado' })
                          if (ins.error) throw ins.error
                          const up = await supabase.from('reserve').update({ payment_status: 'pagado' }).eq('id_reserve', r.id_reserve)
                          if (up.error) throw up.error
                          await loadReservations()
                        } catch (e) {
                          setErrorMsg(e.message||'No se pudo registrar el pago')
                        } finally { setPayingId(null) }
                      }} className="px-3 py-1 rounded-md border border-emerald-400/40 text-xs disabled:opacity-60" disabled={payingId===r.id_reserve}>{payingId===r.id_reserve?'Marcando…':'Marcar pago'}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between text-xs opacity-80">
              <div>Mostrando {reservations.length} de {resTotal}</div>
              <div className="flex gap-2">
                <button disabled={resPage<=1} onClick={()=>{ const p=Math.max(1, resPage-1); setResPage(p); loadReservations(p, resQ, resStatus); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Prev</button>
                <span>Página {resPage}</span>
                <button disabled={(resPage*10)>=resTotal} onClick={()=>{ const p=resPage+1; setResPage(p); loadReservations(p, resQ, resStatus); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}

        {tab==='rooms' && (
          <>
            {/* Botones para cambiar vista */}
            <div className="mb-6 flex gap-3">
              <button 
                onClick={() => setRoomView('map')} 
                className={`px-4 py-2 rounded-lg border ${roomView==='map' ? 'bg-white/90 text-black' : 'border-white/20 hover:border-white/30'}`}
              >
                Vista Mapa
              </button>
              <button 
                onClick={() => setRoomView('list')} 
                className={`px-4 py-2 rounded-lg border ${roomView==='list' ? 'bg-white/90 text-black' : 'border-white/20 hover:border-white/30'}`}
              >
                Vista Lista
              </button>
            </div>

            {roomView === 'map' ? (
              <RoomMap key="room-map-view" />
            ) : (
              <div className="rounded-xl border border-white/15 p-5 bg-black/20 max-w-4xl mx-auto">
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="font-semibold">Listado de Habitaciones</h2>
                    <div className="text-xs opacity-90 rounded-md border border-white/15 px-3 py-1">
                      Ocupadas hoy ({new Date().toLocaleDateString('es-AR')}): {roomsOcc.occupied} / {roomsOcc.open} abiertas · Total {roomsOcc.total}
                    </div>
                  </div>
                  <div className="text-xs opacity-70">
                    💡 Las habitaciones se marcan como ocupadas solo si tienen reservas activas HOY (check_in ≤ hoy ≤ check_out)
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input value={roomsQ} onChange={(e)=>{ setRoomsQ(e.target.value); setRoomsPage(1); }} placeholder="Buscar por número o tipo" className="flex-1 bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                  <button onClick={()=>loadRooms(1, roomsQ)} className="px-3 py-2 rounded-lg border border-white/20">Buscar</button>
                </div>
                <ul className="divide-y divide-white/10 text-sm">
                  {rooms.map(r=> (
                    <li key={r.id_room} className="py-2 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">Hab. #{r.room_number} · {r.room_type?.name || ''}</div>
                        <div className="opacity-80 flex items-center gap-2">
                          <span>Capacidad: {r.capacity} · $ {Number(r.base_price).toFixed(2)} · {r.is_open ? 'disponible' : 'cerrada'}</span>
                          {roomsOcc.occupiedIds && roomsOcc.occupiedIds.has && roomsOcc.occupiedIds.has(r.id_room) && (
                            <span className="text-[10px] uppercase tracking-wide bg-red-500/20 border border-red-400/30 px-2 py-0.5 rounded">ocupada hoy</span>
                          )}
                        </div>
                      </div>
                      <button onClick={()=>toggleOpen(r.id_room, r.is_open)} className="px-4 py-1 rounded-md border border-white/20 text-xs hover:border-white/40 transition">{r.is_open?'Cerrar':'Abrir'}</button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-xs opacity-80">
                  <div>Mostrando {rooms.length} de {roomsTotal}</div>
                  <div className="flex gap-2">
                    <button disabled={roomsPage<=1} onClick={()=>{ const p=Math.max(1, roomsPage-1); setRoomsPage(p); loadRooms(p, roomsQ); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Prev</button>
                    <span>Página {roomsPage}</span>
                    <button disabled={(roomsPage*10)>=roomsTotal} onClick={()=>{ const p=roomsPage+1; setRoomsPage(p); loadRooms(p, roomsQ); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Next</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab==='consultations' && (
          <div className={panelCls}>
            <h2 className="font-semibold mb-3">Consultas</h2>
            <div className="mb-4 flex items-center gap-3">
              <input 
                value={consQ} 
                onChange={(e)=>{ setConsQ(e.target.value); setConsPage(1); }} 
                placeholder="Buscar por email, asunto o mensaje" 
                className="flex-1 bg-transparent rounded-lg border border-white/15 px-3 py-2" 
              />
              <select value={consStatus} onChange={(e)=>{ setConsStatus(e.target.value); setConsPage(1); loadConsultations(1, consQ, e.target.value); }} className={`rounded-lg border px-3 py-2 ${isDark ? 'bg-black text-white border-white/15' : 'bg-white text-black border-black/20'}`}>
                <option value="all">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="respondida">Respondida</option>
                <option value="cerrada">Cerrada</option>
              </select>
              <button onClick={()=>loadConsultations(1, consQ, consStatus)} className="px-3 py-2 rounded-lg border border-white/20">Buscar</button>
            </div>

            <div className="space-y-4">
              {consultations.map(c=> (
                <div key={c.id_consultation} className="rounded-lg border border-white/10 p-4 bg-black/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{c.subject}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'pendiente' ? 'bg-yellow-500/20 border border-yellow-400/40' : c.status === 'respondida' ? 'bg-green-500/20 border border-green-400/40' : 'bg-gray-500/20 border border-gray-400/40'}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-sm opacity-70">
                        De: {c.name_contact || 'Anónimo'} ({c.email_contact}) • {new Date(c.created_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 p-3 bg-white/5 rounded border border-white/5">
                    <p className="text-sm whitespace-pre-wrap">{c.message}</p>
                  </div>

                  {c.admin_response && (
                    <div className="mb-3 p-3 bg-green-500/10 rounded border border-green-400/20">
                      <p className="text-xs opacity-70 mb-1">Respuesta del administrador:</p>
                      <p className="text-sm whitespace-pre-wrap">{c.admin_response}</p>
                      {c.responded_at && (
                        <p className="text-xs opacity-50 mt-2">Respondido: {new Date(c.responded_at).toLocaleString('es-AR')}</p>
                      )}
                    </div>
                  )}

                  {c.status === 'pendiente' && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={respondingId === c.id_consultation ? responseText : ''}
                        onChange={(e)=>{ setRespondingId(c.id_consultation); setResponseText(e.target.value); }}
                        placeholder="Escribí tu respuesta aquí..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={()=>respondConsultation(c.id_consultation, c.email_contact, c.subject, c.name_contact)}
                          disabled={sendingConsultation || !responseText.trim()}
                          className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-400/40 hover:bg-green-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingConsultation ? 'Enviando...' : 'Responder y enviar email'}
                        </button>
                        {respondingId === c.id_consultation && !sendingConsultation && (
                          <button
                            onClick={()=>{ setRespondingId(null); setResponseText(''); }}
                            className="px-4 py-2 rounded-lg border border-white/20 hover:border-white/30 transition"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {consultations.length === 0 && (
                <div className="text-center py-8 opacity-70">
                  No hay consultas {consStatus !== 'all' ? `con estado "${consStatus}"` : ''}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs opacity-80">
              <div>Mostrando {consultations.length} de {consTotal}</div>
              <div className="flex gap-2">
                <button disabled={consPage<=1} onClick={()=>{ const p=Math.max(1, consPage-1); setConsPage(p); loadConsultations(p, consQ, consStatus); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Prev</button>
                <span>Página {consPage}</span>
                <button disabled={(consPage*10)>=consTotal} onClick={()=>{ const p=consPage+1; setConsPage(p); loadConsultations(p, consQ, consStatus); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
