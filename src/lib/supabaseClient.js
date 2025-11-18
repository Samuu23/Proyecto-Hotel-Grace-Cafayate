import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    },
  })
} else {
  console.warn('[Supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no configurados. Funciones de auth deshabilitadas en desarrollo.')
  supabase = {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null }
      },
      onAuthStateChange(cb) {
        return { data: { subscription: { unsubscribe() {} } }, error: null }
      },
      async signInWithPassword() {
        return { data: null, error: new Error('Supabase no configurado') }
      },
      async signUp() {
        return { data: null, error: new Error('Supabase no configurado') }
      },
      async resend() {
        return { data: null, error: new Error('Supabase no configurado') }
      },
      async signOut() {
        return { error: null }
      },
    },
  }
}

if (typeof window !== 'undefined') {
  window.supabase = supabase
}

export { supabase }

