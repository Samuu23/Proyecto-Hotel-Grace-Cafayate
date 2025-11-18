import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import bgS3 from '../assets/bg-s3.jpg'

export default function Checkout() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [payOpen, setPayOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState('')
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvc: '' })
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { sub.subscription.unsubscribe(); mounted = false }
  }, [])

  if (!state) {
    return (
      <div className="p-6">
        <p>No hay datos de reserva. Volvé a Habitaciones.</p>
      </div>
    )
  }

  const { rooms = [], composition = {}, total = 0, nights = 1, checkIn, checkOut, guests } = state

  const createReservations = async ({ payNow }) => {
    if (!session?.user?.id) throw new Error('Sesión no encontrada')
    if (!Array.isArray(rooms) || rooms.length === 0) throw new Error('No hay habitaciones seleccionadas')
    // Validación de fechas
    const ci = (checkIn || '').slice(0,10)
    const co = (checkOut || '').slice(0,10)
    const d1 = ci ? new Date(ci + 'T00:00:00') : null
    const d2 = co ? new Date(co + 'T00:00:00') : null
    if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) throw new Error('Fechas inválidas')
    const stayNights = Math.round((d2 - d1) / (1000*60*60*24))
    if (stayNights <= 0) throw new Error('La fecha de salida debe ser posterior a la de ingreso')
    
    // Verificar disponibilidad de habitaciones ANTES de reservar
    const { data: busyData } = await supabase
      .from('reserve')
      .select('id_room, check_in, check_out')
      .in('status', ['pendiente', 'confirmada'])
      .in('id_room', rooms)
    
    const occupiedRooms = (busyData || []).filter(r => {
      const rci = String(r.check_in).slice(0, 10)
      const rco = String(r.check_out).slice(0, 10)
      // Usar >= y <= para coincidir con lógica del trigger
      return rco >= ci && rci <= co
    }).map(r => r.id_room)
    
    if (occupiedRooms.length > 0) {
      throw new Error(`Las siguientes habitaciones ya no están disponibles: ${occupiedRooms.join(', ')}. Por favor, volvé a buscar.`)
    }
    
    const perRoomTotal = Number(total || 0) / rooms.length
    const createdIds = []
    for (const roomId of rooms) {
      const { data, error } = await supabase
        .from('reserve')
        .insert({
          id_user: session.user.id,
          id_room: roomId,
          check_in: ci,
          check_out: co,
          adults_total: Number(guests) || 1,
          children_total: 0,
          total_amount: perRoomTotal,
          status: payNow ? 'confirmada' : 'pendiente',
          payment_status: payNow ? 'pagado' : 'no_pagado',
        })
        .select('id_reserve')
        .single()
      if (error) {
        const msg = String(error.message || '')
        if (msg.toLowerCase().includes('range lower bound')) {
          throw new Error('La fecha de salida debe ser posterior a la de ingreso')
        }
        throw error
      }
      createdIds.push(data.id_reserve)
    }
    return createdIds
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center" style={{ backgroundImage: `url(${bgS3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 hero-overlay" />
      <div className="relative z-10 w-full max-w-3xl px-6 py-10">
        <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight text-center mb-8">Revisión de reserva</h1>

        <div className="rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Detalle</h2>
              <p className="text-sm opacity-90">Check-in: {checkIn}</p>
              <p className="text-sm opacity-90">Check-out: {checkOut}</p>
              <p className="text-sm opacity-90">Noches: {nights}</p>
              <p className="text-sm opacity-90">Huéspedes: {guests}</p>
              <p className="text-sm opacity-90 mt-2">Composición:
                {composition.simple>0 ? ` ${composition.simple}× simple` : ''}
                {composition.doble>0 ? `, ${composition.doble}× doble` : ''}
                {composition.triple>0 ? `, ${composition.triple}× triple` : ''}
                {composition.cuadruple>0 ? `, ${composition.cuadruple}× cuadruple` : ''}
              </p>
              <p className="mt-3 text-base">Total: $ {Number(total).toFixed(2)}</p>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Servicios del hotel</h2>
              <ul className="list-disc pl-5 opacity-90 text-sm space-y-1">
                <li>Desayuno incluido</li>
                <li>Wi‑Fi de alta velocidad</li>
                <li>Piscina y solárium</li>
                <li>Estacionamiento gratuito</li>
                <li>Recepción 24 hs</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex gap-3 flex-wrap">
            <button onClick={() => navigate('/habitaciones')} className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors">Volver</button>
            <button
              onClick={async () => {
                setSaveError('')
                setProcessing(true)
                try {
                  const ids = await createReservations({ payNow: false })
                  const firstId = ids[0]
                  navigate(`/reservas/${firstId}`)
                } catch (e) {
                  setSaveError(e.message || 'No se pudo crear la reserva')
                } finally {
                  setProcessing(false)
                }
              }}
              disabled={processing}
              className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors disabled:opacity-60"
            >
              {processing ? 'Guardando…' : 'Reservar y pagar luego'}
            </button>
            <button onClick={() => { setCard({ number: '4111 1111 1111 1111', name: 'Juan Perez', exp: '12/29', cvc: '123' }); setPayOpen(true) }} className="rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition">Pagar ahora</button>
          </div>
          {saveError && (<div className="mt-3 text-sm rounded-md border border-red-400/40 bg-red-500/20 px-3 py-2">{saveError}</div>)}
        </div>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setPayOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/15 bg-black/90 p-6">
            <h3 className="text-xl font-semibold mb-3">Pasarela de pago</h3>
            <p className="text-sm opacity-90 mb-4">Pago simulado. No se realizará ningún cargo. (Integración real pendiente).</p>
            <div className="space-y-2 text-sm opacity-90 mb-4">
              <div className="flex justify-between"><span>Total a pagar</span><span>$ {Number(total).toFixed(2)}</span></div>
            </div>

            {payError && (
              <div className="mb-3 rounded-md border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm">{payError}</div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setPayError('')
                setProcessing(true)
                try {
                  // Validaciones mínimas
                  const num = card.number.replace(/\s+/g,'')
                  if (!/^\d{16}$/.test(num)) throw new Error('Número de tarjeta inválido')
                  if (!card.name || card.name.length < 3) throw new Error('Nombre del titular inválido')
                  if (!/^\d{2}\/\d{2}$/.test(card.exp)) throw new Error('Vencimiento inválido (MM/AA)')
                  if (!/^\d{3,4}$/.test(card.cvc)) throw new Error('CVC inválido')

                  // Simulación de autorización
                  await new Promise(r => setTimeout(r, 1200))

                  const ids = await createReservations({ payNow: true })
                  navigate(`/reservas/${ids[0]}`)
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
                <input value={card.number} onChange={(e)=>setCard({...card, number: e.target.value})} placeholder="4111 1111 1111 1111" className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" inputMode="numeric" />
              </div>
              <div>
                <label className="block text-xs opacity-80 mb-1">Titular</label>
                <input value={card.name} onChange={(e)=>setCard({...card, name: e.target.value})} placeholder="Nombre Apellido" className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs opacity-80 mb-1">Vencimiento</label>
                  <input value={card.exp} onChange={(e)=>setCard({...card, exp: e.target.value})} placeholder="MM/AA" className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" inputMode="numeric" />
                </div>
                <div>
                  <label className="block text-xs opacity-80 mb-1">CVC</label>
                  <input value={card.cvc} onChange={(e)=>setCard({...card, cvc: e.target.value})} placeholder="123" className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 outline-none focus:border-white/40" inputMode="numeric" />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => setPayOpen(false)} className="rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition-colors">Cerrar</button>
                <button type="submit" disabled={processing} className="rounded-lg px-4 py-2 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">
                  {processing ? 'Procesando…' : 'Pagar ahora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
