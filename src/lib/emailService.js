const EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001'

export const sendEmailToHotel = async ({ from, name, subject, message }) => {
  try {
    console.log('Enviando email al hotel via Nodemailer...', { from })
    
    const response = await fetch(`${EMAIL_SERVER_URL}/api/send-consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, name, subject, message })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Email server error:', error)
      throw new Error(error.error || 'Error al enviar email')
    }

    const result = await response.json()
    console.log('Email enviado exitosamente:', result)
    return result
  } catch (error) {
    console.error('Error sending email to hotel:', error)
    throw error
  }
}

export const sendEmailToUser = async ({ to, userName, subject, adminResponse }) => {
  try {
    console.log('Enviando respuesta al usuario via Nodemailer...', { to })
    
    const response = await fetch(`${EMAIL_SERVER_URL}/api/send-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, userName, subject, adminResponse })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Email server error:', error)
      throw new Error(error.error || 'Error al enviar email')
    }

    const result = await response.json()
    console.log('Email al usuario enviado exitosamente:', result)
    return result
  } catch (error) {
    console.error('Error sending email to user:', error)
    throw error
  }
}
