const express = require('express');
const validator = require('validator');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const Link = require('../models/Link');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// GET /dashboard - list current user's links
router.get('/dashboard', requireAuth, async (req, res) => {
  const links = await Link.find({ owner: req.session.user.id }).sort({ createdAt: -1 });
  res.render('dashboard', {
    title: 'Dashboard',
    links,
    baseUrl: getBaseUrl(req),
  });
});

// POST /links - create a new short link
router.post('/links', requireAuth, async (req, res) => {
  const { originalUrl, customCode, title } = req.body;

  if (!originalUrl || !validator.isURL(originalUrl, { require_protocol: true })) {
    req.setFlash('error', 'Please enter a valid URL, including http:// or https://');
    return res.redirect('/dashboard');
  }

  try {
    let code = (customCode || '').trim();

    if (code) {
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
        req.setFlash('error', 'Custom codes must be 3-20 characters: letters, numbers, - or _.');
        return res.redirect('/dashboard');
      }
      const existing = await Link.findOne({ code });
      if (existing) {
        req.setFlash('error', `The code "${code}" is already taken.`);
        return res.redirect('/dashboard');
      }
    } else {
      // Keep generating until we find a free code (extremely unlikely to collide twice)
      do {
        code = nanoid(7);
      } while (await Link.findOne({ code }));
    }

    await Link.create({
      owner: req.session.user.id,
      originalUrl,
      code,
      title: (title || '').trim(),
    });

    req.setFlash('success', 'Short link created!');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[links] create error:', err.message);
    req.setFlash('error', 'Something went wrong creating that link.');
    res.redirect('/dashboard');
  }
});

// DELETE /links/:id
router.delete('/links/:id', requireAuth, async (req, res) => {
  try {
    await Link.deleteOne({ _id: req.params.id, owner: req.session.user.id });
    req.setFlash('success', 'Link deleted.');
  } catch (err) {
    console.error('[links] delete error:', err.message);
    req.setFlash('error', 'Could not delete that link.');
  }
  res.redirect('/dashboard');
});

// GET /links/:id/qr - render a page with the QR code for a link
router.get('/links/:id/qr', requireAuth, async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, owner: req.session.user.id });
  if (!link) {
    req.setFlash('error', 'Link not found.');
    return res.redirect('/dashboard');
  }

  const shortUrl = `${getBaseUrl(req)}/${link.code}`;

  try {
    if (!link.qrDataUrl) {
      link.qrDataUrl = await QRCode.toDataURL(shortUrl, {
        width: 320,
        margin: 2,
      });
      await link.save();
    }
    res.render('qr', { title: 'QR code', link, shortUrl });
  } catch (err) {
    console.error('[links] qr error:', err.message);
    req.setFlash('error', 'Could not generate QR code.');
    res.redirect('/dashboard');
  }
});

// GET /links/:id/qr.png - direct PNG download of the QR code
router.get('/links/:id/qr.png', requireAuth, async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, owner: req.session.user.id });
  if (!link) return res.status(404).send('Not found');

  const shortUrl = `${getBaseUrl(req)}/${link.code}`;

  try {
    res.type('png');
    await QRCode.toFileStream(res, shortUrl, { width: 512, margin: 2 });
  } catch (err) {
    console.error('[links] qr.png error:', err.message);
    res.status(500).send('Could not generate QR code');
  }
});

// GET /:code - public redirect endpoint (must be registered LAST / mounted at root)
router.get('/:code', async (req, res, next) => {
  const { code } = req.params;
  // Let obvious non-link paths fall through to the 404 handler
  if (code.includes('.') || code.length > 30) return next();

  const link = await Link.findOne({ code });
  if (!link) return next();

  link.clicks += 1;
  link.lastClickedAt = new Date();
  await link.save();

  res.redirect(link.originalUrl);
});

module.exports = router;
