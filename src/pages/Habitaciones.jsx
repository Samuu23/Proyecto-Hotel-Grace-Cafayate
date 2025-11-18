import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import bgS3 from '../assets/bg-s3.jpg'
import { supabase } from '../lib/supabaseClient'

export default function Habitaciones() {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [rooms, setRooms] = useState([])
  const [combos, setCombos] = useState([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [roomType, setRoomType] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const mustVerify = Boolean(location.state?.mustVerify)
  const emailHint = location.state?.emailHint || ''

  const resend = async () => {
    if (!emailHint) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailHint,
        options: { emailRedirectTo: `${window.location.origin}/habitaciones` },
      })
      if (error) throw error
      alert('Te reenviamos el correo de verificación')
    } catch (e) {
      alert(e.message || 'No se pudo reenviar el correo')
    } finally {
      setLoading(false)
    }
  }

  // Construye combinaciones coherentes de habitaciones que cubran a totalGuests
  const buildCombos = (avail) => {
    const types = ['simple','doble','triple','cuadruple']
    const byType = Object.fromEntries(types.map(t => [t, []]))
    for (const r of avail) {
      let t = String(r.type_room || '').toLowerCase()
      // Mapear 'suite' según capacidad
      if (t === 'suite') {
        const cap = Number(r.capacity) || 2
        if (cap >= 4) t = 'cuadruple'
        else if (cap === 3) t = 'triple'
        else t = 'doble'
      }
      if (byType[t]) {
        byType[t].push({ id: r.id, price: Number(r.price) || 0, capacity: Number(r.capacity) || 0 })
      }
    }
    // ordenar por precio asc
    for (const t of types) {
      byType[t] = byType[t].sort((a,b)=>a.price-b.price)
    }

    const capMap = { simple: 1, doble: 2, triple: 3, cuadruple: 4 }
    const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / (1000*60*60*24)))
    const results = []

    // Generar solo combinaciones coherentes basadas en el número de huéspedes
    const addCombo = (composition) => {
      const { simple=0, doble=0, triple=0, cuadruple=0 } = composition
      const capacity = simple*1 + doble*2 + triple*3 + cuadruple*4
      if (capacity < totalGuests) return
      
      const pick = (arr,n)=>arr.slice(0,n).map(x=>x)
      const ids = []
      let pricePerNight = 0
      
      if (simple>0) { const p = pick(byType.simple, simple); if (p.length<simple) return; pricePerNight += p.reduce((s,x)=>s+x.price,0); ids.push(...p.map(x=>x.id)) }
      if (doble>0) { const p = pick(byType.doble, doble); if (p.length<doble) return; pricePerNight += p.reduce((s,x)=>s+x.price,0); ids.push(...p.map(x=>x.id)) }
      if (triple>0) { const p = pick(byType.triple, triple); if (p.length<triple) return; pricePerNight += p.reduce((s,x)=>s+x.price,0); ids.push(...p.map(x=>x.id)) }
      if (cuadruple>0) { const p = pick(byType.cuadruple, cuadruple); if (p.length<cuadruple) return; pricePerNight += p.reduce((s,x)=>s+x.price,0); ids.push(...p.map(x=>x.id)) }
      
      results.push({
        composition: { simple, doble, triple, cuadruple },
        capacity,
        rooms: ids,
        pricePerNight,
        nights,
        total: pricePerNight * nights,
      })
    }

    // Generar combinaciones coherentes según número de huéspedes
    // SIEMPRE incluir la opción de X simples para X personas
    if (totalGuests === 1) {
      addCombo({ simple: 1 })
      addCombo({ doble: 1 })
    } else if (totalGuests === 2) {
      addCombo({ doble: 1 })
      addCombo({ simple: 2 })
    } else if (totalGuests === 3) {
      addCombo({ triple: 1 })
      addCombo({ doble: 1, simple: 1 })
      addCombo({ simple: 3 })
    } else if (totalGuests === 4) {
      addCombo({ cuadruple: 1 })
      addCombo({ doble: 2 })
      addCombo({ triple: 1, simple: 1 })
      addCombo({ simple: 4 })
    } else if (totalGuests === 5) {
      addCombo({ cuadruple: 1, simple: 1 })
      addCombo({ triple: 1, doble: 1 })
      addCombo({ doble: 2, simple: 1 })
      addCombo({ simple: 5 })
    } else if (totalGuests === 6) {
      addCombo({ cuadruple: 1, doble: 1 })
      addCombo({ triple: 2 })
      addCombo({ doble: 3 })
      addCombo({ simple: 6 })
    } else if (totalGuests === 7) {
      addCombo({ cuadruple: 1, triple: 1 })
      addCombo({ triple: 2, simple: 1 })
      addCombo({ cuadruple: 1, doble: 1, simple: 1 })
      addCombo({ simple: 7 })
    } else if (totalGuests === 8) {
      addCombo({ cuadruple: 2 })
      addCombo({ triple: 2, doble: 1 })
      addCombo({ doble: 4 })
      addCombo({ simple: 8 })
    } else {
      // Para más de 8 huéspedes, generar combinaciones eficientes
      const numCuad = Math.floor(totalGuests / 4)
      const resto = totalGuests % 4
      
      // Opción 1: Maximizar cuádruples
      if (resto === 0) addCombo({ cuadruple: numCuad })
      else if (resto === 1) addCombo({ cuadruple: numCuad, simple: 1 })
      else if (resto === 2) addCombo({ cuadruple: numCuad, doble: 1 })
      else if (resto === 3) addCombo({ cuadruple: numCuad, triple: 1 })
      
      // Opción 2: Usar triples
      const numTriple = Math.floor(totalGuests / 3)
      const resto3 = totalGuests % 3
      if (resto3 === 0) addCombo({ triple: numTriple })
      else if (resto3 === 1) addCombo({ triple: numTriple - 1, cuadruple: 1 })
      else if (resto3 === 2) addCombo({ triple: numTriple, doble: 1 })
      
      // Opción 3: Usar dobles
      const numDoble = Math.ceil(totalGuests / 2)
      addCombo({ doble: numDoble })
      
      // Opción 4: SIEMPRE incluir opción de todas simples
      addCombo({ simple: totalGuests })
    }

    // ordenar por total y limitar a 10 opciones
    return results.sort((a,b)=>a.total-b.total).slice(0,10)
  }

  // Cargar sesión y habitaciones desde Supabase (con fallback)
  const loadAllRooms = async (mounted = true) => {
    try {
      const { data: roomsData, error } = await supabase
        .from('rooms')
        .select('id_room, room_number, capacity, base_price, is_open, id_room_type')
        .order('base_price', { ascending: true })
      if (error) throw error
      
      const { data: typesData } = await supabase
        .from('room_type')
        .select('id_room_type, name')
      const typesMap = Object.fromEntries((typesData || []).map(t => [t.id_room_type, t.name]))
      
      if (!mounted) return
      setRooms(
        (roomsData || []).map(r => {
          const typeName = typesMap[r.id_room_type] || ''
          return {
            id: r.id_room,
            title: r.room_number || typeName,
            desc: typeName ? `Tipo: ${typeName}` : '',
            img: bgS3,
            capacity: r.capacity,
            price: r.base_price,
            status: r.is_open ? 'open' : 'closed',
            type_room: typeName.toLowerCase(),
          }
        })
      )
    } catch (_e) {
      if (!mounted) return
      setRooms([
        { id: 'rm-1', title: 'Doble', desc: 'Cama queen o dos singles', img: bgS3, capacity: 2, price: 120 },
        { id: 'rm-2', title: 'Triple', desc: 'Ideal para familias', img: bgS3, capacity: 3, price: 160 },
        { id: 'rm-3', title: 'Suite', desc: 'Confort superior', img: bgS3, capacity: 2, price: 220 },
      ])
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data?.session || null)
      await loadAllRooms(mounted)
    })()
    return () => { mounted = false }
  }, [])

  const totalGuests = Math.max(1, Number(adults) + Number(children))

  // Agrupar resultados por tipo (simple/doble/triple/cuadruple) mostrando precio mínimo y cantidad disponible
  const summarizeByType = (list) => {
    const summary = {}
    for (const r of list) {
      const t = String(r.type_room || '').toLowerCase()
      if (!t) continue
      if (!summary[t]) summary[t] = { type: t, count: 0, minPrice: Number.POSITIVE_INFINITY }
      summary[t].count += 1
      const priceNum = Number(r.price)
      if (!Number.isNaN(priceNum)) summary[t].minPrice = Math.min(summary[t].minPrice, priceNum)
    }
    // Normalizar minPrice si quedó infinito
    return Object.values(summary).map(s => ({ ...s, minPrice: s.minPrice === Number.POSITIVE_INFINITY ? null : s.minPrice }))
  }

  const searchRooms = async (e) => {
    e?.preventDefault()
    setSearching(true)
    setHasSearched(true)
    setErrorMsg('')
    try {
      // Validación de fechas: check-out debe ser posterior a check-in
      const ci = (checkIn || '').slice(0,10)
      const co = (checkOut || '').slice(0,10)
      const d1 = ci ? new Date(ci + 'T00:00:00') : null
      const d2 = co ? new Date(co + 'T00:00:00') : null
      if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) {
        throw new Error('Completá las fechas de ingreso y salida')
      }
      const nights = Math.round((d2 - d1) / (1000*60*60*24))
      if (nights <= 0) {
        throw new Error('La fecha de salida debe ser posterior a la de ingreso')
      }

      // Usar la función RPC de Supabase para obtener habitaciones disponibles
      const { data: roomsData, error } = await supabase
        .rpc('search_available_rooms', {
          p_check_in: ci,
          p_check_out: co
        })
      
      if (error) throw error

      // Mapear los resultados al formato esperado
      let list = (roomsData || []).map(r => {
        const typeName = r.room_type_name || ''
        return {
          id: r.id_room,
          title: r.room_number || typeName,
          desc: typeName ? `Tipo: ${typeName}` : '',
          img: bgS3,
          capacity: r.capacity,
          price: r.base_price,
          status: 'open',
          type_room: typeName.toLowerCase(),
        }
      })

      // Aplicar filtros adicionales
      if (roomType) list = list.filter(x => String(x.type_room) === roomType)
      if (maxPrice) list = list.filter(x => Number(x.price) <= Number(maxPrice))
      
      const combosResult = buildCombos(list)
      
      setRooms(list)
      setCombos(combosResult)
    } catch (e) {
      setErrorMsg(e.message || 'No se pudo buscar disponibilidad. Probá nuevamente.')
      // Fallback: mantener último listado y combos vacíos
      setCombos([])
    } finally {
      setSearching(false)
    }
  }

  // Helpers de fechas para inputs
  const todayStr = new Date().toISOString().slice(0,10)
  const minOutStr = (() => {
    const base = checkIn ? new Date(checkIn + 'T00:00:00') : new Date()
    base.setDate(base.getDate() + 1)
    return base.toISOString().slice(0,10)
  })()

  const reserveRoom = (room) => {
    if (!session) {
      navigate('/login', { state: { redirectTo: '/habitaciones', roomId: room.id } })
      return
    }
    // En esta versión, enviamos intención de reserva a /reservas
    navigate('/reservas', { state: { startBooking: true, roomId: room.id } })
  }

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center"
      style={{ backgroundImage: `url(${bgS3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 hero-overlay" />
      <div className="relative z-10 w-full max-w-6xl px-6 py-10">
        <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight text-center mb-6">Habitaciones</h1>

        {mustVerify && (
          <div className="mb-6 rounded-lg border border-yellow-400/40 bg-yellow-500/20 px-4 py-3 text-sm text-yellow-50">
            Te enviamos un correo a <span className="font-semibold">{emailHint}</span> para verificar tu cuenta.
            <div className="mt-2 flex gap-2">
              <button disabled={loading} onClick={resend} className="rounded-md border border-white/20 px-3 py-1 text-sm hover:border-white/30 disabled:opacity-60">
                {loading ? 'Reenviando...' : 'Reenviar correo'}
              </button>
            </div>
          </div>
        )}

        {/* Filtros estilo Booking */}
        <form onSubmit={searchRooms} className="mb-3 grid grid-cols-1 md:grid-cols-8 gap-3 rounded-xl border border-white/15 bg-black/20 backdrop-blur p-4">
          <div>
            <label className="block text-xs opacity-80 mb-1">Check-in</label>
            <input
              type="date"
              value={checkIn}
              min={todayStr}
              onChange={(e) => {
                const v = e.target.value
                setCheckIn(v)
                if (v) {
                  const inD = new Date(v + 'T00:00:00')
                  const outD = checkOut ? new Date(checkOut + 'T00:00:00') : null
                  if (outD && (isNaN(outD) || outD <= inD)) {
                    const nd = new Date(inD)
                    nd.setDate(nd.getDate() + 1)
                    setCheckOut(nd.toISOString().slice(0,10))
                  }
                }
              }}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40"
              required
            />
          </div>
          <div>
            <label className="block text-xs opacity-80 mb-1">Check-out</label>
            <input
              type="date"
              value={checkOut}
              min={minOutStr}
              onChange={(e) => {
                const v = e.target.value
                if (!checkIn) { setCheckOut(v); return }
                const inD = new Date(checkIn + 'T00:00:00')
                const outD = v ? new Date(v + 'T00:00:00') : null
                if (outD && (isNaN(outD) || outD <= inD)) {
                  const nd = new Date(inD)
                  nd.setDate(nd.getDate() + 1)
                  setCheckOut(nd.toISOString().slice(0,10))
                } else {
                  setCheckOut(v)
                }
              }}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40"
              required
            />
          </div>
          <div>
            <label className="block text-xs opacity-80 mb-1">Adultos</label>
            <input type="number" min="1" value={adults} onChange={(e) => setAdults(e.target.value)} className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-xs opacity-80 mb-1">Niños</label>
            <input type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-xs opacity-80 mb-1">Tipo</label>
            <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40">
              <option value="">Todos</option>
              <option value="simple">Simple</option>
              <option value="doble">Doble</option>
              <option value="triple">Triple</option>
              <option value="suite">Suite</option>
            </select>
          </div>
          <div>
            <label className="block text-xs opacity-80 mb-1">Precio máx.</label>
            <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" placeholder="Ej: 200" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={searching} className="w-full rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={async () => { setCheckIn(''); setCheckOut(''); setAdults(2); setChildren(0); setRoomType(''); setMaxPrice(''); setHasSearched(false); await loadAllRooms(true); }}
              className="w-full rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm">
            {errorMsg}
          </div>
        )}

        {hasSearched && !searching && rooms.length === 0 && (
          <div className="rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6 text-center opacity-90 mb-6">
            No hay habitaciones disponibles para ese rango y cantidad de huéspedes.
          </div>
        )}

        {/* Mostrar combinaciones sugeridas que cubren la cantidad de huéspedes */}
        {!searching && combos.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {combos.map((opt, idx) => (
              <div key={idx} className="rounded-xl overflow-hidden border border-white/15 bg-black/20 backdrop-blur p-4">
                <div className="text-lg font-semibold">Opción #{idx+1}</div>
                <p className="opacity-80 text-sm mt-1">
                  {opt.composition.simple>0 ? `${opt.composition.simple}× simple` : ''}
                  {opt.composition.doble>0 ? `${opt.composition.simple>0?', ':''}${opt.composition.doble}× doble` : ''}
                  {opt.composition.triple>0 ? `${(opt.composition.simple>0||opt.composition.doble>0)?', ':''}${opt.composition.triple}× triple` : ''}
                  {opt.composition.cuadruple>0 ? `${(opt.composition.simple>0||opt.composition.doble>0||opt.composition.triple>0)?', ':''}${opt.composition.cuadruple}× cuadruple` : ''}
                </p>
                <p className="opacity-80 text-sm">Capacidad: {opt.capacity} · Noches: {opt.nights}</p>
                <div className="mt-2 text-base">Total: $ {opt.total.toFixed(2)}</div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      if (!session) { navigate('/login', { state: { redirectTo: '/habitaciones' } }); return }
                      navigate('/checkout', { state: { rooms: opt.rooms, composition: opt.composition, total: opt.total, nights: opt.nights, checkIn, checkOut, guests: totalGuests } })
                    }}
                    className="inline-block rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition"
                  >
                    Elegir esta opción
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
