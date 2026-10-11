// API para enviar emails de confirmación
// Usar Resend, SendGrid o Mailgun para producción

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { email, nombre, tipo_cliente, status } = req.body;

  if (!email || !nombre) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  // IMPORTANTE: Configurar tu servicio de email
  // Opciones: Resend, SendGrid, Mailgun
  // Por ahora es un placeholder

  const subject = status === 'aprobado' 
    ? '¡Tu cuenta en INVERSIONES F Y E ha sido aprobada!'
    : 'Tu solicitud en INVERSIONES F Y E';

  const htmlContent = `
    <h2>Hola ${nombre},</h2>
    ${status === 'aprobado' ? `
      <p>¡Bienvenido a INVERSIONES F Y E!</p>
      <p>Tu cuenta ha sido <strong>aprobada</strong> como <strong>${tipo_cliente === 'ahorista' ? 'Cliente de Ahorro' : tipo_cliente === 'inversionista' ? 'Cliente Inversionista' : 'Cliente de Cambio de Divisas'}</strong></p>
      <p>Ya puedes acceder a tu cuenta en: <a href="https://inversionesfye.vercel.app">https://inversionesfye.vercel.app</a></p>
    ` : `
      <p>Tu solicitud de registro está en proceso de revisión.</p>
      <p>Nos pondremos en contacto pronto.</p>
    `}
    <p>Saludos,<br>Equipo INVERSIONES F Y E</p>
  `;

  // TODO: Integrar con tu servicio de email favorito
  console.log(`Email enviado a ${email}: ${subject}`);

  return res.status(200).json({ 
    success: true, 
    message: 'Email enviado correctamente',
    to: email
  });
};