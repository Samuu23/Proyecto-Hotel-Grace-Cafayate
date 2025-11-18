import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Hero from '../components/Hero'
import Location from '../components/Location'
import ServicesFixed from '../components/ServicesFixed'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const navigate = useNavigate()
  const s1Ref = useRef(null)
  const s2Ref = useRef(null)
  const s3Ref = useRef(null)
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: userData } = await supabase
          .from('users')
          .select('rol')
          .eq('id_user', session.user.id)
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

    checkUserRole()
  }, [navigate])

  useEffect(() => {
    const root = document.querySelector('#scroller') || null
    const opts = { root, threshold: 0.2 }
    const handler = (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
        } else {
          e.target.classList.remove('is-visible')
        }
      })
    }
    const io = new IntersectionObserver(handler, opts)
    ;[s1Ref.current, s2Ref.current, s3Ref.current].forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <main id="scroller" className="overflow-y-auto h-screen" style={{ scrollBehavior: 'smooth' }}>
      <section ref={s1Ref} className="relative h-screen section-fade">
        <Hero />
      </section>
      <section ref={s2Ref} className="relative h-screen pt-16 bg-[#111] overflow-hidden section-fade">
        <ServicesFixed />
      </section>
      <section ref={s3Ref} className="h-screen pt-16 bg-[#0f0f0f] section-fade">
        <Location />
      </section>
    </main>
  )
}
