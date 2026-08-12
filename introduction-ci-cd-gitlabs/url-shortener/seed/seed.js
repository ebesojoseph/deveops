/**
 * Seeds the database with sample users and links for local testing.
 *
 * Usage:
 *   npm run seed          -> seeds MONGO_URI_TEST (falls back to MONGO_URI)
 *   npm run seed:fresh    -> same, but wipes users/links first
 *
 * You can also target a specific DB by exporting SEED_URI directly:
 *   SEED_URI=mongodb://127.0.0.1:27017/some_db node seed/seed.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Link = require('../models/Link');

const SEED_URI =
  process.env.SEED_URI ||
  process.env.MONGO_URI_TEST ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/url_shortener_test';

const FRESH = process.argv.includes('--fresh');

const SAMPLE_USERS = [
  { name: 'Ada Lovelace', email: 'ada@example.com', password: 'password123' },
  { name: 'Grace Hopper', email: 'grace@example.com', password: 'password123' },
  { name: 'Alan Turing', email: 'alan@example.com', password: 'password123' },
];

const SAMPLE_TARGET_URLS = [
  { url: 'https://www.anthropic.com', title: 'Anthropic' },
  { url: 'https://developer.mozilla.org/en-US/', title: 'MDN Web Docs' },
  { url: 'https://nodejs.org', title: 'Node.js' },
  { url: 'https://expressjs.com', title: 'Express' },
  { url: 'https://www.mongodb.com', title: 'MongoDB' },
  { url: 'https://ejs.co', title: 'EJS' },
  { url: 'https://github.com', title: 'GitHub' },
  { url: 'https://news.ycombinator.com', title: 'Hacker News' },
];

function randomCode(length = 7) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function seed() {
  console.log(`[seed] Connecting to ${SEED_URI}`);
  await mongoose.connect(SEED_URI);

  if (FRESH) {
    console.log('[seed] --fresh flag set: clearing users and links...');
    await Promise.all([User.deleteMany({}), Link.deleteMany({})]);
  }

  const createdUsers = [];

  for (const sample of SAMPLE_USERS) {
    let user = await User.findOne({ email: sample.email });
    if (user) {
      console.log(`[seed] User already exists, skipping: ${sample.email}`);
    } else {
      user = await User.create(sample);
      console.log(`[seed] Created user: ${sample.email} (password: ${sample.password})`);
    }
    createdUsers.push(user);
  }

  let linksCreated = 0;

  for (const user of createdUsers) {
    // Give each user a handful of sample links
    const linkCount = 3 + Math.floor(Math.random() * 3); // 3-5 links
    for (let i = 0; i < linkCount; i += 1) {
      const sample = SAMPLE_TARGET_URLS[Math.floor(Math.random() * SAMPLE_TARGET_URLS.length)];

      let code = randomCode();
      // eslint-disable-next-line no-await-in-loop
      while (await Link.findOne({ code })) {
        code = randomCode();
      }

      // eslint-disable-next-line no-await-in-loop
      await Link.create({
        owner: user._id,
        originalUrl: sample.url,
        code,
        title: sample.title,
        clicks: Math.floor(Math.random() * 250),
      });
      linksCreated += 1;
    }
  }

  console.log(`[seed] Done. Users in DB: ${await User.countDocuments()}, links created this run: ${linksCreated}`);
  console.log('[seed] Sample login credentials:');
  SAMPLE_USERS.forEach((u) => console.log(`         email: ${u.email}  password: ${u.password}`));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
