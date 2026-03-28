const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const fs = require('fs');
const { startPipeline, stopPipeline, getPipelineStatus } = require('./ogm_materyal/getQuestions');

// Proje root dizininden .env dosyasını Express için de okuyalım
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_GITHUB_USERNAME || 'yaso09';

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy_id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_secret',
    callbackURL: `http://localhost:${PORT}/auth/github/callback`
  },
  function(accessToken, refreshToken, profile, done) {
    if (profile.username !== ADMIN_USERNAME) {
      return done(null, false, { message: 'Sadece yetkili admin bu panele erişebilir.' });
    }
    return done(null, profile);
  }
));

app.use(session({ secret: 'katip-pipeline-academic', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Giriş Ekranı (Public)
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Yönetici Girişi - Katip Pipeline</title>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #faf9f6; margin: 0; color: #333; }
        .login-box { text-align: center; padding: 50px 40px; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); max-width: 400px; width: 90%; }
        .btn { display: inline-block; margin-top: 25px; padding: 12px 24px; background: #2d3748; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; transition: background 0.2s; border: 1px solid #1a202c; }
        .btn:hover { background: #1a202c; }
        h2 { margin-top: 0; font-weight: 600; font-family: 'Crimson Pro', serif; font-size: 28px; color: #2d3748; margin-bottom: 10px; }
        p { color: #718096; font-size: 14px; line-height: 1.5; margin-bottom: 0; }
        .footer-note { margin-top: 30px; font-size: 0.75rem; color: #a0aec0; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h2>Katip Pipeline</h2>
        <p>Otonom aktarım sistemine devam etmek için <b>${ADMIN_USERNAME}</b> GitHub hesabı ile giriş yapmalısınız.</p>
        <a href="/auth/github" class="btn">GitHub ile Giriş Yap</a>
        <div class="footer-note">Sadece yöneticiler yetkili işlem yapabilir.</div>
      </div>
    </body>
    </html>
  `);
});

// Auth Routes
app.get('/auth/github', passport.authenticate('github', { scope: [ 'user:email' ] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => { res.redirect('/login'); });
});

// Middleware
function ensureAuthenticated(req, res, next) {
  // Eğer GitHub Client ID henüz yoksa, test için korumayı es geç (Opsiyonel ama mantıklı)
  if (process.env.GITHUB_CLIENT_ID === 'dummy_id' || !process.env.GITHUB_CLIENT_ID) return next(); 
  
  if (req.isAuthenticated()) return next();
  
  // API route'unda isek 401 dön, normal sayfada isek redirect yap
  if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: "Unauthorized" });
  } else {
      res.redirect('/login');
  }
}

// Güvenli Arayüz (Dashboard)
app.use('/', ensureAuthenticated, express.static(path.join(__dirname, '..', 'public')));

// Güvenli API Rotaları
app.use('/api', ensureAuthenticated);

app.get('/api/status', (req, res) => {
  res.json(getPipelineStatus());
});

app.post('/api/start', (req, res) => {
  startPipeline(); 
  res.json({ success: true, message: "Sistem başlatılıyor..." });
});

app.post('/api/stop', (req, res) => {
  stopPipeline();
  res.json({ success: true, message: "Durdurma sinyali gönderildi." });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🌐 Katip Pipeline Dashboard Aktif!`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
