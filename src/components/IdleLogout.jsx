import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function IdleLogout({ timeoutMs = 5 * 60 * 1000 }) {
  const navigate = useNavigate()
  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startTimer = () => {
    clearTimer()
    timerRef.current = setTimeout(async () => {
      try {
        try { localStorage.setItem('idleLogout', '1') } catch (e) { /* noop */ }
        await supabase.auth.signOut()
      } catch (e) {
        /* noop */
      } finally {
        navigate('/login')
      }
    }, timeoutMs)
  }

  useEffect(() => {
    const reset = () => startTimer()

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange']
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))

    // arranca el temporizador al montar
    startTimer()

    return () => {
      clearTimer()
      events.forEach((ev) => window.removeEventListener(ev, reset))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs])

  return null
}
