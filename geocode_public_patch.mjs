export function installPublicGeocode(app) {
  const UA = 'navio-ai/1.0 (+https://navio-ai.vercel.app)';
  app.get('/api/geocode', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.status(400).json({ ok: false, error: 'missing_q' });

      const u = new URL('https://nominatim.openstreetmap.org/search');
      u.searchParams.set('q', q);
      u.searchParams.set('format', 'json');
      u.searchParams.set('limit', '1');
      u.searchParams.set('addressdetails', '0');
      u.searchParams.set('email', 'navio.local@invalid');

      const r = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'nominatim_'+r.status });
      const arr = await r.json().catch(() => null);
      if (!Array.isArray(arr) || !arr.length) return res.status(404).json({ ok: false, error: 'not_found' });

      const { lat, lon } = arr[0];
      res.json({ ok: true, lat: Number(lat), lon: Number(lon) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });
}
