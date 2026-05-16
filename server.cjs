// ╔══════════════════════════════════════════════════════════════╗
// ║  SHOWFILE TRACKER — Express server                           ║
// ║                                                              ║
// ║  Open mode:    AUTH_PASSWORD unset → no auth (forker default)║
// ║  Gated mode:   AUTH_PASSWORD set → session + CSRF required   ║
// ║                                                              ║
// ║  Auth pattern matches adhd-tools (HMAC-signed session cookie,║
// ║  CSRF token derived from session token via HMAC).            ║
// ╚══════════════════════════════════════════════════════════════╝

var express = require('express');
var path = require('path');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');
var cookieParser = require('cookie-parser');
var crypto = require('crypto');

var showfilesRouter = require('./server/showfiles.cjs');
var importExportRouter = require('./server/import-export.cjs');

var app = express();
var PORT = process.env.PORT || 3000;

// ── ENV ──
var AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
var AUTH_ENABLED = AUTH_PASSWORD.length > 0;
var SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
var NODE_ENV = process.env.NODE_ENV || 'production';

// ── HELMET ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' })); // bigger for CSV import
app.use(cookieParser());

// ── RATE LIMITING ──
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
}));

var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// ── SESSION / CSRF ──
function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}
function signToken(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}
function verifySession(req) {
  var token = req.cookies && req.cookies.session_token;
  var sig = req.cookies && req.cookies.session_sig;
  if (!token || !sig) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(signToken(token), 'hex'));
  } catch (e) { return false; }
}
function generateCsrfToken(sessionToken) {
  return crypto.createHmac('sha256', SESSION_SECRET).update('csrf:' + sessionToken).digest('hex').substring(0, 32);
}
function verifyCsrf(req) {
  var token = req.cookies && req.cookies.session_token;
  var csrfHeader = req.headers['x-csrf-token'];
  if (!token || !csrfHeader) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(csrfHeader), Buffer.from(generateCsrfToken(token)));
  } catch (e) { return false; }
}

function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) return next();
  if (!verifySession(req)) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireCsrf(req, res, next) {
  if (!AUTH_ENABLED) return next();
  if (!verifyCsrf(req)) return res.status(403).json({ error: 'Invalid CSRF token' });
  next();
}

// ── AUTH ROUTES ──
app.post('/api/auth/login', authLimiter, function(req, res) {
  if (!AUTH_ENABLED) {
    return res.json({ ok: true, csrf_token: 'open-mode', open_mode: true });
  }
  var password = req.body && req.body.password;
  if (!password || typeof password !== 'string') return res.status(400).json({ error: 'Password required' });

  var input = Buffer.from(password);
  var expected = Buffer.from(AUTH_PASSWORD);
  var match = false;
  if (input.length === expected.length) match = crypto.timingSafeEqual(input, expected);
  if (!match) return res.status(401).json({ error: 'Invalid password' });

  var token = generateSessionToken();
  var sig = signToken(token);
  var cookieOpts = {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
  res.cookie('session_token', token, cookieOpts);
  res.cookie('session_sig', sig, cookieOpts);
  return res.json({ ok: true, csrf_token: generateCsrfToken(token) });
});

app.get('/api/auth/check', function(req, res) {
  if (!AUTH_ENABLED) {
    return res.json({ authenticated: true, open_mode: true, csrf_token: 'open-mode' });
  }
  if (!verifySession(req)) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, csrf_token: generateCsrfToken(req.cookies.session_token) });
});

app.post('/api/auth/logout', function(req, res) {
  res.clearCookie('session_token', { path: '/' });
  res.clearCookie('session_sig', { path: '/' });
  return res.json({ ok: true });
});

// ── ROUTERS ──
app.use('/api', requireAuth, requireCsrf, showfilesRouter);
app.use('/api', requireAuth, requireCsrf, importExportRouter);

// ── STATIC + SPA FALLBACK ──
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', function(req, res) {
  if (req.path.indexOf('/api/') === 0) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, function() {
  console.log('Showfile Tracker running on port ' + PORT + ' (' + NODE_ENV + ')');
  console.log('Auth: ' + (AUTH_ENABLED ? 'enabled (AUTH_PASSWORD set)' : 'OPEN MODE (set AUTH_PASSWORD to gate)'));
});
