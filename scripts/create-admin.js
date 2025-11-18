// Script para crear un usuario administrador usando Supabase Admin API
// 
// Usage:
//   Windows (PowerShell):
//     $env:SUPABASE_URL='https://<PROJECT>.supabase.co'; $env:SUPABASE_SERVICE_ROLE_KEY='<SERVICE_KEY>'; node scripts/create-admin.js
//   Mac/Linux:
//     SUPABASE_URL='https://<PROJECT>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<SERVICE_KEY>' node scripts/create-admin.js
//
// IMPORTANTE: Usa el Service Role Key, NO el anon key

const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno')
  console.error('\nEjemplo de uso (Windows PowerShell):')
  console.error('  $env:SUPABASE_URL="https://tu-proyecto.supabase.co"')
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"')
  console.error('  node scripts/create-admin.js')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdmin() {
  console.log('🔧 Creando usuario administrador...\n')

  const adminData = {
    email: 'lovago226@gmail.com',
    password: 'admin123',
    name: 'Admin',
    surname: 'Sistema',
    phone: '381-000-0000'
  }

  try {
    // 1. Crear usuario en Auth
    console.log(`📧 Email: ${adminData.email}`)
    console.log(`🔑 Contraseña: ${adminData.password}`)
    console.log('\n⏳ Creando usuario en Auth...')
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminData.email,
      password: adminData.password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        nombre: adminData.name,
        apellido: adminData.surname,
        telefono: adminData.phone
      }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.error('❌ Este email ya está registrado.')
        console.log('\n💡 Si querés actualizar el rol, ejecutá este SQL:')
        console.log(`UPDATE public.users SET rol = 'administrador' WHERE email_user = '${adminData.email}';`)
      } else {
        throw authError
      }
      process.exit(1)
    }

    const userId = authData.user.id
    console.log(`✅ Usuario creado en Auth (ID: ${userId})`)

    // 2. Esperar un momento para que el trigger cree el registro en users
    console.log('⏳ Esperando que el trigger cree el registro...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Actualizar el rol a administrador
    console.log('⏳ Actualizando rol a administrador...')
    const { error: updateError } = await supabase
      .from('users')
      .update({ rol: 'administrador' })
      .eq('id_user', userId)

    if (updateError) throw updateError

    console.log('✅ Rol actualizado a administrador')

    // 4. Verificar que todo esté bien
    console.log('\n⏳ Verificando...')
    const { data: userData, error: verifyError } = await supabase
      .from('users')
      .select('id_user, email_user, name_user, surname_user, rol')
      .eq('id_user', userId)
      .single()

    if (verifyError) throw verifyError

    console.log('\n✅ ¡Usuario administrador creado exitosamente!')
    console.log('\n📋 Datos del usuario:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`ID:        ${userData.id_user}`)
    console.log(`Email:     ${userData.email_user}`)
    console.log(`Nombre:    ${userData.name_user} ${userData.surname_user}`)
    console.log(`Rol:       ${userData.rol}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n🔐 Credenciales de acceso:')
    console.log(`   Email:     ${adminData.email}`)
    console.log(`   Contraseña: ${adminData.password}`)
    console.log('\n🌐 Accedé en: http://localhost:5173/login')
    console.log('   (Serás redirigido a /admin automáticamente)')

  } catch (error) {
    console.error('\n❌ Error al crear administrador:')
    console.error(error.message)
    console.error('\nDetalles:', error)
    process.exit(1)
  }
}

createAdmin()
