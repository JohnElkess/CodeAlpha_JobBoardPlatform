const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // not configured, so fall back to console output

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // never let a slow SMTP server hang a listener forever
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[MAIL:console] to: ${to}\nsubject: ${subject}\n${text}\n`);
    return;
  }
  const info = await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text, // plain-text fallback for clients that don't render HTML
    html,
  });
  console.log(`[MAIL] sent to ${to} (${info.messageId})`);
}

// Called once at startup so credential problems show up immediately
async function verifyMail() {
  const t = getTransporter();
  if (!t) return console.log('[MAIL] SMTP not configured, emails will be logged to the console');
  try {
    await t.verify();
    console.log('[MAIL] SMTP connection verified');
  } catch (err) {
    console.error('[MAIL] SMTP verification failed:', err.message);
  }
}

module.exports = { sendMail, verifyMail };