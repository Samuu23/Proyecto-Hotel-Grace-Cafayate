import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import bgS3 from '../assets/bg-s3.jpg'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [idleBanner, setIdleBanner] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const flag = localStorage.getItem('idleLogout')
      if (flag === '1') {
        setIdleBanner(true)
        localStorage.removeItem('idleLogout')
      }
    } catch (e) { /* noop */ }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      
      const userId = data?.user?.id
      if (!userId) throw new Error('No se pudo obtener información del usuario')
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('rol')
        .eq('id_user', userId)
        .single()
      
      if (userError) {
        console.error('Error al obtener rol:', userError)
        throw new Error('Error al verificar permisos')
      }
      
      let targetRoute = '/reservas'
      
      if (userData?.rol) {
        const rol = userData.rol
        console.log('Rol detectado:', rol)
        if (rol === 'administrador') {
          targetRoute = '/admin'
        } else if (rol === 'operario') {
          targetRoute = '/operadores'
        }
      }
      
      console.log('Redirigiendo a:', targetRoute)
      navigate(targetRoute, { replace: true })
      
    } catch (err) {
      console.error('Error en login:', err)
      setError(err.message || 'No se pudo iniciar sesión')
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

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <h1 className="display text-4xl md:text-5xl font-semibold tracking-tight">Ingresar</h1>
          <p className="mt-2 text-muted">Accedé a tu cuenta</p>
        </div>

        {/* Confirmación por email desactivada: sin banner */}

        {idleBanner && (
          <div className="mb-4 rounded-lg border border-blue-400/40 bg-blue-500/20 px-4 py-3 text-sm">
            Tu sesión se cerró por inactividad.
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setIdleBanner(false)} className="rounded-md border border-white/20 px-3 py-1 text-sm hover:border-white/30">Continuar</button>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm opacity-90">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="tu@email.com"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm opacity-90">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 outline-none focus:border-white/40 backdrop-blur placeholder-white/60"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="text-sm text-red-300">{error}</div>}
          <button disabled={loading} type="submit" className="w-full rounded-lg px-4 py-3 bg-white/90 text-black font-medium hover:bg-white transition disabled:opacity-60">
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/register" className="underline hover:opacity-80">¿No tenés cuenta? Registrate</Link>
        </div>
      </div>
    </div>
  )
}
