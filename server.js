const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 8787;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

const storage = multer.memoryStorage();
const upload = multer({ storage });

if (!global.sessions) global.sessions = new Map();

function getToken(req){
  const a = req.headers.authorization;
  if (a && a.startsWith('Bearer ')) return a.slice(7);
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function cookieFlags() {
  const isProd = process.env.NODE_ENV === 'production';
  return isProd ? 'Path=/; SameSite=None; Secure; HttpOnly' : 'Path=/; SameSite=Lax; HttpOnly';
}

app.post('/api/auth/login', (req,res)=>{
  const { username } = req.body || {};
  const u = (username || 'dev').toLowerCase();
  const role = u==='patrick' ? 'lager' : (u==='dev' ? 'admin' : 'dispo');
  const user = { id: u, name: u.charAt(0).toUpperCase()+u.slice(1), role };
  const token = randomUUID();
  global.sessions.set(token, user);
  res.setHeader('Set-Cookie', `auth_token=${encodeURIComponent(token)}; ${cookieFlags()}`);
  res.json({ ok:true, token, user });
});

app.get('/api/auth/me', (req,res)=>{
  const t = getToken(req);
  const u = t ? global.sessions.get(t) : null;
  if (!u) return res.status(401).json({ ok:false });
  res.json({ ok:true, user:u });
});

app.post('/api/auth/logout', (req,res)=>{
  const t = getToken(req);
  if (t) global.sessions.delete(t);
  res.setHeader('Set-Cookie', `auth_token=; ${cookieFlags()}; Max-Age=0`);
  res.json({ ok:true });
});

app.post('/api/upload/order-photo', upload.single('file'), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ ok:false, error:'NO_FILE' });
  const orderId = String(req.query.orderId || 'unknown');
  const public_id = `orders/${orderId}/${Date.now()}-${randomUUID()}`;
  const stream = cloudinary.uploader.upload_stream(
    { public_id, overwrite: false, resource_type: 'image' },
    (err, result) => {
      if (err) return res.status(500).json({ ok:false, error:'UPLOAD_FAILED' });
      return res.json({ ok:true, orderId, url: result.secure_url, public_id: result.public_id });
    }
  );
  stream.end(f.buffer);
});

// Geocode-Proxy (Nominatim)
app.get('/api/geocode', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ ok:false, error:'NO_QUERY' });
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'NavioAI/1.0 (contact: demo@example.com)',
        'Accept-Language': 'de-DE'
      }
    });
    if (!r.ok) return res.status(502).json({ ok:false, error:'GEOCODER_BAD_RESPONSE' });
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) return res.status(404).json({ ok:false, error:'NOT_FOUND' });
    const { lat, lon, display_name } = arr[0] || {};
    return res.json({ ok:true, lat: Number(lat), lon: Number(lon), name: display_name });
  } catch {
    return res.status(500).json({ ok:false, error:'GEOCODER_ERROR' });
  }
});

app.get('/api/health', (_req,res)=> res.json({ ok:true }));

app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));
