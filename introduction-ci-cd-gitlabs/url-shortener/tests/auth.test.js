const request = require('supertest');
const createApp = require('../app');
const User = require('../models/User');
const { connect, clearDatabase, closeDatabase } = require('./helpers/testDb');

let app;

beforeAll(async () => {
  const mongoUri = await connect();
  app = createApp(mongoUri);
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('GET /register', () => {
  test('renders the signup form', async () => {
    const res = await request(app).get('/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Create your account');
  });
});

describe('POST /register', () => {
  test('creates a user, hashes the password, and logs them in', async () => {
    const agent = request.agent(app);

    const res = await agent.post('/register').type('form').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');

    const user = await User.findOne({ email: 'ada@example.com' });
    expect(user).not.toBeNull();
    expect(user.password).not.toBe('password123');

    // session cookie from registration should grant access to the dashboard
    const dashboardRes = await agent.get('/dashboard');
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.text).toContain('Your links');
  });

  test('rejects mismatched passwords without creating a user', async () => {
    const res = await request(app).post('/register').type('form').send({
      name: 'Bad Input',
      email: 'mismatch@example.com',
      password: 'password123',
      confirmPassword: 'somethingElse',
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Passwords do not match');
    expect(await User.findOne({ email: 'mismatch@example.com' })).toBeNull();
  });

  test('rejects an invalid email', async () => {
    const res = await request(app).post('/register').type('form').send({
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('valid email');
  });

  test('rejects a password shorter than 6 characters', async () => {
    const res = await request(app).post('/register').type('form').send({
      name: 'Short Pass',
      email: 'shortpass@example.com',
      password: '123',
      confirmPassword: '123',
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('at least 6 characters');
  });

  test('rejects duplicate emails', async () => {
    await User.create({ name: 'Existing', email: 'dupe@example.com', password: 'password123' });

    const res = await request(app).post('/register').type('form').send({
      name: 'Duplicate',
      email: 'dupe@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.text).toContain('already registered');
  });
});

describe('POST /login', () => {
  beforeEach(async () => {
    await User.create({ name: 'Grace Hopper', email: 'grace@example.com', password: 'password123' });
  });

  test('logs in with correct credentials and redirects to the dashboard', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/login')
      .type('form')
      .send({ email: 'grace@example.com', password: 'password123' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');

    const dashboardRes = await agent.get('/dashboard');
    expect(dashboardRes.status).toBe(200);
  });

  test('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Invalid email or password');
  });

  test('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ email: 'grace@example.com', password: 'wrong-password' });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Invalid email or password');
  });

  test('redirects an already-authenticated user straight to the dashboard', async () => {
    const agent = request.agent(app);
    await agent.post('/login').type('form').send({ email: 'grace@example.com', password: 'password123' });

    const res = await agent.get('/login');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });
});

describe('Session-protected routes', () => {
  test('GET /dashboard redirects anonymous visitors to /login', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('Logout', () => {
  test('DELETE /logout (via method-override) ends the session', async () => {
    await User.create({ name: 'Logout User', email: 'logout@example.com', password: 'password123' });
    const agent = request.agent(app);

    await agent.post('/login').type('form').send({ email: 'logout@example.com', password: 'password123' });
    expect((await agent.get('/dashboard')).status).toBe(200);

    const logoutRes = await agent.post('/logout?_method=DELETE');
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.location).toBe('/login');

    const afterLogout = await agent.get('/dashboard');
    expect(afterLogout.status).toBe(302);
    expect(afterLogout.headers.location).toBe('/login');
  });
});
