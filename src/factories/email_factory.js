const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS_TEXT = {
  IN_REVIEW: 'is now being reviewed',
  ACCEPTED: 'has been accepted',
  REJECTED: 'was not selected this time',
};

const templates = {
  APPLICATION_RECEIVED: ({ employerName, candidateName, jobTitle }) => ({
    subject: `New application for ${jobTitle}`,
    text: `Hi ${employerName},\n\n${candidateName} has applied to "${jobTitle}". Log in to review the application.`,
    html: `<p>Hi ${escapeHtml(employerName)},</p><p><b>${escapeHtml(candidateName)}</b> has applied to <b>${escapeHtml(jobTitle)}</b>. Log in to review the application.</p>`,
  }),

  STATUS_UPDATED: ({ candidateName, jobTitle, status }) => {
    const phrase = STATUS_TEXT[status] || `was updated to ${status}`;
    return {
      subject: `Update on your application: ${jobTitle}`,
      text: `Hi ${candidateName},\n\nYour application for "${jobTitle}" ${phrase}.`,
      html: `<p>Hi ${escapeHtml(candidateName)},</p><p>Your application for <b>${escapeHtml(jobTitle)}</b> ${phrase}.</p>`,
    };
  },
};

function createEmail(type, data) {
  const template = templates[type];
  if (!template) throw new Error(`Unknown email type: ${type}`);
  return template(data);
}

module.exports = { createEmail };