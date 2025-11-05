const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { randomUUID } = require('node:crypto');

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

const sessions = new Map();

function getToken(req){
  const a = req.headers.authorization;
  if (a && a.startsWith('Bearer ')) return a.slice(7);
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function requireAuth(req,res,next){
  const t = getToken(req);
  if (!t) return res.status(401).json({ ok:false, error:'NO_TOKEN' });
  const u = sessions.get(t);
  if (!u) return res.status(401).json({ ok:false, error:'BAD_TOKEN' });
  req.user = u;
  next();
}

app.post('/api/auth/login', (req,res)=>{
  const { username, password } = req.body || {};
  const u = (username || 'dev').toLowerCase();
  const user = { id: u, name: u.charAt(0).toUpperCase()+u.slice(1), role: u==='patrick' ? 'lager' : 'dispo' };
  const token = randomUUID();
  sessions.set(token, user);
  res.setHeader('Set-Cookie', `auth_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax`);
  res.json({ ok:true, token, user });
});

app.post('/api/auth/logout', (req,res)=>{
  const t = getToken(req);
  if (t) sessions.delete(t);
  res.setHeader('Set-Cookie', 'auth_token=; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ ok:true });
});

app.get('/api/auth/me', (req,res)=>{
  const t = getToken(req);
  if (!t) return res.status(401).json({ ok:false });
  const u = sessions.get(t);
  if (!u) return res.status(401).json({ ok:false });
  res.json({ ok:true, user:u });
});

const UPLOAD_ROOT = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT, { fallthrough: false }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = String(req.query.orderId || 'unknown');
    const dir = path.join(UPLOAD_ROOT, 'orders', orderId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/upload/order-photo', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'NO_FILE' });
  const orderId = String(req.query.orderId || 'unknown');
  const relPath = path.relative(UPLOAD_ROOT, req.file.path).split(path.sep).join('/');
  const url = `/uploads/${relPath}`;
  res.json({ ok: true, orderId, url });
});

app.get('/api/health', (_req,res) => res.json({ ok:true }));

app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));
