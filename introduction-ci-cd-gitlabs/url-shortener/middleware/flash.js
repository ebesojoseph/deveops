// Minimal flash-message implementation on top of express-session.
// Avoids pulling in connect-flash as an extra dependency.
function flash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;

  // Helper so routes can do: setFlash(req, 'success', 'Saved!')
  req.setFlash = (type, message) => {
    req.session.flash = { type, message };
  };

  next();
}

module.exports = flash;
