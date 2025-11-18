import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import bgS3 from '../assets/bg-s3.jpg'

export default function ReservaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reserva, setReserva] = useState(null)
  const [room, setRoom] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [paying, setPaying] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [checkinTime, setCheckinTime] = useState('14:00')
  const [checkoutTime, setCheckoutTime] = useState('11:00')
  const [payOpen, setPayOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState('')
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvc: '' })

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { sub.subscription.unsubscribe(); mounted = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (!id) return
        const { data, error } = await supabase
          .from('reserve')
          .select('id_reserve, id_room, check_in, check_out, adults_total, children_total, total_amount, status, payment_status')
          .eq('id_reserve', id)
          .limit(1)
        if (error) throw error
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null
        setReserva(row)
        setErrorMsg('')
        if (row?.id_room) {
          const { data: rdata, error: rerr } = await supabase
            .from('rooms')
            .select('id_room, room_number, base_price, capacity, room_type:room_type(name)')
            .eq('id_room', row.id_room)
            .limit(1)
          if (!rerr) setRoom(Array.isArray(rdata) && rdata.length > 0 ? rdata[0] : null)
        }
        // Opcional: leer horarios desde hotel_settings si está habilitado por env
        const useHotelSettings = import.meta.env?.VITE_HOTEL_SETTINGS === 'true'
        if (useHotelSettings) {
          try {
            const { data: cfg } = await supabase
              .from('hotel_settings')
              .select('checkin_time, checkout_time')
              .limit(1)
            if (Array.isArray(cfg) && cfg.length > 0) {
              if (cfg[0].checkin_time) setCheckinTime(String(cfg[0].checkin_time))
              if (cfg[0].checkout_time) setCheckoutTime(String(cfg[0].checkout_time))
            }
          } catch (_ignore) { /* tabla opcional */ }
        }
      } catch (e) {
        setErrorMsg(e.message || 'No se pudo cargar la reserva')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p>Iniciá sesión para ver tu reserva.</p>
        <a className="underline" href="/login">Ir a Ingresar</a>
      </div>
    )
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center" style={{ backgroundImage: `url(${bgS3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 hero-overlay" />
      <div className="relative z-10 w-full max-w-3xl px-6 py-10">
        <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight text-center mb-8">Detalle de reserva</h1>

        <div className="rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6">
          {loading ? (
            <p className="opacity-80">Cargando...</p>
          ) : !reserva ? (
            <p className="opacity-80">No se encontró la reserva.</p>
          ) : (
            <div className="space-y-3">
              {errorMsg && (
                <div className="mb-2 rounded-md border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm">{errorMsg}</div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm opacity-90">Código: {String(reserva.id_reserve).padStart(6,'0')}</p>
                  <p className="text-sm opacity-90">Ingreso: {new Date(reserva.check_in).toLocaleDateString('es-AR')}</p>
                  <p className="text-sm opacity-90">Salida: {new Date(reserva.check_out).toLocaleDateString('es-AR')}</p>
                  <p className="text-sm opacity-90">Huéspedes: {(reserva.adults_total||0)+(reserva.children_total||0)}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90">Estado: <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/20 text-xs capitalize">{String(reserva.status)}</span></p>
                  <p className="text-sm opacity-90">Pago: <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/20 text-xs capitalize">{String(reserva.payment_status)}</span></p>
                  <p className="text-sm opacity-90">Total: $ {Number(reserva.total_amount).toFixed(2)}</p>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Habitación</h3>
                {!room ? (
                  <p className="text-sm opacity-80">No disponible.</p>
                ) : (
                  <div className="text-sm opacity-90">
                    Hab. #{room.room_number} · {room.room_type?.name || ''} · $ {Number(room.base_price).toFixed(2)}/noche
                  </div>
                )}
              </div>
              {String(reserva?.payment_status) === 'pagado' && (
                <div className="rounded-md border border-white/15 p-3 text-sm opacity-90">
                  Horarios del hotel: Check‑in {checkinTime} · Check‑out {checkoutTime}
                </div>
              )}
              <div className="pt-2 flex gap-3 flex-wrap">
                <button onClick={() => navigate('/reservas')} className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors">Volver</button>
                {(() => { const st = String(reserva?.status); return st !== 'cancelada' && st !== 'cancelado' })() && (
                  <button
                    disabled={cancelling}
                    onClick={async () => {
                      setErrorMsg('')
                      if (!confirm('¿Cancelar esta reserva?')) return
                      try {
                        setCancelling(true)
                        const rid = Number(id)
                        const { error } = await supabase
                          .from('reserve')
                          .update({ status: 'cancelado' })
                          .eq('id_reserve', rid)
                          .eq('id_user', session.user.id)
                        if (error) throw error
                        navigate('/reservas')
                      } catch (e) {
                        setErrorMsg(e.message || 'No se pudo cancelar la reserva')
                      } finally {
                        setCancelling(false)
                      }
                    }}
                    className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors disabled:opacity-60"
                  >
                    {cancelling ? 'Cancelando…' : 'Cancelar reserva'}
                  </button>
                )}
                {String(reserva?.payment_status) !== 'pagado' && (
                  <button
                    onClick={() => { setCard({ number: '4111 1111 1111 1111', name: 'Juan Perez', exp: '12/29', cvc: '123' }); setPayOpen(true) }}
                    className="rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition"
                  >
                    Pagar ahora
                  </button>
                )}
              </div>

              {payOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/70" onClick={() => setPayOpen(false)} />
                  <div className="relative z-10 w-full max-w-md rounded-xl border border-white/15 bg-black/90 p-6">
                    <h3 className="text-xl font-semibold mb-3">Pasarela de pago</h3>
                    <p className="text-sm opacity-90 mb-4">Pago simulado. No se realizará ningún cargo.</p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        setPayError('')
                        setProcessing(true)
                        try {
                          const num = card.number.replace(/\s+/g,'')
                          if (!/^\d{16}$/.test(num)) throw new Error('Número de tarjeta inválido')
                          if (!card.name || card.name.length < 3) throw new Error('Nombre del titular inválido')
                          if (!/^\d{2}\/\d{2}$/.test(card.exp)) throw new Error('Vencimiento inválido (MM/AA)')
                          if (!/^\d{3,4}$/.test(card.cvc)) throw new Error('CVC inválido')

                          await new Promise(r => setTimeout(r, 1200))

                          const { error } = await supabase
                            .from('reserve')
                            .update({ payment_status: 'pagado', status: 'confirmada' })
                            .eq('id_reserve', id)
                          if (error) throw error
                          window.location.reload()
                        } catch (err) {
                          setPayError(err.message || 'Error en el pago')
                        } finally {
                          setProcessing(false)
                        }
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-xs opacity-80 mb-1">Número de tarjeta</label>
                        <input value={card.number} onChange={(e)=>setCard(v=>({...v, number: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="4111 1111 1111 1111" />
                      </div>
                      <div>
                        <label className="block text-xs opacity-80 mb-1">Titular</label>
                        <input value={card.name} onChange={(e)=>setCard(v=>({...v, name: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="Juan Perez" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs opacity-80 mb-1">Vencimiento (MM/AA)</label>
                          <input value={card.exp} onChange={(e)=>setCard(v=>({...v, exp: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="12/29" />
                        </div>
                        <div>
                          <label className="block text-xs opacity-80 mb-1">CVC</label>
                          <input value={card.cvc} onChange={(e)=>setCard(v=>({...v, cvc: e.target.value}))} className="w-full bg-transparent rounded-lg border border-white/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="123" />
                        </div>
                      </div>
                      {payError && (<div className="text-sm rounded-md border border-red-400/40 bg-red-500/20 px-3 py-2">{payError}</div>)}
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onClick={()=>setPayOpen(false)} className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors">Cancelar</button>
                        <button type="submit" disabled={processing} className="rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">{processing ? 'Procesando…' : 'Confirmar pago'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
