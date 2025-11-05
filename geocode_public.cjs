module.exports = function installPublicGeocode(app) {
  const UA = 'navio-ai/1.0 (+https://navio-ai.vercel.app)';
  app.get('/api/geocode', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.status(400).json({ error: 'missing_q' });

      const u = new URL('https://nominatim.openstreetmap.org/search');
      u.searchParams.set('q', q);
      u.searchParams.set('format', 'json');
      u.searchParams.set('limit', '1');
      u.searchParams.set('addressdetails', '0');
      u.searchParams.set('email', 'navio.local@invalid');

      const r = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
      if (!r.ok) return res.status(502).json({ error: 'nominatim_'+r.status });

      const arr = await r.json().catch(() => null);
      if (!Array.isArray(arr)) return res.status(500).json({ error: 'bad_json' });

      // WICHTIG: exakt das Nominatim-Array zurückgeben
      res.json(arr);
    } catch (e) {
      res.status(500).json({ error: String(e && e.message || e) });
    }
  });
};
