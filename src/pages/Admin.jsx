import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import RoomMap from '../components/RoomMap'
import { sendEmailToUser } from '../lib/emailService'
import { supabase } from '../lib/supabaseClient'

export default function Admin() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [isOperator, setIsOperator] = useState(false)
  const [dbgOpen, setDbgOpen] = useState(false)
  const [dbg, setDbg] = useState({ url: import.meta.env.VITE_SUPABASE_URL || '', uid: '', mail: '', isAdmin: null })
  const [tab, setTab] = useState('stats')
  const [roomView, setRoomView] = useState('map') // 'map' o 'list'
  // stats
  const [stats, setStats] = useState([])
  const [kpis, setKpis] = useState({ occupancy: 0, revenue: 0, active: 0, noShows: 0 })
  const [chartRange, setChartRange] = useState(7)
  const [series, setSeries] = useState([])
  // theme
  const [theme, setTheme] = useState(() => typeof window!=='undefined' ? (localStorage.getItem('theme')||'dark') : 'dark')
  const isDark = theme === 'dark'
  const panelCls = isDark ? 'rounded-xl border border-white/15 p-5 bg-black/20' : 'rounded-xl border border-black/10 p-5 bg-white'
  const inputBase = 'w-full rounded-lg px-3 py-2 outline-none'
  const inputCls = isDark ? `${inputBase} bg-transparent border border-white/15` : `${inputBase} bg-white border border-black/20`
  // rooms
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [savingRoom, setSavingRoom] = useState(false)
  const [newRoom, setNewRoom] = useState({ number: '', capacity: 2, base_price: 100, type: '' })
  const [roomsQ, setRoomsQ] = useState('')
  const [roomsPage, setRoomsPage] = useState(1)
  const [roomsTotal, setRoomsTotal] = useState(0)
  const [editRoomId, setEditRoomId] = useState(null)
  const [editRoomData, setEditRoomData] = useState({ capacity: 2, base_price: 0 })
  const [roomsOcc, setRoomsOcc] = useState({ occupied: 0, open: 0, total: 0, occupiedIds: new Set() })
  // users
  const [users, setUsers] = useState([])
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState({ email: '', password: '', name: '', surname: '', phone: '', rol: 'usuario' })
  const [usersQ, setUsersQ] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingUserRole, setEditingUserRole] = useState('')
  // reservations
  const [reservations, setReservations] = useState([])
  const [resQ, setResQ] = useState('')
  const [resPage, setResPage] = useState(1)
  const [resTotal, setResTotal] = useState(0)
  const [resStatus, setResStatus] = useState('all')
  const [creatingRes, setCreatingRes] = useState(false)
  const [newRes, setNewRes] = useState({ id_user: '', id_room: '', check_in: '', check_out: '', adults_total: 2, children_total: 0, total_amount: 0, status: 'pendiente', payment_status: 'no_pagado' })
  const [newResSlots, setNewResSlots] = useState([{ id_room: '', adults_total: 2, children_total: 0, total_amount: 0, status: 'pendiente', payment_status: 'no_pagado' }])
  const [availableRooms, setAvailableRooms] = useState([])
  const [payingId, setPayingId] = useState(null)
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

  // Debug info collector
  useEffect(() => {
    (async () => {
      try {
        const sess = (await supabase.auth.getSession()).data.session
        const uid = sess?.user?.id || ''
        const mail = sess?.user?.email || ''
        let isAdmin = null
        if (uid) {
          const { data: ok } = await supabase.rpc('is_admin')
          isAdmin = !!ok
        }
        setDbg(d => ({ ...d, uid, mail, isAdmin }))
      } catch {
        setDbg(d => ({ ...d, uid: '', mail: '', isAdmin: null }))
      }
    })()
  }, [session])

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

  // Load dashboard data when operator is verified
  useEffect(() => {
    if (!isOperator) return
    loadStats(); loadRooms(); loadUsers(); loadKPIsAndChart(chartRange); loadRoomsOccupancy(); loadConsultations()
  }, [isOperator])

  // Reload KPIs/Chart when range changes
  useEffect(() => {
    if (!isOperator) return
    loadKPIsAndChart(chartRange)
  }, [chartRange, isOperator])

  // Realtime: reflect changes instantly
  useEffect(() => {
    if (!isOperator) return
    const channel = supabase.channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reserve' }, () => { loadStats(); loadKPIsAndChart(chartRange); loadReservations(); loadRoomsOccupancy() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => { loadRooms(); loadRoomsOccupancy() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { loadUsers() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => { loadStats(); loadKPIsAndChart(chartRange) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, () => { loadConsultations() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isOperator, chartRange])

  // Rooms available for [check_in, check_out)
  function loadAvailableRooms(checkIn, checkOut) {
    (async () => {
      try {
        if (!checkIn || !checkOut) { setAvailableRooms([]); return }
        const { data: allRooms } = await supabase
          .from('rooms')
          .select('id_room, room_number, capacity, base_price, is_open, room_type:room_type(name)')
          .eq('is_open', true)
          .order('room_number', { ascending: true })
        const { data: busy } = await supabase
          .from('reserve')
          .select('id_room, status, check_in, check_out')
          .lt('check_in', checkOut)
          .gt('check_out', checkIn)
        const activeStatuses = new Set(['confirmada','pendiente'])
        const busyIds = new Set((busy||[]).filter(r=>activeStatuses.has(String(r.status))).map(r=>r.id_room))
        const avail = (allRooms||[]).filter(r=>!busyIds.has(r.id_room))
        setAvailableRooms(avail)
      } catch (_) { setAvailableRooms([]) }
    })()
  }

  // Theme effect
  useEffect(() => {
    try {
      const root = document.documentElement
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  // Keep available rooms in sync with date range (must be before conditional returns)
  useEffect(() => {
    loadAvailableRooms(newRes.check_in, newRes.check_out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newRes.check_in, newRes.check_out])

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
          <p className="text-sm opacity-80">Cargando panel de administración</p>
        </div>
      </div>
    )
  }

  // Data loaders
  const loadStats = async () => {
    try {
      const since = new Date(); since.setDate(since.getDate()-6)
      const from = since.toISOString().slice(0,10)
      
      // Query payments and reserves separately
      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('amount, status, created_at, id_reserve')
        .gte('created_at', from)
      if (payErr) throw payErr
      
      const reserveIds = [...new Set((paymentsData||[]).map(p => p.id_reserve))]
      const { data: reservesData } = await supabase
        .from('reserve')
        .select('id_reserve, status')
        .in('id_reserve', reserveIds.length ? reserveIds : [-1])
      
      const reserveMap = Object.fromEntries((reservesData||[]).map(r => [r.id_reserve, r]))
      
      const days = [...Array(7)].map((_,i)=>{
        const d = new Date(); d.setDate(d.getDate()- (6-i));
        return { day: d.toISOString().slice(0,10), total: 0 }
      })
      
      for (const p of (paymentsData||[])) {
        if (String(p.status) !== 'aprobado') continue
        const reserve = reserveMap[p.id_reserve]
        if (!reserve || String(reserve.status) !== 'confirmada') continue
        const k = String(p.created_at).slice(0,10)
        const slot = days.find(x=>x.day===k)
        if (slot) slot.total += Number(p.amount||0)
      }
      setStats(days)
    } catch (e) { console.error('loadStats error:', e); setStats([]) }
  }

  const loadKPIsAndChart = async (rangeDays) => {
    try {
      const end = new Date()
      const start = new Date(); start.setDate(end.getDate() - (rangeDays-1))
      const from = start.toISOString().slice(0,10)
      const to = end.toISOString().slice(0,10)
      const todayKey = new Date().toISOString().slice(0,10)

      // Rooms abiertas para ocupación
      const { count: openRoomsCount } = await supabase
        .from('rooms')
        .select('id_room', { count: 'exact', head: true })
        .eq('is_open', true)

      // Serie y KPIs por fecha de pago (queries separadas)
      const { data: pays, error: payErr } = await supabase
        .from('payments')
        .select('amount, status, created_at, id_reserve')
        .gte('created_at', from)
        .lte('created_at', to)
      if (payErr) throw payErr
      
      const payReserveIds = [...new Set((pays||[]).map(p => p.id_reserve))]
      const { data: payReservesData } = await supabase
        .from('reserve')
        .select('id_reserve, check_in, check_out, status, payment_status, total_amount')
        .in('id_reserve', payReserveIds.length ? payReserveIds : [-1])
      const payReserveMap = Object.fromEntries((payReservesData||[]).map(r => [r.id_reserve, r]))

      // Construir ejes por día
      const days = [...Array(rangeDays)].map((_,i)=>{
        const d = new Date(start); d.setDate(start.getDate()+i)
        return { day: d.toISOString().slice(0,10), bookings: 0, revenue: 0 }
      })
      const counted = new Set() // para contar 1 por reserva por día
      let revenuePaid = 0
      for (const p of (pays||[])) {
        if (String(p.status) !== 'aprobado') continue
        const reserve = payReserveMap[p.id_reserve]
        if (!reserve || String(reserve.status) !== 'confirmada') continue
        const k = String(p.created_at).slice(0,10)
        const slot = days.find(x=>x.day===k)
        if (slot) {
          const key = `${k}:${p.id_reserve}`
          if (!counted.has(key)) { slot.bookings += 1; counted.add(key) }
          slot.revenue += Number(p.amount||0)
          revenuePaid += Number(p.amount||0)
        }
      }
      setSeries(days)

      // KPIs
      const activeStatuses = new Set(['confirmada','pendiente'])
      // Reservas que se cruzan con el rango (para ocupación/activas)
      const { data: reservesData, error: resErr } = await supabase
        .from('reserve')
        .select('id_reserve, check_in, check_out, status, payment_status, total_amount')
        .lte('check_in', to)
        .gte('check_out', from)
      if (resErr) throw resErr
      const reserves = reservesData || []
      let active = 0, noShows = 0, revenue = 0
      for (const r of reserves) {
        const st = String(r.status||'')
        if (String(r.payment_status)==='pagado') revenue += Number(r.total_amount||0)
        // Activas HOY: solape [check_in, check_out) con hoy
        if (activeStatuses.has(st) && String(r.check_in) <= todayKey && todayKey <= String(r.check_out)) active += 1
        // no-show nativo o inferido
        if (st==='no_show' || (st==='pendiente' && String(r.check_in) < todayKey)) noShows += 1
      }
      // revenue KPI por pagos en rango
      revenue = revenuePaid
      // Ocupación HOY = habitaciones ocupadas hoy / total habitaciones
      const { count: totalRoomsCount } = await supabase
        .from('rooms')
        .select('id_room', { count: 'exact', head: true })
      const { data: todayBusy } = await supabase
        .from('reserve')
        .select('id_room, status, check_in, check_out')
        .lte('check_in', todayKey)
        .gte('check_out', todayKey)
      const occIds = new Set((todayBusy||[]).filter(r=>activeStatuses.has(String(r.status))).map(r=>r.id_room))
      const occupancy = (totalRoomsCount||0) > 0 ? Math.min(100, Math.max(0, (occIds.size/(totalRoomsCount||1))*100)) : 0
      setKpis({ occupancy, revenue, active, noShows })
    } catch (_) {
      setKpis({ occupancy: 0, revenue: 0, active: 0, noShows: 0 }); setSeries([])
    }
  }

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

  const loadUsers = async (page = usersPage, q = usersQ) => {
    try {
      // Get all users from unified table
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id_user, email_user, name_user, surname_user, rol, created_at')
        .order('created_at', { ascending: false })
      if (usersError) throw usersError
      
      // Apply search filter
      let filtered = allUsers || []
      if (q) {
        const qLower = q.toLowerCase()
        filtered = (allUsers || []).filter(u => 
          (u.email_user || '').toLowerCase().includes(qLower) ||
          (u.name_user || '').toLowerCase().includes(qLower) ||
          (u.surname_user || '').toLowerCase().includes(qLower) ||
          (u.rol || '').toLowerCase().includes(qLower)
        )
      }
      
      // Paginate
      const limit = 10
      const from = (page-1)*limit
      const to = from + limit
      const paginated = filtered.slice(from, to)
      
      setUsers(paginated)
      setUsersTotal(filtered.length)
    } catch (_) { setUsers([]) }
  }

  const loadReservations = async (page = resPage, q = resQ, status = resStatus) => {
    try {
      const limit = 10
      const from = (page-1)*limit
      const to = from + limit - 1
      let qry = supabase
        .from('reserve')
        .select('id_reserve, created_at, check_in, check_out, status, payment_status, total_amount, rooms:id_room(room_number), user:id_user(email_user)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (q) qry = qry.or(`user.email_user.ilike.%${q}%,rooms.room_number.ilike.%${q}%`)
      if (status !== 'all') qry = qry.eq('status', status)
      const { data, error, count } = await qry
      if (error) throw error
      setReservations(data||[])
      setResTotal(count||0)
    } catch (_) { setReservations([]) }
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

  

  

  

  const addRoom = async (e) => {
    e.preventDefault(); setSavingRoom(true)
    try {
      if (!newRoom.number || !newRoom.type) throw new Error('Completá número y tipo')
      const type = roomTypes.find(t=>String(t.name).toLowerCase()===String(newRoom.type).toLowerCase())
      if (!type) throw new Error('Tipo de habitación inválido')
      const { error } = await supabase
        .from('rooms')
        .insert({ room_number: newRoom.number, capacity: Number(newRoom.capacity||0), base_price: Number(newRoom.base_price||0), is_open: true, id_room_type: type.id_room_type })
      if (error) throw error
      setNewRoom({ number: '', capacity: 2, base_price: 100, type: '' })
      await loadRooms()
    } catch (e2) {
      setErrorMsg(e2.message || 'No se pudo crear la habitación')
    } finally { setSavingRoom(false) }
  }

  const deleteRoom = async (id) => {
    if (!confirm('¿Eliminar esta habitación?')) return
    const { error } = await supabase.from('rooms').delete().eq('id_room', id)
    if (!error) loadRooms()
  }

  const toggleOpen = async (id, curr) => {
    const { error } = await supabase.from('rooms').update({ is_open: !curr }).eq('id_room', id)
    if (!error) loadRooms()
  }

  const deleteUser = async (id) => {
    if (!confirm('¿Eliminar usuario de tabla pública? Esto no borra el auth.')) return
    const { error } = await supabase.from('users').delete().eq('id_user', id)
    if (!error) loadUsers()
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ rol: newRole })
        .eq('id_user', userId)
      
      if (error) throw error
      
      setEditingUserId(null)
      setEditingUserRole('')
      await loadUsers()
      alert('Rol actualizado correctamente')
    } catch (err) {
      console.error('Error al actualizar rol:', err)
      setErrorMsg('No se pudo actualizar el rol del usuario')
    }
  }

  const inviteUser = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setInviting(true)
    try {
      if (!invite.email || !invite.password) throw new Error('Completá email y contraseña')
      
      // Crear usuario en auth - el trigger creará automáticamente el registro en users
      const { data, error } = await supabase.auth.signUp({ 
        email: invite.email, 
        password: invite.password,
        options: {
          data: {
            nombre: invite.name || '',
            apellido: invite.surname || '',
            telefono: invite.phone || ''
          }
        }
      })
      if (error) throw error
      const uid = data?.user?.id
      if (!uid) throw new Error('No se pudo crear el usuario (revisá verificación por email)')
      
      // Si el rol no es 'usuario', actualizarlo (el trigger crea con rol 'usuario' por defecto)
      if (invite.rol && invite.rol !== 'usuario') {
        // Esperar un momento para que el trigger complete
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { error: updateErr } = await supabase
          .from('users')
          .update({ rol: invite.rol })
          .eq('id_user', uid)
        if (updateErr) throw updateErr
      }
      
      setInvite({ email: '', password: '', name: '', surname: '', phone: '', rol: 'usuario' })
      await loadUsers()
      const rolLabel = invite.rol === 'administrador' ? 'Administrador' : invite.rol === 'operario' ? 'Operario' : 'Usuario'
      alert(`${rolLabel} invitado. Debe confirmar el email para activar la cuenta.`)
    } catch (e2) {
      setErrorMsg(e2.message || 'No se pudo invitar al usuario')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className={`min-h-[calc(100vh-4rem)] px-6 py-10 ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Panel de administración</h1>
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
          <button onClick={()=>setTab('stats')} className={`px-4 py-2 rounded-lg border ${tab==='stats'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Estadísticas</button>
          <button onClick={()=>setTab('rooms')} className={`px-4 py-2 rounded-lg border ${tab==='rooms'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Habitaciones</button>
          <button onClick={()=>setTab('users')} className={`px-4 py-2 rounded-lg border ${tab==='users'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Usuarios</button>
          <button onClick={()=>{ setTab('reservations'); loadReservations(1, resQ, resStatus); }} className={`px-4 py-2 rounded-lg border ${tab==='reservations'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Reservas</button>
          <button onClick={()=>{ setTab('consultations'); loadConsultations(1, consQ, consStatus); }} className={`px-4 py-2 rounded-lg border ${tab==='consultations'?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>Consultas</button>
        </div>

        {tab==='stats' && (
          <div className="space-y-6">
            <div className={panelCls}>
              <h2 className="font-semibold mb-4">KPIs</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-white/10 p-4 bg-black/10">
                  <div className="text-xs opacity-70">Ocupación</div>
                  <div className="text-2xl font-semibold">{kpis.occupancy.toFixed(0)}%</div>
                </div>
                <div className="rounded-lg border border-white/10 p-4 bg-black/10">
                  <div className="text-xs opacity-70">Ingresos</div>
                  <div className="text-2xl font-semibold">$ {kpis.revenue.toFixed(2)}</div>
                </div>
                <div className="rounded-lg border border-white/10 p-4 bg-black/10">
                  <div className="text-xs opacity-70">Reservas activas</div>
                  <div className="text-2xl font-semibold">{kpis.active}</div>
                </div>
                <div className="rounded-lg border border-white/10 p-4 bg-black/10">
                  <div className="text-xs opacity-70">No‑shows</div>
                  <div className="text-2xl font-semibold">{kpis.noShows}</div>
                </div>
              </div>
            </div>
            <div className={panelCls}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Reservas / Ingresos por día</h2>
                <div className="flex gap-2">
                  <button onClick={()=>setChartRange(7)} className={`px-3 py-1 rounded-md border ${chartRange===7?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>7</button>
                  <button onClick={()=>setChartRange(30)} className={`px-3 py-1 rounded-md border ${chartRange===30?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>30</button>
                  <button onClick={()=>setChartRange(90)} className={`px-3 py-1 rounded-md border ${chartRange===90?'bg-white/90 text-black':'border-white/20 hover:border-white/30'}`}>90</button>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff22" />
                    <XAxis dataKey="day" stroke="#ccc" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#ccc" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.7)', border:'1px solid #ffffff33' }} />
                    <Legend />
                    <Area type="monotone" name="Reservas" dataKey="bookings" stroke="#60a5fa" fillOpacity={1} fill="url(#colorBookings)" />
                    <Area type="monotone" name="Ingresos" dataKey="revenue" stroke="#34d399" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={panelCls}>
              <h2 className="font-semibold mb-4">Ganancias (últimos 7 días)</h2>
              <ul className="text-sm divide-y divide-white/10">
                {stats.map((d)=> (
                  <li key={d.day} className="py-2 flex items-center justify-between">
                    <span>{d.day}</span>
                    <span>$ {d.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab==='reservations' && (
          <div className={panelCls}>
            <h2 className="font-semibold mb-3">Reservas</h2>
            <div className="mb-5 rounded-lg border border-white/10 p-4 bg-black/10">
              <h3 className="font-semibold mb-3">Crear reserva</h3>
              <form onSubmit={async(e)=>{
                e.preventDefault(); setCreatingRes(true); setErrorMsg('')
                try {
                  if (!newRes.id_user || !newRes.check_in || !newRes.check_out) throw new Error('Completá usuario y fechas')
                  if (new Date(newRes.check_out) <= new Date(newRes.check_in)) throw new Error('Rango de fechas inválido')
                  // Validar slots
                  const slots = newResSlots.filter(s=>s && s.id_room)
                  if (slots.length === 0) throw new Error('Agregá al menos una habitación')
                  // Insertar una reserva por slot
                  const rows = slots.map(s=>({
                    id_user: newRes.id_user,
                    id_room: Number(s.id_room),
                    check_in: newRes.check_in,
                    check_out: newRes.check_out,
                    adults_total: Number(s.adults_total||0),
                    children_total: Number(s.children_total||0),
                    total_amount: Number(s.total_amount||0),
                    status: s.status || 'pendiente',
                    payment_status: s.payment_status || 'no_pagado',
                  }))
                  const { error } = await supabase.from('reserve').insert(rows)
                  if (error) throw error
                  setNewRes({ id_user: '', id_room: '', check_in: '', check_out: '', adults_total: 2, children_total: 0, total_amount: 0, status: 'pendiente', payment_status: 'no_pagado' })
                  setNewResSlots([{ id_room: '', adults_total: 2, children_total: 0, total_amount: 0, status: 'pendiente', payment_status: 'no_pagado' }])
                  await loadReservations(1, resQ, resStatus)
                  setResPage(1)
                } catch (e2) { setErrorMsg(e2.message || 'No se pudo crear la reserva') }
                finally { setCreatingRes(false) }
              }} className="grid md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs opacity-80 mb-1">Usuario</label>
                  <select value={newRes.id_user} onChange={(e)=>setNewRes(v=>({...v, id_user: e.target.value}))} className={isDark ? 'w-full rounded-lg border border-white/15 px-3 py-2 bg-white text-black' : 'w-full rounded-lg border border-black/20 px-3 py-2 bg-white text-black'} required>
                    <option value="">Seleccioná…</option>
                    {users.map(u=>(<option key={u.id_user} value={u.id_user}>{u.email_user}</option>))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs opacity-80 mb-2">Habitaciones</label>
                  <div className="space-y-2">
                    {newResSlots.map((s, idx)=> (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                        <div className="md:col-span-2">
                          <label className="block text-[11px] opacity-70 mb-1">Habitación</label>
                          <select value={s.id_room} onChange={(e)=> setNewResSlots(list=>{ const copy=[...list]; copy[idx] = { ...copy[idx], id_room: e.target.value }; return copy }) } className={isDark ? 'w-full rounded-lg border border-white/15 px-3 py-2 bg-white text-black' : 'w-full rounded-lg border border-black/20 px-3 py-2 bg-white text-black'} required>
                            <option value="">Seleccioná…</option>
                            {(availableRooms.length>0 ? availableRooms : rooms).map(r=>(<option key={r.id_room} value={r.id_room}>#{r.room_number} · {r.room_type?.name || '-'}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] opacity-70 mb-1">Adultos</label>
                          <input type="number" min="1" value={s.adults_total} onChange={(e)=> setNewResSlots(list=>{ const copy=[...list]; copy[idx] = { ...copy[idx], adults_total: e.target.value }; return copy }) } className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                        </div>
                        <div>
                          <label className="block text-[11px] opacity-70 mb-1">Niños</label>
                          <input type="number" min="0" value={s.children_total} onChange={(e)=> setNewResSlots(list=>{ const copy=[...list]; copy[idx] = { ...copy[idx], children_total: e.target.value }; return copy }) } className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                        </div>
                        <div>
                          <label className="block text-[11px] opacity-70 mb-1">Total</label>
                          <input type="number" min="0" value={s.total_amount} onChange={(e)=> setNewResSlots(list=>{ const copy=[...list]; copy[idx] = { ...copy[idx], total_amount: e.target.value }; return copy }) } className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                        </div>
                        <div className="md:col-span-5 flex gap-2">
                          <select value={s.status} onChange={(e)=> setNewResSlots(list=>{ const copy=[...list]; copy[idx] = { ...copy[idx], status: e.target.value }; return copy }) } className="rounded-lg border border-white/15 px-3 py-2 bg-transparent">
                            <option value="pendiente">pendiente</option>
                            <option value="confirmada">confirmada</option>
                            <option value="cancelado">cancelado</option>
                            <option value="no_show">no_show</option>
                          </select>
                          <select value={s.payment_status} onChange={(e)=> setNewResSlots(list=>{ const copy=[...list]; copy[idx] = { ...copy[idx], payment_status: e.target.value }; return copy }) } className="rounded-lg border border-white/15 px-3 py-2 bg-transparent">
                            <option value="no_pagado">no_pagado</option>
                            <option value="pagado">pagado</option>
                          </select>
                          <button type="button" onClick={()=> setNewResSlots(list=> list.filter((_,i)=> i!==idx)) } className="px-3 py-2 rounded-lg border border-red-400/40">Quitar</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={()=> setNewResSlots(list=> [...list, { id_room: '', adults_total: 2, children_total: 0, total_amount: 0, status: 'pendiente', payment_status: 'no_pagado' }]) } className="px-3 py-2 rounded-lg border border-white/20">Añadir habitación</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Check‑in</label>
                    <input type="date" value={newRes.check_in} onChange={(e)=>setNewRes(v=>({...v, check_in: e.target.value}))} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Check‑out</label>
                    <input type="date" value={newRes.check_out} onChange={(e)=>setNewRes(v=>({...v, check_out: e.target.value}))} className={inputCls} required />
                  </div>
                </div>
                <div>
                  <button type="submit" disabled={creatingRes} className="w-full rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">{creatingRes?'Creando…':'Crear'}</button>
                </div>
              </form>
            </div>
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
                    <div className="font-medium">{r.user?.email_user || '(sin email)'} · Hab. #{r.rooms?.room_number || '-'} · ${Number(r.total_amount||0).toFixed(2)}</div>
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
                          await Promise.all([loadReservations(), loadStats(), loadKPIsAndChart(chartRange)])
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
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-white/15 p-5 bg-black/20">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-semibold">Listado</h2>
                    <div className="text-xs opacity-90 rounded-md border border-white/15 px-3 py-1">
                      Ocupadas hoy: {roomsOcc.occupied} / {roomsOcc.open} abiertas · Total {roomsOcc.total}
                    </div>
                  </div>
              <div className="flex items-center gap-2 mb-3">
                <input value={roomsQ} onChange={(e)=>{ setRoomsQ(e.target.value); setRoomsPage(1); }} placeholder="Buscar por número o tipo" className="flex-1 bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                <button onClick={()=>loadRooms(1, roomsQ)} className="px-3 py-2 rounded-lg border border-white/20">Buscar</button>
              </div>
              <ul className="divide-y divide-white/10 text-sm">
                {rooms.map(r=> (
                  <li key={r.id_room} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">Hab. #{r.room_number} · {r.room_type?.name || ''}</div>
                      {editRoomId===r.id_room ? (
                        <div className="opacity-90 flex gap-2 items-center">
                          <label className="text-xs">Cap:</label>
                          <input type="number" min="1" value={editRoomData.capacity} onChange={(e)=>setEditRoomData(v=>({...v, capacity: e.target.value}))} className="w-16 bg-transparent rounded border border-white/15 px-2 py-1 text-sm" />
                          <label className="text-xs">$</label>
                          <input type="number" min="0" value={editRoomData.base_price} onChange={(e)=>setEditRoomData(v=>({...v, base_price: e.target.value}))} className="w-24 bg-transparent rounded border border-white/15 px-2 py-1 text-sm" />
                        </div>
                      ) : (
                        <div className="opacity-80 flex items-center gap-2">
                          <span>Capacidad: {r.capacity} · $ {Number(r.base_price).toFixed(2)} · {r.is_open ? 'disponible' : 'cerrada'}</span>
                          {roomsOcc.occupiedIds && roomsOcc.occupiedIds.has && roomsOcc.occupiedIds.has(r.id_room) && (
                            <span className="text-[10px] uppercase tracking-wide bg-red-500/20 border border-red-400/30 px-2 py-0.5 rounded">ocupada hoy</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>toggleOpen(r.id_room, r.is_open)} className="px-3 py-1 rounded-md border border-white/20 text-xs">{r.is_open?'Cerrar':'Abrir'}</button>
                      {editRoomId===r.id_room ? (
                        <button onClick={async()=>{ const { error } = await supabase.from('rooms').update({ capacity: Number(editRoomData.capacity||0), base_price: Number(editRoomData.base_price||0) }).eq('id_room', r.id_room); if (!error) { setEditRoomId(null); loadRooms(); } else { setErrorMsg(error.message) } }} className="px-3 py-1 rounded-md border border-emerald-400/40 text-xs">Guardar</button>
                      ) : (
                        <button onClick={()=>{ setEditRoomId(r.id_room); setEditRoomData({ capacity: r.capacity, base_price: r.base_price }); }} className="px-3 py-1 rounded-md border border-white/20 text-xs">Editar</button>
                      )}
                      <button onClick={()=>deleteRoom(r.id_room)} className="px-3 py-1 rounded-md border border-red-400/40 text-xs">Eliminar</button>
                    </div>
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
            <div className={panelCls}>
              <h2 className="font-semibold mb-3">Agregar habitación</h2>
              <form onSubmit={addRoom} className="space-y-3">
                <div>
                  <label className="block text-xs opacity-80 mb-1">Número</label>
                  <input value={newRoom.number} onChange={(e)=>setNewRoom(v=>({...v, number: e.target.value}))} className={inputCls} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Capacidad</label>
                    <input type="number" min="1" value={newRoom.capacity} onChange={(e)=>setNewRoom(v=>({...v, capacity: e.target.value}))} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Precio base</label>
                    <input type="number" min="0" value={newRoom.base_price} onChange={(e)=>setNewRoom(v=>({...v, base_price: e.target.value}))} className={inputCls} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs opacity-80 mb-1">Tipo</label>
                  <input list="room-types" value={newRoom.type} onChange={(e)=>setNewRoom(v=>({...v, type: e.target.value}))} className={inputCls} placeholder="doble / triple / ..." required />
                  <datalist id="room-types">
                    {roomTypes.map(t=> (<option key={t.id_room_type} value={t.name} />))}
                  </datalist>
                </div>
                <button type="submit" disabled={savingRoom} className="rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">{savingRoom?'Guardando…':'Agregar'}</button>
              </form>
            </div>
          </div>
            )}
          </>
        )}

        {tab==='users' && (
          <div className={panelCls}>
            <h2 className="font-semibold mb-3">Usuarios</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Listado</h3>
                <div className="flex items-center gap-2 mb-3">
                  <input value={usersQ} onChange={(e)=>{ setUsersQ(e.target.value); setUsersPage(1); }} placeholder="Buscar por email o nombre" className="flex-1 bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                  <button onClick={()=>loadUsers(1, usersQ)} className="px-3 py-2 rounded-lg border border-white/20">Buscar</button>
                </div>
                <ul className="divide-y divide-white/10 text-sm">
                  {users.map(u=> (
                    <li key={u.id_user} className="py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {u.name_user || ''} {u.surname_user || ''}
                            {editingUserId === u.id_user ? (
                              <select 
                                value={editingUserRole} 
                                onChange={(e)=>setEditingUserRole(e.target.value)}
                                className={`text-xs px-2 py-0.5 rounded border ${isDark ? 'bg-black text-white border-white/30' : 'bg-white text-black border-black/30'}`}
                              >
                                <option value="usuario">Usuario</option>
                                <option value="operario">Operario</option>
                                <option value="administrador">Administrador</option>
                              </select>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                u.rol === 'administrador' ? 'bg-purple-500/20 border border-purple-400/40' : 
                                u.rol === 'operario' ? 'bg-orange-500/20 border border-orange-400/40' : 
                                'bg-blue-500/20 border border-blue-400/40'
                              }`}>
                                {u.rol || 'usuario'}
                              </span>
                            )}
                          </div>
                          <div className="opacity-80">{u.email_user}</div>
                        </div>
                        <div className="flex gap-2">
                          {editingUserId === u.id_user ? (
                            <>
                              <button onClick={()=>updateUserRole(u.id_user, editingUserRole)} className="px-3 py-1 rounded-md border border-green-400/40 text-xs">Guardar</button>
                              <button onClick={()=>{ setEditingUserId(null); setEditingUserRole(''); }} className="px-3 py-1 rounded-md border border-white/20 text-xs">Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=>{ setEditingUserId(u.id_user); setEditingUserRole(u.rol || 'usuario'); }} className="px-3 py-1 rounded-md border border-blue-400/40 text-xs">Editar rol</button>
                              <button onClick={()=>deleteUser(u.id_user)} className="px-3 py-1 rounded-md border border-red-400/40 text-xs">Eliminar</button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-xs opacity-80">
                  <div>Mostrando {users.length} de {usersTotal}</div>
                  <div className="flex gap-2">
                    <button disabled={usersPage<=1} onClick={()=>{ const p=Math.max(1, usersPage-1); setUsersPage(p); loadUsers(p, usersQ); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Prev</button>
                    <span>Página {usersPage}</span>
                    <button disabled={(usersPage*10)>=usersTotal} onClick={()=>{ const p=usersPage+1; setUsersPage(p); loadUsers(p, usersQ); }} className="px-2 py-1 rounded border border-white/15 disabled:opacity-40">Next</button>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Invitar usuario</h3>
                <form onSubmit={inviteUser} className="space-y-3">
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Rol de usuario</label>
                    <select value={invite.rol} onChange={(e)=>setInvite(v=>({...v, rol: e.target.value}))} className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'bg-black text-white border-white/15' : 'bg-white text-black border-black/20'}`} required>
                      <option value="usuario" className={isDark ? 'bg-black text-white' : 'bg-white text-black'}>Usuario</option>
                      <option value="operario" className={isDark ? 'bg-black text-white' : 'bg-white text-black'}>Operario</option>
                      <option value="administrador" className={isDark ? 'bg-black text-white' : 'bg-white text-black'}>Administrador</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Email</label>
                    <input type="email" value={invite.email} onChange={(e)=>setInvite(v=>({...v, email: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" required />
                  </div>
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Contraseña</label>
                    <input type="password" value={invite.password} onChange={(e)=>setInvite(v=>({...v, password: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs opacity-80 mb-1">Nombre</label>
                      <input value={invite.name} onChange={(e)=>setInvite(v=>({...v, name: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-xs opacity-80 mb-1">Apellido</label>
                      <input value={invite.surname} onChange={(e)=>setInvite(v=>({...v, surname: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs opacity-80 mb-1">Teléfono</label>
                    <input value={invite.phone} onChange={(e)=>setInvite(v=>({...v, phone: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2" />
                  </div>
                  <button type="submit" disabled={inviting} className="rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">{inviting?'Invitando…':'Invitar'}</button>
                </form>
                <p className="text-xs opacity-70 mt-2">Se creará un usuario en Auth y un registro en la tabla pública. El invitado deberá confirmar el email.</p>
              </div>
            </div>
          </div>
        )}

        {tab==='consultations' && (
          <div className={panelCls}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Consultas</h2>
              <span className="text-xs opacity-70 bg-blue-500/10 border border-blue-400/30 px-3 py-1 rounded">Solo lectura</span>
            </div>
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
                      <p className="text-xs opacity-70 mb-1">Respuesta:</p>
                      <p className="text-sm whitespace-pre-wrap">{c.admin_response}</p>
                      {c.responded_at && (
                        <p className="text-xs opacity-50 mt-2">Respondido: {new Date(c.responded_at).toLocaleString('es-AR')}</p>
                      )}
                    </div>
                  )}

                  {!c.admin_response && c.status === 'pendiente' && (
                    <div className="mt-3 p-3 bg-yellow-500/10 rounded border border-yellow-400/20">
                      <p className="text-xs opacity-70">Esta consulta aún no ha sido respondida.</p>
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
