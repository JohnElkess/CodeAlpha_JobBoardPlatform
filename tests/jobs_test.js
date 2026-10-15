const request = require('supertest');
const app = require('../src/app');
const db = require('./helpers/db');
const { auth, createUser, createJob, jobBody } = require('./helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('creating jobs', () => {
  test('an employer can create a job, owned by them', async () => {
    const employer = await createUser('EMPLOYER');
    const res = await request(app).post('/api/jobs').set(auth(employer.token)).send(jobBody());
    expect(res.status).toBe(201);
    expect(res.body.employer).toBe(employer.id); // taken from the token, not the body
    expect(res.body.status).toBe('OPEN');
  });

  test('401 without a token, 403 for a candidate', async () => {
    const candidate = await createUser('CANDIDATE');
    expect((await request(app).post('/api/jobs').send(jobBody())).status).toBe(401);
    expect((await request(app).post('/api/jobs').set(auth(candidate.token)).send(jobBody())).status).toBe(403);
  });

  test.each([
    ['a missing title', { title: '' }],
    ['an invalid jobType', { jobType: 'WHATEVER' }],
    ['min greater than max salary', { salaryRange: { min: 30, max: 10 } }],
  ])('400 for %s', async (_label, override) => {
    const employer = await createUser('EMPLOYER');
    const res = await request(app).post('/api/jobs').set(auth(employer.token)).send(jobBody(override));
    expect(res.status).toBe(400);
  });
});

describe('searching jobs (public)', () => {
  test('lists only OPEN jobs, and closing a job hides it', async () => {
    const employer = await createUser('EMPLOYER');
    const job = await createJob(employer.token);
    expect((await request(app).get('/api/jobs')).body.total).toBe(1);

    await request(app).patch(`/api/jobs/${job._id}`).set(auth(employer.token)).send({ status: 'CLOSED' });
    expect((await request(app).get('/api/jobs')).body.total).toBe(0);

    await request(app).patch(`/api/jobs/${job._id}`).set(auth(employer.token)).send({ status: 'OPEN' });
    expect((await request(app).get('/api/jobs')).body.total).toBe(1);
  });

  test('filters by location (case-insensitive) and jobType', async () => {
    const employer = await createUser('EMPLOYER');
    await createJob(employer.token, { location: 'Cairo', jobType: 'FULL_TIME' });
    await createJob(employer.token, { location: 'Alexandria', jobType: 'FULL_TIME' });
    await createJob(employer.token, { location: 'Cairo', jobType: 'INTERNSHIP' });

    const byLocation = await request(app).get('/api/jobs').query({ location: 'cairo' });
    expect(byLocation.body.total).toBe(2);

    const combined = await request(app).get('/api/jobs').query({ location: 'cairo', jobType: 'INTERNSHIP' });
    expect(combined.body.total).toBe(1);
  });

  test('keyword search matches whole words in title or description', async () => {
    const employer = await createUser('EMPLOYER');
    await createJob(employer.token, { title: 'Backend Engineer' });
    await createJob(employer.token, { title: 'Graphic Designer', description: 'Design posters' });

    const res = await request(app).get('/api/jobs').query({ q: 'backend' });
    expect(res.body.total).toBe(1);
    expect(res.body.jobs[0].title).toBe('Backend Engineer');
  });

  test('paginates and caps results', async () => {
    const employer = await createUser('EMPLOYER');
    for (let i = 0; i < 3; i += 1) await createJob(employer.token, { title: `Job ${i}` });

    const res = await request(app).get('/api/jobs').query({ limit: 2, page: 1 });
    expect(res.body.jobs).toHaveLength(2);
    expect(res.body).toMatchObject({ total: 3, pages: 2, limit: 2 });
  });

  test('does not expose the employer email or password hash', async () => {
    const employer = await createUser('EMPLOYER');
    await createJob(employer.token);
    const res = await request(app).get('/api/jobs');
    expect(res.body.jobs[0].employer.email).toBeUndefined();
    expect(res.body.jobs[0].employer.password).toBeUndefined();
  });
});

describe('getting one job', () => {
  test('200 for an existing job, 404 for an unknown id, 400 for a malformed id', async () => {
    const employer = await createUser('EMPLOYER');
    const job = await createJob(employer.token);
    expect((await request(app).get(`/api/jobs/${job._id}`)).status).toBe(200);
    expect((await request(app).get('/api/jobs/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await request(app).get('/api/jobs/abc')).status).toBe(400);
  });
});

describe('editing and deleting jobs', () => {
  test('the owner can edit, but cannot reassign the employer', async () => {
    const owner = await createUser('EMPLOYER');
    const other = await createUser('EMPLOYER');
    const job = await createJob(owner.token);

    const res = await request(app)
      .patch(`/api/jobs/${job._id}`)
      .set(auth(owner.token))
      .send({ title: 'Senior Backend Engineer', employer: other.id });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Senior Backend Engineer');
    expect(res.body.employer).toBe(owner.id);
  });

  test('another employer gets 403 on PATCH and DELETE', async () => {
    const owner = await createUser('EMPLOYER');
    const other = await createUser('EMPLOYER');
    const job = await createJob(owner.token);

    expect((await request(app).patch(`/api/jobs/${job._id}`).set(auth(other.token)).send({ title: 'x' })).status).toBe(403);
    expect((await request(app).delete(`/api/jobs/${job._id}`).set(auth(other.token))).status).toBe(403);
  });

  test.each([
    ['an empty update', {}],
    ['an invalid status', { status: 'PAUSED' }],
    ['min greater than max salary', { salaryRange: { min: 30, max: 10 } }],
  ])('400 for %s', async (_label, body) => {
    const owner = await createUser('EMPLOYER');
    const job = await createJob(owner.token);
    const res = await request(app).patch(`/api/jobs/${job._id}`).set(auth(owner.token)).send(body);
    expect(res.status).toBe(400);
  });

  test('the owner can delete a job that has no applications', async () => {
    const owner = await createUser('EMPLOYER');
    const job = await createJob(owner.token);
    expect((await request(app).delete(`/api/jobs/${job._id}`).set(auth(owner.token))).status).toBe(204);
    expect((await request(app).get(`/api/jobs/${job._id}`)).status).toBe(404);
  });
});

describe('employer dashboard route', () => {
  test('/mine is matched before /:id and returns only the caller\'s jobs', async () => {
    const a = await createUser('EMPLOYER');
    const b = await createUser('EMPLOYER');
    await createJob(a.token, { title: 'A job' });
    await createJob(b.token, { title: 'B job' });

    const res = await request(app).get('/api/jobs/mine').set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A job');
  });
});