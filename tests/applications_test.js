const request = require('supertest');
const app = require('../src/app');
const db = require('./helpers/db');
const { events, EVENTS } = require('../src/events/emitter');
const { auth, createUser, createJob, apply, listUploads, cleanupUploads } = require('./helpers/factories');

const uploadsBefore = [];

beforeAll(async () => {
  uploadsBefore.push(...listUploads());
  await db.connect();
});
afterEach(db.clear);
afterAll(async () => {
  cleanupUploads(uploadsBefore);
  await db.disconnect();
});

async function scenario() {
  const employer = await createUser('EMPLOYER');
  const candidate = await createUser('CANDIDATE');
  const job = await createJob(employer.token);
  return { employer, candidate, job };
}

const setStatus = (token, id, status) =>
  request(app).patch(`/api/applications/${id}/status`).set(auth(token)).send({ status });

describe('applying to a job', () => {
  test('a candidate can apply with a PDF; the application starts as APPLIED with history', async () => {
    const { candidate, job } = await scenario();
    const res = await apply(candidate.token, job._id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('APPLIED');
    expect(res.body.statusHistory.map((h) => h.status)).toEqual(['APPLIED']);
    expect(res.body.resumePath).toMatch(/^uploads\/resumes\//);
  });

  test('a duplicate application is rejected with 409 and leaves no orphan file', async () => {
    const { candidate, job } = await scenario();
    await apply(candidate.token, job._id);
    const filesAfterFirst = listUploads().length;

    const res = await apply(candidate.token, job._id);
    expect(res.status).toBe(409);
    expect(listUploads().length).toBe(filesAfterFirst);
  });

  test('a closed job rejects applications with 400 and leaves no orphan file', async () => {
    const { employer, candidate, job } = await scenario();
    await request(app).patch(`/api/jobs/${job._id}`).set(auth(employer.token)).send({ status: 'CLOSED' });
    const filesBefore = listUploads().length;

    const res = await apply(candidate.token, job._id);
    expect(res.status).toBe(400);
    expect(listUploads().length).toBe(filesBefore);
  });

  test('401 without a token, 403 for an employer, 404 for an unknown job', async () => {
    const { employer, candidate, job } = await scenario();
    expect((await request(app).post(`/api/jobs/${job._id}/apply`)).status).toBe(401);
    expect((await apply(employer.token, job._id)).status).toBe(403);
    expect((await apply(candidate.token, '507f1f77bcf86cd799439011')).status).toBe(404);
  });

  test('400 when no file is attached', async () => {
    const { candidate, job } = await scenario();
    const res = await request(app).post(`/api/jobs/${job._id}/apply`).set(auth(candidate.token));
    expect(res.status).toBe(400);
  });

  test('400 for a disallowed file type', async () => {
    const { candidate, job } = await scenario();
    const res = await apply(candidate.token, job._id, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  test('400 for a file over 5 MB', async () => {
    const { candidate, job } = await scenario();
    const res = await request(app)
      .post(`/api/jobs/${job._id}/apply`)
      .set(auth(candidate.token))
      .attach('resume', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });
});

describe('viewing applications', () => {
  test('a candidate sees only their own applications', async () => {
    const { candidate, job } = await scenario();
    const other = await createUser('CANDIDATE');
    await apply(candidate.token, job._id);

    expect((await request(app).get('/api/applications/my').set(auth(candidate.token))).body).toHaveLength(1);
    expect((await request(app).get('/api/applications/my').set(auth(other.token))).body).toHaveLength(0);
  });

  test('only the job owner can list applicants', async () => {
    const { employer, candidate, job } = await scenario();
    const otherEmployer = await createUser('EMPLOYER');
    await apply(candidate.token, job._id);

    const own = await request(app).get(`/api/jobs/${job._id}/applications`).set(auth(employer.token));
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].candidate.password).toBeUndefined();

    expect((await request(app).get(`/api/jobs/${job._id}/applications`).set(auth(otherEmployer.token))).status).toBe(403);
    expect((await request(app).get(`/api/jobs/${job._id}/applications`).set(auth(candidate.token))).status).toBe(403);
  });
});

describe('status updates and history', () => {
  test('the job owner updates the status and history grows; repeating it adds nothing', async () => {
    const { employer, candidate, job } = await scenario();
    const app1 = (await apply(candidate.token, job._id)).body;

    const res = await setStatus(employer.token, app1._id, 'IN_REVIEW');
    expect(res.status).toBe(200);
    expect(res.body.statusHistory.map((h) => h.status)).toEqual(['APPLIED', 'IN_REVIEW']);

    const again = await setStatus(employer.token, app1._id, 'IN_REVIEW');
    expect(again.status).toBe(200);
    expect(again.body.statusHistory).toHaveLength(2);
  });

  test('another employer gets 403, a candidate gets 403, bad statuses get 400', async () => {
    const { employer, candidate, job } = await scenario();
    const other = await createUser('EMPLOYER');
    const created = (await apply(candidate.token, job._id)).body;

    expect((await setStatus(other.token, created._id, 'ACCEPTED')).status).toBe(403);
    expect((await setStatus(candidate.token, created._id, 'ACCEPTED')).status).toBe(403);
    expect((await setStatus(employer.token, created._id, 'APPLIED')).status).toBe(400);
    expect((await setStatus(employer.token, created._id, 'WITHDRAWN')).status).toBe(400);
    expect((await setStatus(employer.token, '507f1f77bcf86cd799439011', 'ACCEPTED')).status).toBe(404);
  });
});

describe('withdrawing', () => {
  test('a candidate can withdraw; history records it; the employer can no longer change it', async () => {
    const { employer, candidate, job } = await scenario();
    const created = (await apply(candidate.token, job._id)).body;
    await setStatus(employer.token, created._id, 'IN_REVIEW');

    const res = await request(app).patch(`/api/applications/${created._id}/withdraw`).set(auth(candidate.token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WITHDRAWN');
    expect(res.body.statusHistory.map((h) => h.status)).toEqual(['APPLIED', 'IN_REVIEW', 'WITHDRAWN']);

    expect((await request(app).patch(`/api/applications/${created._id}/withdraw`).set(auth(candidate.token))).status).toBe(409);
    expect((await setStatus(employer.token, created._id, 'ACCEPTED')).status).toBe(409);
  });

  test('cannot withdraw a decided application, or someone else\'s', async () => {
    const { employer, candidate, job } = await scenario();
    const other = await createUser('CANDIDATE');
    const created = (await apply(candidate.token, job._id)).body;

    expect((await request(app).patch(`/api/applications/${created._id}/withdraw`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).patch(`/api/applications/${created._id}/withdraw`).set(auth(employer.token))).status).toBe(403);

    await setStatus(employer.token, created._id, 'ACCEPTED');
    expect((await request(app).patch(`/api/applications/${created._id}/withdraw`).set(auth(candidate.token))).status).toBe(409);
  });
});

describe('resume download', () => {
  test('the applicant and the job owner can download; anyone else gets 403', async () => {
    const { employer, candidate, job } = await scenario();
    const otherEmployer = await createUser('EMPLOYER');
    const otherCandidate = await createUser('CANDIDATE');
    const created = (await apply(candidate.token, job._id)).body;
    const get = (token) => request(app).get(`/api/applications/${created._id}/resume`).set(auth(token));

    expect((await get(candidate.token)).status).toBe(200);
    expect((await get(employer.token)).status).toBe(200);
    expect((await get(otherEmployer.token)).status).toBe(403);
    expect((await get(otherCandidate.token)).status).toBe(403);
    expect((await request(app).get(`/api/applications/${created._id}/resume`)).status).toBe(401);
  });
});

describe('job deletion and the dashboard', () => {
  test('a job with applications cannot be deleted (409)', async () => {
    const { employer, candidate, job } = await scenario();
    await apply(candidate.token, job._id);
    expect((await request(app).delete(`/api/jobs/${job._id}`).set(auth(employer.token))).status).toBe(409);
  });

  test('the dashboard counts applications per status', async () => {
    const { employer, candidate, job } = await scenario();
    const second = await createUser('CANDIDATE');
    await apply(candidate.token, job._id);
    const toReview = (await apply(second.token, job._id)).body;
    await setStatus(employer.token, toReview._id, 'IN_REVIEW');

    const res = await request(app).get('/api/jobs/mine').set(auth(employer.token));
    expect(res.status).toBe(200);
    expect(res.body[0].applicationCount).toBe(2);
    expect(res.body[0].statusCounts).toMatchObject({ APPLIED: 1, IN_REVIEW: 1, ACCEPTED: 0, REJECTED: 0, WITHDRAWN: 0 });
  });
});

describe('domain events (Observer pattern)', () => {
  test('applying emits application:created exactly once', async () => {
    const { candidate, job } = await scenario();
    const handler = jest.fn();
    events.on(EVENTS.APPLICATION_CREATED, handler);
    try {
      const res = await apply(candidate.token, job._id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ applicationId: expect.anything() });
      expect(String(handler.mock.calls[0][0].applicationId)).toBe(res.body._id);
    } finally {
      events.off(EVENTS.APPLICATION_CREATED, handler);
    }
  });

  test('a failed application emits nothing', async () => {
    const { candidate, job } = await scenario();
    await apply(candidate.token, job._id);
    const handler = jest.fn();
    events.on(EVENTS.APPLICATION_CREATED, handler);
    try {
      await apply(candidate.token, job._id); // duplicate, 409
      expect(handler).not.toHaveBeenCalled();
    } finally {
      events.off(EVENTS.APPLICATION_CREATED, handler);
    }
  });

  test('a status change emits once; repeating the same status emits nothing', async () => {
    const { employer, candidate, job } = await scenario();
    const created = (await apply(candidate.token, job._id)).body;
    const handler = jest.fn();
    events.on(EVENTS.APPLICATION_STATUS_CHANGED, handler);
    try {
      await setStatus(employer.token, created._id, 'IN_REVIEW');
      await setStatus(employer.token, created._id, 'IN_REVIEW');
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      events.off(EVENTS.APPLICATION_STATUS_CHANGED, handler);
    }
  });
});