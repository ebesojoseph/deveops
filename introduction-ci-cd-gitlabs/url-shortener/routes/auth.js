const express = require('express');
const validator = require('validator');
const User = require('../models/User');
const { redirectIfAuth } = require('../middleware/auth');

const router = express.Router();

// GET /register
router.get('/register', redirectIfAuth, (req, res) => {
  res.render('register', { title: 'Sign up', errors: [], form: {} });
});

// POST /register
router.post('/register', redirectIfAuth, async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  const errors = [];

  if (!name || !name.trim()) errors.push('Name is required.');
  if (!email || !validator.isEmail(email)) errors.push('A valid email is required.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  if (errors.length === 0) {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) errors.push('That email is already registered.');
  }

  if (errors.length > 0) {
    return res.status(400).render('register', {
      title: 'Sign up',
      errors,
      form: { name, email },
    });
  }

  try {
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    req.session.user = { id: user._id.toString(), name: user.name, email: user.email };
    req.setFlash('success', `Welcome, ${user.name}! Your account has been created.`);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[auth] register error:', err.message);
    res.status(500).render('register', {
      title: 'Sign up',
      errors: ['Something went wrong. Please try again.'],
      form: { name, email },
    });
  }
});

// GET /login
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('login', { title: 'Log in', errors: [], form: {} });
});

// POST /login
router.post('/login', redirectIfAuth, async (req, res) => {
  const { email, password } = req.body;
  const genericError = 'Invalid email or password.';

  if (!email || !password) {
    return res.status(400).render('login', {
      title: 'Log in',
      errors: [genericError],
      form: { email },
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const match = user ? await user.comparePassword(password) : false;

    if (!user || !match) {
      return res.status(400).render('login', {
        title: 'Log in',
        errors: [genericError],
        form: { email },
      });
    }

    req.session.user = { id: user._id.toString(), name: user.name, email: user.email };
    const redirectTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    req.setFlash('success', `Welcome back, ${user.name}!`);
    res.redirect(redirectTo);
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).render('login', {
      title: 'Log in',
      errors: ['Something went wrong. Please try again.'],
      form: { email },
    });
  }
});

// DELETE /logout (the navbar form posts to /logout?_method=DELETE, which
// method-override rewrites to a DELETE request)
router.delete('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[auth] logout error:', err.message);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
