import { useEffect, useState } from 'react'
import bgS3 from '../assets/bg-s3.jpg'
import { supabase } from '../lib/supabaseClient'

export default function Account() {
  const [session, setSession] = useState(null)
  const [form, setForm] = useState({ email_user: '', name_user: '', surname_user: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setSession(sess))
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!session) { setLoading(false); return }
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('email_user, name_user, surname_user, phone')
          .eq('id_user', session.user.id)
          .limit(1)
        const row = !error && Array.isArray(data) && data.length > 0 ? data[0] : null
        setForm({
          email_user: row?.email_user ?? session.user.email ?? '',
          name_user: row?.name_user ?? '',
          surname_user: row?.surname_user ?? '',
          phone: row?.phone ?? '',
        })
        setEditing(false)
      } catch (e) {
        // noop
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setMessage('')
    try {
      // Verificar si el usuario ya existe
      const { data: existingUser } = await supabase
        .from('users')
        .select('id_user, rol')
        .eq('id_user', session.user.id)
        .single()

      // Si el usuario existe, actualizar sin cambiar el rol
      // Si no existe, crear con rol 'usuario'
      const userData = {
        id_user: session.user.id,
        email_user: form.email_user,
        name_user: form.name_user,
        surname_user: form.surname_user,
        phone: form.phone,
      }

      // Solo agregar rol si es un nuevo usuario
      if (!existingUser) {
        userData.rol = 'usuario'
      }

      const up = await supabase.from('users').upsert(
        userData,
        { onConflict: 'id_user' }
      )
      if (up.error) throw up.error
      const res = await supabase
        .from('users')
        .select('email_user, name_user, surname_user, phone')
        .eq('id_user', session.user.id)
        .limit(1)
      const row = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null
      if (row) setForm({
        email_user: row.email_user || '',
        name_user: row.name_user || '',
        surname_user: row.surname_user || '',
        phone: row.phone || '',
      })
      setMessage('Perfil actualizado')
      setEditing(false)
      setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setMessage(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const onSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center"
      style={{ backgroundImage: `url(${bgS3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 hero-overlay" />

      <div className="relative z-10 w-full max-w-xl px-6 py-10">
        <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight text-center mb-8">Mi cuenta</h1>

        {!session ? null : (
          <div>
            {!editing ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-xl">Bienvenido, <span className="font-semibold">{form.name_user || 'Usuario'}</span></p>
                  <p className="opacity-80 text-sm">Podés administrar tus datos desde aquí.</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-black/20 backdrop-blur p-6">
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div><span className="opacity-70">Email:</span> {form.email_user}</div>
                    <div><span className="opacity-70">Nombre:</span> {form.name_user}</div>
                    <div><span className="opacity-70">Apellido:</span> {form.surname_user}</div>
                    <div><span className="opacity-70">Teléfono:</span> {form.phone}</div>
                  </div>
                  {message && <div className="mt-3 text-sm opacity-90">{message}</div>}
                  <div className="mt-4 flex items-center gap-3">
                    <button onClick={() => setEditing(true)} className="rounded-lg px-4 py-3 bg-white/90 text-black font-medium hover:bg-white transition">Modificar perfil</button>
                    <button type="button" onClick={onSignOut} className="rounded-lg px-4 py-3 border border-white/20 hover:border-white/30 transition-colors">Cerrar sesión</button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={onSave} className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm opacity-90">Email</label>
                  <input name="email_user" value={form.email_user} onChange={onChange} type="email" className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm opacity-90">Nombre</label>
                    <input name="name_user" value={form.name_user} onChange={onChange} className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur" required />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm opacity-90">Apellido</label>
                    <input name="surname_user" value={form.surname_user} onChange={onChange} className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur" required />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-sm opacity-90">Teléfono</label>
                  <input name="phone" value={form.phone} onChange={onChange} className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur" required />
                </div>

                {message && <div className="text-sm opacity-90">{message}</div>}
                <div className="flex items-center gap-4 pt-2">
                  <button disabled={saving} type="submit" className="rounded-lg px-4 py-3 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-4 py-3 border border-white/20 hover:border-white/30 transition-colors">Cancelar</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
