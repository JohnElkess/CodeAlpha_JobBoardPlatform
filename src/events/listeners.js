const { events, EVENTS } = require('./emitter');
const Application = require('../models/Application');
const { createEmail } = require('../factories/email_factory');
const { sendMail } = require('../services/mail_service');

function loadApplication(id) {
  return Application.findById(id)
    .populate({
      path: 'job',
      select: 'title employer',
      populate: { path: 'employer', select: 'email profile.name' },
    })
    .populate('candidate', 'email profile.name');
}

// An async listener that throws becomes an unhandled promise rejection, which can crash Node.
// So every listener is wrapped: failures are logged, never propagated.
const safe = (name, fn) => async (payload) => {
  try {
    await fn(payload);
  } catch (err) {
    console.error(`[events] ${name} listener failed:`, err.message);
  }
};

events.on(
  EVENTS.APPLICATION_CREATED,
  safe(EVENTS.APPLICATION_CREATED, async ({ applicationId }) => {
    const app = await loadApplication(applicationId);
    if (!app) return;
    const { subject, text, html } = createEmail('APPLICATION_RECEIVED', {
      employerName: app.job.employer.profile.name,
      candidateName: app.candidate.profile.name,
      jobTitle: app.job.title,
    });
    await sendMail({ to: app.job.employer.email, subject, text, html });
  })
);

events.on(
  EVENTS.APPLICATION_STATUS_CHANGED,
  safe(EVENTS.APPLICATION_STATUS_CHANGED, async ({ applicationId }) => {
    const app = await loadApplication(applicationId);
    if (!app) return;
    const { subject, text, html } = createEmail('STATUS_UPDATED', {
      candidateName: app.candidate.profile.name,
      jobTitle: app.job.title,
      status: app.status,
    });
    await sendMail({ to: app.candidate.email, subject, text, html });
  })
);