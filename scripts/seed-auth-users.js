// Usage:
//   Windows (PowerShell):
//     $env:SUPABASE_URL='https://<PROJECT>.supabase.co'; $env:SUPABASE_SERVICE_ROLE_KEY='<SERVICE_KEY>'; node scripts/seed-auth-users.js
//   Mac/Linux:
//     SUPABASE_URL='https://<PROJECT>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<SERVICE_KEY>' node scripts/seed-auth-users.js
//
// Notes:
// - Uses Service Role Key (server-side only). Do NOT expose it in the browser/app.
// - Creates users in Auth and their profile rows in public.users with rol field.
// - Adjust the users array to your needs. rol can be: 'usuario', 'operario', 'administrador'

const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const sb = createClient(url, serviceKey)

// Generate 20 users with different roles
const users = Array.from({ length: 20 }).map((_, i) => {
  const n = (i + 1).toString().padStart(2, '0')
  // First 2 are admins, next 3 are operarios, rest are usuarios
  let rol = 'usuario'
  if (i < 2) rol = 'administrador'
  else if (i < 5) rol = 'operario'
  
  return {
    email: `demo${n}@example.com`,
    password: 'Test1234!',
    name: 'Demo',
    surname: n,
    phone: `381-555-00${n}`,
    rol: rol
  }
})

async function main () {
  let ok = 0
  for (const u of users) {
    try {
      // Crear usuario en auth - el trigger creará automáticamente el registro en users
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { 
          nombre: u.name,
          apellido: u.surname,
          telefono: u.phone
        }
      })
      if (error) throw error
      const uid = data.user.id
      
      // Actualizar el rol si no es 'usuario' (el trigger crea con rol 'usuario' por defecto)
      if (u.rol !== 'usuario') {
        const { error: updateErr } = await sb.from('users')
          .update({ rol: u.rol })
          .eq('id_user', uid)
        if (updateErr) throw updateErr
      }
      
      ok++
      console.log('OK', u.email, `(${u.rol})`)
    } catch (e) {
      console.error('ERR', u.email, e.message)
    }
  }
  console.log(`Done. Created ${ok}/${users.length} users.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
