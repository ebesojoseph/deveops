# Snippy — a sample URL shortener

A small Node.js/Express project with:

- **EJS** views + a shared layout
- **User accounts**: sign up / log in / log out
- **Server-side sessions** stored in MongoDB (`connect-mongo`), so sessions survive server restarts
- **Dashboard** to create, view, and delete your short links, with click counts
- **QR codes** for every short link (viewable in-browser or downloadable as PNG)
- A **seed script** to populate a database with sample users + links for testing

## 1. Requirements

- Node.js 18+
- A running MongoDB instance (local install, Docker, or Atlas)

## 2. Setup

```bash
cd url-shortener
npm install
cp .env.example .env
```

Edit `.env` and set `MONGO_URI` to your MongoDB connection string. If you don't have Mongo installed locally, the quickest option is Docker:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

## 3. Seed sample data (optional, for testing)

The seed script writes to `MONGO_URI_TEST` if set (falling back to `MONGO_URI`), so you can keep a separate database just for test data.

```bash
npm run seed          # add sample users/links (skips users that already exist)
npm run seed:fresh    # wipe users & links first, then reseed
```

This creates 3 sample users, each with a handful of random links:

| Email             | Password      |
|-------------------|---------------|
| ada@example.com   | password123   |
| grace@example.com | password123   |
| alan@example.com  | password123   |

To seed a specific database directly, you can also run:

```bash
SEED_URI="mongodb://127.0.0.1:27017/some_db" node seed/seed.js --fresh
```

## 4. Run the app

```bash
npm start        # production-style start
npm run dev       # auto-restart on file changes (nodemon)
```

Visit **http://localhost:3000**, sign up (or log in with a seeded account), and create your first short link from the dashboard.

## 5. How it works

- `server.js` wires up Express, EJS, sessions, and routes.
- `routes/auth.js` handles registration/login/logout. Passwords are hashed with `bcryptjs` before being saved (see `models/User.js`).
- `routes/links.js` handles:
  - `POST /links` — create a short link (random code via `nanoid`, or a custom code you choose)
  - `GET /dashboard` — list your links
  - `DELETE /links/:id` — delete a link
  - `GET /links/:id/qr` — view a QR code for a link (generated with the `qrcode` package, cached on the link document)
  - `GET /links/:id/qr.png` — download the QR code as a PNG
  - `GET /:code` — the actual short-link redirect, tracked with a click counter
- `middleware/auth.js` — `requireAuth` protects the dashboard/link routes; `attachUser` exposes the logged-in user to every view.
- `middleware/flash.js` — a tiny session-based flash-message helper (no extra dependency needed).
- `seed/seed.js` — idempotent-ish seeding script for local/testing databases.

## 6. Project structure

```
url-shortener/
├── .github/workflows/ci.yml  # GitHub Actions CI pipeline
├── config/db.js               # Mongo connection helper
├── middleware/                 # auth + flash middleware
├── models/                      # User, Link (Mongoose schemas)
├── routes/                       # auth.js, links.js
├── seed/seed.js                   # DB seeding script
├── tests/                          # Jest + Supertest suite
│   ├── helpers/testDb.js            # in-memory / service-container DB setup
│   ├── auth.test.js
│   ├── links.test.js
│   └── user.model.test.js
├── views/                          # EJS templates
├── public/css/style.css            # styling
├── app.js                           # Express app factory (used by server.js and tests)
├── server.js                         # app entry point (connects DB, starts listening)
└── .env.example
```

## 7. Testing

The test suite uses **Jest** + **Supertest** for HTTP-level integration tests (auth, links, QR codes) and a small model-level unit test file for `User` (password hashing).

```bash
npm test               # run the full suite
npm run test:watch     # watch mode
npm run test:coverage  # with a coverage report
```

Tests never touch your real database. `tests/helpers/testDb.js` picks one of two backends automatically:

- **Local development (default):** spins up an ephemeral MongoDB via [`mongodb-memory-server`](https://github.com/typegoose/mongodb-memory-server). No setup needed — it downloads a small MongoDB binary the first time you run the tests and caches it.
- **CI / offline environments:** if the `TEST_MONGO_URI` environment variable is set, tests connect to that MongoDB directly instead (e.g. a `mongo:` service container) and skip the binary download entirely. This matters because some CI runners and sandboxes block outbound access to MongoDB's binary-download servers.

```bash
# Example: point tests at a real local/service MongoDB instead of mongodb-memory-server
TEST_MONGO_URI="mongodb://127.0.0.1:27017/url_shortener_test" npm test
```

Each test file gets a clean database (collections are wiped between tests, and dropped at the end of the file), so tests don't leak state into each other.

### What's covered

- **`tests/auth.test.js`** — registration validation (bad email, short password, mismatched passwords, duplicate email), login success/failure, session-gated routes redirecting anonymous users, and logout actually clearing the session.
- **`tests/links.test.js`** — creating links (generated vs. custom codes, invalid URLs, taken/malformed custom codes), the dashboard only showing the current user's links, the public redirect endpoint incrementing click counts, ownership checks on delete, and QR code generation (both the HTML page and the PNG download).
- **`tests/user.model.test.js`** — password hashing on save, `comparePassword`, not rehashing on unrelated updates, unique email enforcement, and that `toJSON` never leaks the password hash.

## 8. Continuous Integration

`.github/workflows/ci.yml` runs on every push/PR to `main`:

- A `test` job on a matrix of Node 18.x and 20.x, using a real `mongo:7` **service container** (not `mongodb-memory-server`) so the pipeline doesn't depend on outbound access to MongoDB's binary-download servers — a good practice for CI generally, and required in network-restricted runners.
- A `lint-check` job that syntax-checks (`node --check`) every JS file in the repo as a fast, dependency-free smoke test.
- A coverage report uploaded as a build artifact on the Node 20.x run.

This is a reasonable starting point for a CI/CD exercise — e.g. you could extend it with a `deploy` job gated on the `test` job passing, add ESLint/Prettier checks, or add a Docker build/push step.

## 9. Notes for extending it

- Swap `MONGO_URI` for a real Atlas connection string for a shared/staging environment.
- The QR code is cached on the `Link` document (`qrDataUrl`) after first generation to avoid recomputing it on every view.
- Short codes are 7-character `nanoid` strings by default; adjust the length in `routes/links.js` if you want shorter/longer codes.
- All templates extend `views/layout.ejs` via `express-ejs-layouts`, so shared nav/flash-message markup only lives in one place.
