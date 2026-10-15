const request = require('supertest');
const app = require('../src/app');
const db = require('./helpers/db');
const User = require('../src/models/User');
const { auth, createUser, createAdmin, createJob, apply, listUploads, cleanupUploads } = require('./helpers/factories');

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

const deactivate = (admin, userId, isActive = false) =>
  request(app).patch(`/api/admin/users/${userId}`).set(auth(admin.token)).send({ isActive });

describe('access control', () => {
  test.each(['/api/admin/stats', '/api/admin/users'])(
    '%s: 401 anonymous, 403 candidate and employer, 200 admin',
    async (url) => {
      const candidate = await createUser('CANDIDATE');
      const employer = await createUser('EMPLOYER');
      const admin = await createAdmin();

      expect((await request(app).get(url)).status).toBe(401);
      expect((await request(app).get(url).set(auth(candidate.token))).status).toBe(403);
      expect((await request(app).get(url).set(auth(employer.token))).status).toBe(403);
      expect((await request(app).get(url).set(auth(admin.token))).status).toBe(200);
    }
  );

  test('registering as ADMIN through the API is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sneaky@test.com', password: 'secret123', role: 'ADMIN', profile: { name: 'Sneaky' } });
    expect(res.status).toBe(400);
  });

  test('a token for a deleted account stops working', async () => {
    const candidate = await createUser('CANDIDATE');
    await User.deleteOne({ _id: candidate.id });
    const res = await request(app).get('/api/applications/my').set(auth(candidate.token));
    expect(res.status).toBe(401);
  });
});

describe('statistics', () => {
  test('reports platform-wide counts', async () => {
    const admin = await createAdmin();
    const employer = await createUser('EMPLOYER');
    const c1 = await createUser('CANDIDATE');
    const c2 = await createUser('CANDIDATE');
    const popular = await createJob(employer.token, { title: 'Popular job' });
    await createJob(employer.token, { title: 'Quiet job' });

    const first = (await apply(c1.token, popular._id)).body;
    await apply(c2.token, popular._id);
    await request(app)
      .patch(`/api/applications/${first._id}/status`)
      .set(auth(employer.token))
      .send({ status: 'IN_REVIEW' });

    const res = await request(app).get('/api/admin/stats').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toMatchObject({ total: 4, active: 4, inactive: 0, byRole: { CANDIDATE: 2, EMPLOYER: 1, ADMIN: 1 } });
    expect(res.body.jobs).toMatchObject({ total: 2, byStatus: { OPEN: 2, CLOSED: 0 } });
    expect(res.body.applications).toMatchObject({
      total: 2,
      last7Days: 2,
      last30Days: 2,
      byStatus: { APPLIED: 1, IN_REVIEW: 1, ACCEPTED: 0, REJECTED: 0, WITHDRAWN: 0 },
    });
    expect(res.body.topJobs).toHaveLength(1); // only jobs with applications appear
    expect(res.body.topJobs[0]).toMatchObject({ title: 'Popular job', applications: 2 });
  });

  test('an empty platform returns zeros and no top jobs', async () => {
    const admin = await createAdmin();
    const res = await request(app).get('/api/admin/stats').set(auth(admin.token));
    expect(res.body.users.total).toBe(1);
    expect(res.body.jobs).toMatchObject({ total: 0, byStatus: { OPEN: 0, CLOSED: 0 } });
    expect(res.body.applications.total).toBe(0);
    expect(res.body.topJobs).toEqual([]);
  });
});

describe('listing users', () => {
  test('filters by role and searches by email, never exposing password hashes', async () => {
    const admin = await createAdmin();
    const employer = await createUser('EMPLOYER');
    await createUser('CANDIDATE');
    await createUser('CANDIDATE');

    const byRole = await request(app).get('/api/admin/users').query({ role: 'CANDIDATE' }).set(auth(admin.token));
    expect(byRole.body.total).toBe(2);
    expect(byRole.body.users.every((u) => u.role === 'CANDIDATE')).toBe(true);
    expect(byRole.body.users[0].password).toBeUndefined();

    const bySearch = await request(app).get('/api/admin/users').query({ q: employer.email }).set(auth(admin.token));
    expect(bySearch.body.total).toBe(1);
    expect(bySearch.body.users[0].email).toBe(employer.email);
  });

  test('paginates', async () => {
    const admin = await createAdmin();
    await createUser('CANDIDATE');
    await createUser('CANDIDATE');

    const res = await request(app).get('/api/admin/users').query({ limit: 2, page: 2 }).set(auth(admin.token));
    expect(res.body).toMatchObject({ total: 3, pages: 2, page: 2, limit: 2 });
    expect(res.body.users).toHaveLength(1);
  });

  test('filters by active state', async () => {
    const admin = await createAdmin();
    const candidate = await createUser('CANDIDATE');
    await deactivate(admin, candidate.id);

    const inactive = await request(app).get('/api/admin/users').query({ isActive: 'false' }).set(auth(admin.token));
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.users[0]._id).toBe(candidate.id);

    const active = await request(app).get('/api/admin/users').query({ isActive: 'true' }).set(auth(admin.token));
    expect(active.body.total).toBe(1); // only the admin
  });
});

describe('deactivating users', () => {
  test('a deactivated user is locked out at once, and reactivation restores access', async () => {
    const admin = await createAdmin();
    const candidate = await createUser('CANDIDATE');

    expect((await deactivate(admin, candidate.id)).status).toBe(200);
    expect((await request(app).get('/api/applications/my').set(auth(candidate.token))).status).toBe(403);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: candidate.email, password: candidate.password });
    expect(login.status).toBe(403);

    expect((await deactivate(admin, candidate.id, true)).status).toBe(200);
    expect((await request(app).get('/api/applications/my').set(auth(candidate.token))).status).toBe(200);
  });

  test('deactivating an employer closes their open jobs', async () => {
    const admin = await createAdmin();
    const employer = await createUser('EMPLOYER');
    await createJob(employer.token);
    expect((await request(app).get('/api/jobs')).body.total).toBe(1);

    await deactivate(admin, employer.id);
    expect((await request(app).get('/api/jobs')).body.total).toBe(0);
  });

  test('admin accounts cannot be deactivated, not even by themselves', async () => {
    const admin = await createAdmin();
    const other = await createAdmin();
    expect((await deactivate(admin, admin.id)).status).toBe(403);
    expect((await deactivate(admin, other.id)).status).toBe(403);
  });

  test('404 for an unknown user, 400 for a bad body or a malformed id', async () => {
    const admin = await createAdmin();
    const patch = (id, body) => request(app).patch(`/api/admin/users/${id}`).set(auth(admin.token)).send(body);
    expect((await patch('507f1f77bcf86cd799439011', { isActive: false })).status).toBe(404);
    expect((await patch('abc', { isActive: false })).status).toBe(400);
    expect((await patch('507f1f77bcf86cd799439011', { isActive: 'no' })).status).toBe(400);
  });
});