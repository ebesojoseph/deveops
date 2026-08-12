const request = require('supertest');
const createApp = require('../app');
const User = require('../models/User');
const Link = require('../models/Link');
const { connect, clearDatabase, closeDatabase } = require('./helpers/testDb');

let app;

async function registerAndLogin(agent, overrides = {}) {
  const user = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    ...overrides,
  };
  await agent.post('/register').type('form').send(user);
  return user;
}

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

describe('POST /links', () => {
  test('requires authentication', async () => {
    const res = await request(app).post('/links').type('form').send({ originalUrl: 'https://example.com' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('creates a short link with a generated code', async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent);

    const res = await agent.post('/links').type('form').send({
      originalUrl: 'https://example.com/some/long/path',
      title: 'Example',
    });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');

    const links = await Link.find({});
    expect(links).toHaveLength(1);
    expect(links[0].originalUrl).toBe('https://example.com/some/long/path');
    expect(links[0].code).toMatch(/^[A-Za-z0-9_-]{7}$/);
    expect(links[0].title).toBe('Example');
    expect(links[0].clicks).toBe(0);
  });

  test('creates a short link with a custom code', async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent);

    await agent.post('/links').type('form').send({
      originalUrl: 'https://example.com',
      customCode: 'my-link',
    });

    const link = await Link.findOne({ code: 'my-link' });
    expect(link).not.toBeNull();
  });

  test('rejects an invalid destination URL', async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent);

    const res = await agent.post('/links').type('form').send({ originalUrl: 'not-a-url' });
    expect(res.status).toBe(302);
    expect(await Link.countDocuments()).toBe(0);
  });

  test('rejects a custom code that is already taken', async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent);
    const owner = await User.findOne({ email: user.email });

    await Link.create({ owner: owner._id, originalUrl: 'https://a.com', code: 'taken' });

    await agent.post('/links').type('form').send({ originalUrl: 'https://b.com', customCode: 'taken' });

    expect(await Link.countDocuments({ code: 'taken' })).toBe(1);
  });

  test('rejects a malformed custom code', async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent);

    await agent.post('/links').type('form').send({
      originalUrl: 'https://example.com',
      customCode: '!!',
    });

    expect(await Link.countDocuments()).toBe(0);
  });
});

describe('GET /dashboard', () => {
  test("only lists the current user's links", async () => {
    const agentA = request.agent(app);
    await registerAndLogin(agentA, { email: 'a@example.com' });
    await agentA.post('/links').type('form').send({ originalUrl: 'https://a-link.com' });

    const agentB = request.agent(app);
    await registerAndLogin(agentB, { email: 'b@example.com' });
    await agentB.post('/links').type('form').send({ originalUrl: 'https://b-link.com' });

    const dashboardA = await agentA.get('/dashboard');
    expect(dashboardA.text).toContain('a-link.com');
    expect(dashboardA.text).not.toContain('b-link.com');
  });
});

describe('GET /:code (redirect)', () => {
  test('redirects to the original URL and increments the click count', async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent);
    const owner = await User.findOne({ email: user.email });
    const link = await Link.create({
      owner: owner._id,
      originalUrl: 'https://destination.example.com',
      code: 'abc1234',
    });

    const res = await request(app).get('/abc1234');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://destination.example.com');

    const updated = await Link.findById(link._id);
    expect(updated.clicks).toBe(1);
    expect(updated.lastClickedAt).not.toBeNull();
  });

  test('returns 404 for an unknown code', async () => {
    const res = await request(app).get('/does-not-exist-code');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /links/:id', () => {
  test('deletes a link owned by the current user', async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent);
    const owner = await User.findOne({ email: user.email });
    const link = await Link.create({ owner: owner._id, originalUrl: 'https://x.com', code: 'delcode' });

    const res = await agent.delete(`/links/${link._id}`);
    expect(res.status).toBe(302);
    expect(await Link.findById(link._id)).toBeNull();
  });

  test('cannot delete a link owned by a different user', async () => {
    const otherOwner = await User.create({ name: 'Other', email: 'other@example.com', password: 'password123' });
    const link = await Link.create({ owner: otherOwner._id, originalUrl: 'https://x.com', code: 'notyours' });

    const agent = request.agent(app);
    await registerAndLogin(agent);

    await agent.delete(`/links/${link._id}`);
    expect(await Link.findById(link._id)).not.toBeNull();
  });
});

describe('QR codes', () => {
  test('GET /links/:id/qr renders a page with a data URI image', async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent);
    const owner = await User.findOne({ email: user.email });
    const link = await Link.create({ owner: owner._id, originalUrl: 'https://x.com', code: 'qrcode1' });

    const res = await agent.get(`/links/${link._id}/qr`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('data:image/png;base64');

    const updated = await Link.findById(link._id);
    expect(updated.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  test('GET /links/:id/qr.png streams a PNG', async () => {
    const agent = request.agent(app);
    const user = await registerAndLogin(agent);
    const owner = await User.findOne({ email: user.email });
    const link = await Link.create({ owner: owner._id, originalUrl: 'https://x.com', code: 'qrcode2' });

    const res = await agent.get(`/links/${link._id}/qr.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  test('QR routes require authentication', async () => {
    const owner = await User.create({ name: 'Owner', email: 'owner@example.com', password: 'password123' });
    const link = await Link.create({ owner: owner._id, originalUrl: 'https://x.com', code: 'qrcode3' });

    const res = await request(app).get(`/links/${link._id}/qr`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
