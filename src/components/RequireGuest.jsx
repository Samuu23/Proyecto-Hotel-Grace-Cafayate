import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RequireGuest({ children, redirectTo = '/account' }) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data?.session) {
        // Verificar rol y redirigir según corresponda
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('rol')
            .eq('id_user', data.session.user.id)
            .single()

          let targetRoute = redirectTo
          if (userData?.rol === 'operario') {
            targetRoute = '/operadores'
          } else if (userData?.rol === 'administrador') {
            targetRoute = '/admin'
          }

          setAllowed(false)
          setLoading(false)
          navigate(targetRoute, { replace: true })
        } catch (err) {
          console.error('Error checking user role:', err)
          setAllowed(false)
          setLoading(false)
          navigate(redirectTo, { replace: true })
        }
      } else {
        setAllowed(true)
        setLoading(false)
      }
    })()
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, sess) => {
      if (sess) {
        // Verificar rol y redirigir según corresponda
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('rol')
            .eq('id_user', sess.user.id)
            .single()

          let targetRoute = redirectTo
          if (userData?.rol === 'operario') {
            targetRoute = '/operadores'
          } else if (userData?.rol === 'administrador') {
            targetRoute = '/admin'
          }

          setAllowed(false)
          navigate(targetRoute, { replace: true })
        } catch (err) {
          console.error('Error checking user role:', err)
          setAllowed(false)
          navigate(redirectTo, { replace: true })
        }
      } else {
        setAllowed(true)
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [navigate, redirectTo])

  if (loading) return null
  if (!allowed) return null
  return children
}
