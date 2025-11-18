import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import nodemailer from 'nodemailer'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

let transporter;

async function setupTransporter() {
  if (process.env.USE_ETHEREAL === 'true') {
    console.log('⚠️  Usando Ethereal (modo prueba) - Los emails no se enviarán realmente')
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    })
    console.log('✅ Ethereal configurado para pruebas')
  } else {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('\n❌ ERROR: Falta configurar GMAIL_USER o GMAIL_APP_PASSWORD en el .env')
      console.error('📖 Lee NODEMAILER_SETUP.md para instrucciones completas\n')
      console.error('💡 O agregá USE_ETHEREAL=true al .env para usar modo prueba\n')
      process.exit(1)
    }
    
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })
    
    try {
      await transporter.verify()
      console.log('✅ Nodemailer listo para enviar emails con Gmail')
    } catch (error) {
      console.error('\n❌ Error en configuración de Gmail:', error.message)
      console.error('\n📋 Verificá:')
      console.error('   1. Que GMAIL_USER sea tu email completo')
      console.error('   2. Que GMAIL_APP_PASSWORD sea el App Password (no tu contraseña normal)')
      console.error('   3. Que tengas verificación en 2 pasos activada en Gmail')
      console.error('   4. Que el App Password no tenga espacios\n')
      console.error('\n📖 Instrucciones completas en: NODEMAILER_SETUP.md\n')
      process.exit(1)
    }
  }
}

await setupTransporter()

app.post('/api/send-consultation', async (req, res) => {
  try {
    const { from, name, subject, message } = req.body

    if (!from || !subject || !message) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.HOTEL_EMAIL || process.env.GMAIL_USER,
      replyTo: from,
      subject: `[Consulta Web] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            Nueva Consulta desde el Sitio Web
          </h2>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>De:</strong> ${name || 'Anónimo'}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${from}</p>
            <p style="margin: 10px 0;"><strong>Asunto:</strong> ${subject}</p>
          </div>
          
          <div style="background-color: #fff; padding: 20px; border-left: 4px solid #4CAF50; margin: 20px 0;">
            <h3 style="color: #555; margin-top: 0;">Mensaje:</h3>
            <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
            <p>Para responder, puedes hacerlo directamente desde el panel de administración o respondiendo a este email.</p>
          </div>
        </div>
      `
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Email enviado al hotel:', info.messageId)

    res.json({
      success: true,
      messageId: info.messageId,
      message: 'Email enviado exitosamente'
    })
  } catch (error) {
    console.error('❌ Error al enviar email:', error)
    res.status(500).json({
      error: 'Error al enviar email',
      details: error.message
    })
  }
})

app.post('/api/send-response', async (req, res) => {
  try {
    const { to, userName, subject, adminResponse } = req.body

    if (!to || !subject || !adminResponse) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: to,
      subject: `Re: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">Gace Hotel Cafayate</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Respuesta a tu consulta</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px;">
            <p style="color: #333; font-size: 16px;">Hola ${userName || 'estimado/a'},</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <p style="color: #666; line-height: 1.6; white-space: pre-wrap; margin: 0;">${adminResponse}</p>
            </div>
            
            <p style="color: #666; margin-top: 30px;">
              Si tenés más consultas, no dudes en contactarnos nuevamente.
            </p>
            
            <p style="color: #666; margin-top: 20px;">
              Saludos,<br>
              <strong>Equipo Gace Hotel Cafayate</strong>
            </p>
          </div>
          
          <div style="background-color: #333; color: #999; padding: 20px; border-radius: 0 0 5px 5px; font-size: 12px; text-align: center;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Gace Hotel Cafayate. Todos los derechos reservados.</p>
          </div>
        </div>
      `
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Respuesta enviada al usuario:', info.messageId)

    res.json({
      success: true,
      messageId: info.messageId,
      message: 'Respuesta enviada exitosamente'
    })
  } catch (error) {
    console.error('❌ Error al enviar respuesta:', error)
    res.status(500).json({
      error: 'Error al enviar respuesta',
      details: error.message
    })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Email server is running' })
})

app.listen(PORT, () => {
  console.log(`🚀 Email server running on http://localhost:${PORT}`)
})
