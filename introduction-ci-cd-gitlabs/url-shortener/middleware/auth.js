// Attaches a boolean + user info to res.locals so views can use it everywhere
function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.isAuthenticated = Boolean(req.session.user);
  next();
}

// Blocks a route unless the user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  next();
}

// Blocks a route if the user IS already logged in (e.g. login/register pages)
function redirectIfAuth(req, res, next) {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { attachUser, requireAuth, redirectIfAuth };
