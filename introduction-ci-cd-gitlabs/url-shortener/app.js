const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const flash = require('./middleware/flash');
const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');

/**
 * Builds and returns a configured Express app.
 *
 * Kept separate from server.js (which starts the DB connection and the
 * HTTP listener) so tests can build an app instance against a throwaway
 * database (e.g. mongodb-memory-server) without binding to a real port.
 *
 * @param {string} mongoUri - connection string used for the session store
 */
function createApp(mongoUri) {
  const app = express();
  const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

  // --- View engine ---
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layout');

  // --- Core middleware ---
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride('_method')); // supports <form> DELETE via ?_method=DELETE
  app.use(express.static(path.join(__dirname, 'public')));

  // --- Sessions (stored in Mongo so they survive restarts) ---
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: mongoUri, ttl: 14 * 24 * 60 * 60 }),
      cookie: {
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        secure: process.env.NODE_ENV === 'production',
      },
    })
  );

  app.use(flash);
  app.use(attachUser);

  // --- Routes ---
  app.get('/', (req, res) => {
    if (res.locals.isAuthenticated) return res.redirect('/dashboard');
    res.render('index', { title: 'URL Shortener' });
  });

  app.use('/', authRoutes);
  app.use('/', linkRoutes); // includes the catch-all GET /:code redirect, must stay last

  // --- 404 ---
  app.use((req, res) => {
    res.status(404).render('404', { title: 'Not found' });
  });

  // --- Error handler ---
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[server] Unhandled error:', err);
    res.status(500).render('404', { title: 'Something went wrong' });
  });

  return app;
}

module.exports = createApp;
