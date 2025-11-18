import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RequireAuth({ children }) {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let timeoutId = null
    
    // Timeout de seguridad: si tarda más de 3 segundos, redirigir
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth check timeout, redirecting to login')
        setLoading(false)
        setSession(null)
      }
    }, 3000)
    
    // Verificar sesión y rol
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return
        
        if (error || !data?.session) {
          console.error('Error getting session:', error)
          setSession(null)
          setUserRole(null)
          setLoading(false)
          if (timeoutId) clearTimeout(timeoutId)
          return
        }
        
        setSession(data.session)
        
        // Obtener rol del usuario
        const { data: userData, error: roleError } = await supabase
          .from('users')
          .select('rol')
          .eq('id_user', data.session.user.id)
          .single()
        
        if (!mounted) return
        
        if (roleError || !userData) {
          console.error('Error al verificar rol:', roleError)
          setUserRole('usuario')
        } else {
          setUserRole(userData.rol || 'usuario')
        }
        
        setLoading(false)
        if (timeoutId) clearTimeout(timeoutId)
      } catch (err) {
        console.error('Session check failed:', err)
        if (!mounted) return
        setSession(null)
        setUserRole(null)
        setLoading(false)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }
    
    checkSession()

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      
      if (!session) {
        setSession(null)
        setUserRole(null)
        setLoading(false)
      } else {
        setSession(session)
        
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('rol')
            .eq('id_user', session.user.id)
            .single()
          
          if (!mounted) return
          setUserRole(userData?.rol || 'usuario')
        } catch (err) {
          console.error('Error loading user role:', err)
          if (!mounted) return
          setUserRole('usuario')
        }
      }
    })

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  // Mientras carga, redirigir directamente si no hay sesión en caché
  if (loading) {
    // Intentar leer sesión del localStorage de forma síncrona
    // Buscar cualquier token de Supabase (formato: sb-*-auth-token)
    let hasSession = false
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          hasSession = true
          break
        }
      }
    } catch (e) {
      // Si falla, no redirigir aún
      hasSession = true
    }
    
    if (!hasSession) {
      return <Navigate to="/login" replace />
    }
    // Si hay token, mostrar nada mientras verifica
    return null
  }

  // Si no hay sesión, redirigir al login
  if (!session) return <Navigate to="/login" replace />

  // Si es administrador, redirigir a /admin
  if (userRole === 'administrador') {
    return <Navigate to="/admin" replace />
  }

  // Si es operario, redirigir a /operadores
  if (userRole === 'operario') {
    return <Navigate to="/operadores" replace />
  }

  // Si es usuario regular, mostrar el contenido
  return children
}
