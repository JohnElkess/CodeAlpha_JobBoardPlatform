const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/app');
const User = require('../../src/models/User');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/resumes');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let counter = 0;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Registers through the real API, so tests exercise the same path as a client
async function createUser(role, overrides = {}) {
  counter += 1;
  const body = {
    email: `${role.toLowerCase()}${counter}@test.com`,
    password: 'secret123',
    role,
    profile: { name: `${role} ${counter}` },
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  return { id: res.body.user._id, token: res.body.token, email: body.email, password: body.password };
}

const jobBody = (overrides = {}) => ({
  title: 'Backend Engineer',
  description: 'Build Node.js APIs',
  location: 'Cairo',
  jobType: 'FULL_TIME',
  salaryRange: { min: 15000, max: 25000 },
  ...overrides,
});

async function createJob(token, overrides) {
  const res = await request(app).post('/api/jobs').set(auth(token)).send(jobBody(overrides));
  return res.body;
}

function apply(token, jobId, file = {}) {
  return request(app)
    .post(`/api/jobs/${jobId}/apply`)
    .set(auth(token))
    .attach('resume', Buffer.from('%PDF-1.4 test resume'), {
      filename: 'cv.pdf',
      contentType: 'application/pdf',
      ...file,
    });
}

async function createAdmin() {
  counter += 1;
  const email = `admin${counter}@test.com`;
  const user = await User.create({ email, password: 'secret123', role: 'ADMIN', profile: { name: 'Admin' } });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return { id: user._id.toString(), token: res.body.token, email };
}

const listUploads = () => fs.readdirSync(UPLOAD_DIR).filter((f) => f !== '.gitkeep');

// Remove only files created during the run, never your own manual test uploads
function cleanupUploads(before) {
  for (const f of listUploads()) {
    if (!before.includes(f)) fs.unlinkSync(path.join(UPLOAD_DIR, f));
  }
}

module.exports = { auth, createUser, createJob, jobBody, apply, listUploads, cleanupUploads, createAdmin };