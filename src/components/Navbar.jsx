import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const [atTop, setAtTop] = useState(true)
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const scroller = document.querySelector('#scroller') || window
    const handler = () => {
      const y = scroller === window ? window.scrollY : scroller.scrollTop
      setAtTop(y <= 0)
    }
    handler()
    scroller.addEventListener('scroll', handler, { passive: true })
    return () => scroller.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <nav
      className={
        "fixed inset-x-0 top-0 z-50 h-28 flex items-center justify-between px-12 bg-transparent transition-transform duration-300 ease-out " +
        (atTop ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none")
      }
    >
      <Link to="/" className="text-xl tracking-wide font-semibold hover:opacity-90">Gace Hotel Cafayate</Link>
      <div className="flex items-center gap-6">
        {session && (
          <Link to="/reservas" className="h-12 px-7 rounded-full border border-white/20 hover:border-white/30 transition-colors flex items-center">
            Mis reservas
          </Link>
        )}
        <Link to="/contacto" className="h-12 px-7 rounded-full border border-white/20 hover:border-white/30 transition-colors flex items-center">Contacto</Link>
        <Link to={session ? "/account" : "/login"} className="h-12 px-7 rounded-full border border-white/20 hover:border-white/30 transition-colors flex items-center">Mi cuenta</Link>
        {session && (
          <button
            onClick={async () => {
              try {
                await supabase.auth.signOut()
                // Limpiar cualquier dato de sesión en localStorage
                for (let i = localStorage.length - 1; i >= 0; i--) {
                  const key = localStorage.key(i)
                  if (key && key.startsWith('sb-')) {
                    localStorage.removeItem(key)
                  }
                }
                navigate('/', { replace: true })
              } catch (error) {
                console.error('Error al cerrar sesión:', error)
                // Intentar navegar de todos modos
                navigate('/', { replace: true })
              }
            }}
            className="h-12 px-7 rounded-full border border-white/20 hover:border-white/30 transition-colors"
          >
            Cerrar sesión
          </button>
        )}
        <Link to="/habitaciones" className="h-12 px-7 rounded-full bg-fg text-black font-medium flex items-center">Reservar</Link>
      </div>
    </nav>
  )
}
