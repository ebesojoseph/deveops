const User = require('../models/User');
const { connect, clearDatabase, closeDatabase } = require('./helpers/testDb');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('User model', () => {
  test('hashes the password on save', async () => {
    const user = await User.create({
      name: 'Alan Turing',
      email: 'alan@example.com',
      password: 'password123',
    });

    expect(user.password).not.toBe('password123');
    expect(user.password.length).toBeGreaterThan(20); // bcrypt hashes are long
  });

  test('comparePassword returns true for the correct password', async () => {
    const user = await User.create({
      name: 'Alan Turing',
      email: 'alan2@example.com',
      password: 'password123',
    });

    await expect(user.comparePassword('password123')).resolves.toBe(true);
  });

  test('comparePassword returns false for an incorrect password', async () => {
    const user = await User.create({
      name: 'Alan Turing',
      email: 'alan3@example.com',
      password: 'password123',
    });

    await expect(user.comparePassword('wrong')).resolves.toBe(false);
  });

  test('does not rehash the password when other fields are updated', async () => {
    const user = await User.create({
      name: 'Alan Turing',
      email: 'alan4@example.com',
      password: 'password123',
    });
    const originalHash = user.password;

    user.name = 'A. M. Turing';
    await user.save();

    expect(user.password).toBe(originalHash);
  });

  test('enforces unique emails', async () => {
    await User.create({ name: 'First', email: 'dupe@example.com', password: 'password123' });
    await expect(
      User.create({ name: 'Second', email: 'dupe@example.com', password: 'password123' })
    ).rejects.toThrow();
  });

  test('toJSON strips the password hash', async () => {
    const user = await User.create({
      name: 'Alan Turing',
      email: 'alan5@example.com',
      password: 'password123',
    });

    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.email).toBe('alan5@example.com');
  });
});
