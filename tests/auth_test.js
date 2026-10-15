const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const db = require('./helpers/db');
const { createUser, auth } = require('./helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

const registerBody = (o = {}) => ({
  email: 'eve@test.com', password: 'secret123', role: 'EMPLOYER', profile: { name: 'Eve' }, ...o,
});

describe('POST /api/auth/register', () => {
  test('creates a user and returns a token without the password', async () => {
    const res = await request(app).post('/api/auth/register').send(registerBody());
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('eve@test.com');
    expect(res.body.user.password).toBeUndefined();
  });

  test('stores a bcrypt hash, not the plain password', async () => {
    await request(app).post('/api/auth/register').send(registerBody());
    const user = await User.findOne({ email: 'eve@test.com' }).select('+password');
    expect(user.password).not.toBe('secret123');
    expect(user.password).toMatch(/^\$2[aby]\$/);
  });

  test('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(registerBody());
    const res = await request(app).post('/api/auth/register').send(registerBody());
    expect(res.status).toBe(409);
  });

  test.each([
    ['an unknown role', { role: 'ADMIN' }],
    ['an invalid email', { email: 'not-an-email' }],
    ['a short password', { password: '123' }],
    ['a missing name', { profile: {} }],
  ])('rejects %s with 400', async (_label, override) => {
    const res = await request(app).post('/api/auth/register').send(registerBody(override));
    expect(res.status).toBe(400);
  });

  test('rejects an empty body with 400, not 500', async () => {
    const res = await request(app).post('/api/auth/register');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('returns a token for correct credentials, email case-insensitive', async () => {
    await request(app).post('/api/auth/register').send(registerBody({ email: 'Eve@Test.com' }));
    const res = await request(app).post('/api/auth/login').send({ email: 'eve@test.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('wrong password and unknown email give the same 401 message', async () => {
    await request(app).post('/api/auth/register').send(registerBody());
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'eve@test.com', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'secret123' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.message).toBe(unknown.body.message); // no hint about which emails exist
  });

  test('rejects an empty body with 400', async () => {
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(400);
  });
});

describe('authentication and authorization middleware', () => {
  test('401 without a token', async () => {
    const res = await request(app).get('/api/applications/my');
    expect(res.status).toBe(401);
  });

  test('401 for a garbage token', async () => {
    const res = await request(app).get('/api/applications/my').set(auth('garbage'));
    expect(res.status).toBe(401);
  });

  test('401 for a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'EMPLOYER' }, 'wrong_secret');
    const res = await request(app).get('/api/jobs/mine').set(auth(forged));
    expect(res.status).toBe(401);
  });

  test('401 for an expired token', async () => {
    const expired = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'EMPLOYER' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/jobs/mine').set(auth(expired));
    expect(res.status).toBe(401);
  });

  test('403 when a candidate calls an employer endpoint', async () => {
    const candidate = await createUser('CANDIDATE');
    const res = await request(app).get('/api/jobs/mine').set(auth(candidate.token));
    expect(res.status).toBe(403);
  });
});