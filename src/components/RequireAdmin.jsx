import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RequireAdmin({ children }) {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let timeoutId = null

    const checkAccess = async () => {
      try {
        // Timeout de seguridad
        timeoutId = setTimeout(() => {
          if (mounted && loading) {
            console.warn('Admin check timeout, redirecting')
            setLoading(false)
            setSession(null)
          }
        }, 5000) // 5 segundos para admin (necesita verificar rol)

        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return

        if (error || !data?.session) {
          setSession(null)
          setLoading(false)
          if (timeoutId) clearTimeout(timeoutId)
          return
        }

        setSession(data.session)

        // Verificar el rol del usuario
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
        console.error('Admin check failed:', err)
        if (!mounted) return
        setSession(null)
        setUserRole(null)
        setLoading(false)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    checkAccess()

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

  // Si está cargando, no mostrar nada
  if (loading) return null

  // Si no hay sesión, redirigir al login
  if (!session) return <Navigate to="/login" replace />

  // Si el rol no es administrador, redirigir a login
  if (userRole !== 'administrador') {
    return <Navigate to="/login" replace />
  }

  // Si es administrador, mostrar el contenido
  return children
}
