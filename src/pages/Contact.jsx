import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import bgS3 from '../assets/bg-s3.jpg'
import { sendEmailToHotel } from '../lib/emailService'
import { supabase } from '../lib/supabaseClient'

export default function Contact() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user?.email) {
        setForm(f => ({ ...f, email: data.session.user.email }))
        
        // Verificar rol y redirigir si es operador o admin
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('rol')
            .eq('id_user', data.session.user.id)
            .single()

          if (userData?.rol === 'operario') {
            navigate('/operadores', { replace: true })
          } else if (userData?.rol === 'administrador') {
            navigate('/admin', { replace: true })
          }
        } catch (err) {
          console.error('Error checking user role:', err)
        }
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (sess?.user?.email) {
        setForm(f => ({ ...f, email: sess.user.email }))
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSending(true)

    try {
      if (!form.email || !form.subject || !form.message) {
        throw new Error('Completá todos los campos obligatorios')
      }

      const { error: insertError } = await supabase
        .from('consultations')
        .insert({
          id_user: session?.user?.id || null,
          email_contact: form.email,
          name_contact: form.name || null,
          subject: form.subject,
          message: form.message,
          status: 'pendiente'
        })

      if (insertError) throw insertError

      // Enviar email automático al hotel
      try {
        await sendEmailToHotel({
          from: form.email,
          name: form.name,
          subject: form.subject,
          message: form.message
        })
      } catch (emailError) {
        console.error('Error sending email:', emailError)
        // No mostramos error al usuario, la consulta ya se guardó
      }

      setMessage('¡Consulta enviada! Te responderemos a la brevedad.')
      setForm({ name: '', email: session?.user?.email || '', subject: '', message: '' })
    } catch (err) {
      setError(err.message || 'No se pudo enviar la consulta')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgS3})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-3">Contacto</h1>
          <p className="text-white/80 text-center mb-8">¿Tenés alguna consulta? Escribinos y te responderemos pronto.</p>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
            {message && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-400/40 rounded-lg text-white">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-400/40 rounded-lg text-white">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-white text-sm mb-2">Nombre (opcional)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Asunto *</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                  placeholder="Ej: Consulta sobre disponibilidad"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Mensaje *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40 resize-none"
                  placeholder="Escribí tu consulta aquí..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3 px-6 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Enviando...' : 'Enviar consulta'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/20 text-white/70 text-sm">
              <p className="mb-2"><strong>También podés contactarnos por:</strong></p>
              <p>📧 Email: info@gacehotel.com</p>
              <p>📱 WhatsApp: +54 9 3868 123456</p>
              <p>📍 Dirección: Calle Principal 123, Cafayate, Salta</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
