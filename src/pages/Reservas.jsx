import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import bgS3 from '../assets/bg-s3.jpg'
import { useLocation, useNavigate, Link } from 'react-router-dom'

export default function Reservas() {
  const [session, setSession] = useState(null)
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  // (buscador removido de Mis reservas)
  const location = useLocation()
  const navigate = useNavigate()
  const [showCreatedBanner, setShowCreatedBanner] = useState(false)
  const [showPaymentOk, setShowPaymentOk] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setSession(sess))
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Mostrar banner de éxito post registro y limpiar state
  useEffect(() => {
    if (location.state?.justRegistered) {
      setShowCreatedBanner(true)
      navigate('.', { replace: true, state: {} })
      const t = setTimeout(() => setShowCreatedBanner(false), 4000)
      return () => clearTimeout(t)
    }
  }, [location.state, navigate])

  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    const fetchReservas = async () => {
      setLoading(true)
      try {
        if (!session) {
          setReservas([])
          return
        }
        const { data, error } = await supabase
          .from('reserve')
          .select(`
            id_reserve, id_user, check_in, check_out, adults_total, children_total, status, payment_status, total_amount, created_at,
            rooms:id_room(room_number, capacity, room_type(name))
          `)
          .eq('id_user', session.user.id)
          .in('status', ['pendiente', 'confirmada'])
          .order('created_at', { ascending: false })
        if (error) throw error
        const mapped = (data || []).map((r) => {
          const tipo = r.rooms?.room_type?.name ? String(r.rooms.room_type.name).toLowerCase() : ''
          const titulo = tipo ? `Habitación ${tipo}` : 'Habitación'
          return {
            id: r.id_reserve,
            titulo,
            numero: r.rooms?.room_number || null,
            fechaIngreso: r.check_in,
            fechaSalida: r.check_out,
            huespedes: (r.adults_total || 0) + (r.children_total || 0),
            estado: r.status,
            pago: r.payment_status,
            total: r.total_amount,
          }
        })
        setReservas(mapped)
      } catch (e) {
        console.error(e)
        setReservas([])
      } finally {
        setLoading(false)
      }
    }
    fetchReservas()
  }, [session, reloadTick])

  useEffect(() => {
    if (!session?.user?.id) return
    const channel = supabase.channel('reservas-user-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reserve', filter: `id_user=eq.${session.user.id}` }, () => {
        setReloadTick((t) => t + 1)
      })
      .subscribe()
    return () => {
      try { supabase.removeChannel(channel) } catch (_) {}
    }
  }, [session?.user?.id])

  // (buscador removido de Mis reservas)

  // Banner de pago exitoso
  useEffect(() => {
    if (location.state?.paymentOk) {
      setShowPaymentOk(true)
      navigate('.', { replace: true, state: {} })
      const t = setTimeout(() => setShowPaymentOk(false), 4000)
      return () => clearTimeout(t)
    }
  }, [location.state, navigate])


  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center"
      style={{ backgroundImage: `url(${bgS3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 hero-overlay" />

      <div className="relative z-10 w-full max-w-5xl px-6 py-10">
        {/* Buscador removido de Mis reservas */}

        <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight text-center mb-8">Mis reservas</h1>

        {showCreatedBanner && (
          <div className="mb-6 rounded-lg border border-green-400/40 bg-green-500/20 px-4 py-3 text-sm">
            ¡Tu cuenta se creó satisfactoriamente!
          </div>
        )}

        {showPaymentOk && (
          <div className="mb-6 rounded-lg border border-green-400/40 bg-green-500/20 px-4 py-3 text-sm">
            ¡Pago exitoso! Tu reserva fue creada.
          </div>
        )}

        {!session && (
          <div className="mx-auto max-w-xl text-center rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6">
            <p className="mb-3">Para ver tus reservas, primero iniciá sesión.</p>
            <a href="/login" className="inline-block rounded-lg px-4 py-3 bg-white/90 text-black font-medium hover:bg-white transition">Ir a Ingresar</a>
          </div>
        )}

        {session && (
          <div className="rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6">
            {loading ? (
              <p className="opacity-80">Cargando...</p>
            ) : reservas.length === 0 ? (
              <p className="opacity-80">No hay reservas en este momento.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {reservas.map((r) => (
                  <li key={r.id} className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{r.titulo}{r.numero ? ` · #${r.numero}` : ''}</p>
                      <p className="text-sm opacity-80">Ingreso: {r.fechaIngreso} · Salida: {r.fechaSalida} · Huéspedes: {r.huespedes}</p>
                      <p className="text-sm opacity-80">Pago: {r.pago} · Total: $ {r.total}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link to={`/reservas/${r.id}`} className="text-sm px-3 py-1 rounded-full border border-white/20 hover:border-white/30 transition-colors">Ver detalle</Link>
                      <span className="text-sm px-3 py-1 rounded-full border border-white/20">{r.estado}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        
      </div>
    </div>
  )
}
