import nodemailer from 'nodemailer';

// Para que los avisos lleguen a la bandeja de entrada y no a spam:
// - Lo más efectivo es enviar desde una cuenta del dominio de la empresa
//   (p. ej. Microsoft 365: SMTP_HOST=smtp.office365.com, SMTP_PORT=587) o que
//   sistemas agregue el remitente a la lista de permitidos del correo corporativo.
// - Desde aquí: documento HTML completo + versión de texto, remitente con nombre,
//   Reply-To a una persona real (SMTP_REPLY_TO) y sin ligas ni imágenes externas.

let transporter;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

function documentoHtml(cuerpo, titulo) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
</head>
<body style="margin:0; padding:16px; background:#ffffff;">
${cuerpo}
</body>
</html>`;
}

export function sendMail({ to, subject, html, text }) {
  const fromName = process.env.SMTP_FROM_NAME || 'SST';
  const titulo = String(subject).replace(/[<>&"]/g, '');
  return getTransporter().sendMail({
    from: { name: fromName, address: process.env.SMTP_USER },
    replyTo: process.env.SMTP_REPLY_TO || undefined,
    to,
    subject,
    html: documentoHtml(html, titulo),
    text
  });
}
