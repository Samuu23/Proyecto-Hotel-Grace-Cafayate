import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import bgS3 from '../assets/bg-s3.jpg'
import { supabase } from '../lib/supabaseClient'

export default function Register() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Crear usuario en Supabase Auth
      // El trigger de base de datos creará automáticamente el registro en la tabla users
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nombre: form.nombre,
            apellido: form.apellido,
            telefono: form.telefono,
          },
        },
      })
      if (signUpError) throw signUpError

      // El registro en la tabla users se crea automáticamente via trigger
      // Redirigir al login tras crear la cuenta
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center"
      style={{
        backgroundImage: `url(${bgS3})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 hero-overlay" />

      <div className="relative z-10 w-full max-w-xl px-6">
        <div className="mb-8 text-center">
          <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight">Crear cuenta</h1>
          <p className="mt-2 text-muted">Completá tus datos para registrarte</p>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm opacity-90">Nombre</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="Tu nombre"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm opacity-90">Apellido</label>
            <input
              name="apellido"
              value={form.apellido}
              onChange={onChange}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="Tu apellido"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block mb-1 text-sm opacity-90">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="tu@email.com"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm opacity-90">Contraseña</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm opacity-90">Teléfono</label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={onChange}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="Ej: +54 9 381 123 4567"
              required
            />
          </div>

          {error && (
            <div className="md:col-span-2 text-sm text-red-300">{error}</div>
          )}
          <div className="md:col-span-2 mt-2">
            <button disabled={loading} type="submit" className="w-full rounded-lg px-4 py-3 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">
              {loading ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm">
          <a href="/login" className="underline hover:opacity-80">¿Ya tenés cuenta? Ingresá</a>
        </div>
      </div>
    </div>
  )
}
