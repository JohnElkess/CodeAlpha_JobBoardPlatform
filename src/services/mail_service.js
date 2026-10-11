async function sendMail({ to, subject, text }) {
  console.log(`\n[MAIL] to: ${to}\n[MAIL] subject: ${subject}\n[MAIL] body:\n${text}\n`);
}

module.exports = { sendMail };