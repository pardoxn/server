// Navio Software/server/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const fssync = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8001;

// --- Basis: ein Level über diesem file = "Navio Software"
const BASE_DIR = path.join(__dirname, "..");

// Daten unter: Navio Software/local_data
const DATA_ROOT = path.join(BASE_DIR, "local_data");

// CMR-Fallback-Layout liegt im Frontend-Paket:
const PUBLIC_CMR = path.join(BASE_DIR, "NavioAI", "public", "cmr-layout.json");

// Parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS: während Entwicklung alles erlauben (auch Handy im LAN)
app.use(cors({ origin: true, credentials: false }));

// Hilfsfunktionen
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function writeFileSafe(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
}
async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Health
app.get("/health", (_req, res) => res.json({ ok: true, base: BASE_DIR }));

/**
 * OPTIMIZE (Dummy-Optimizer)
 * Erwartet: { depot, orders:[{...}] }
 * Gibt eine Tour mit allen order_ids zurück (Reihenfolge unverändert).
 */
app.post("/optimize", async (req, res) => {
  try {
    const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
    const order_ids = orders.map(
      o => o.rowId || o.id || o.deliveryNoteNumberRaw || String(Math.random())
    );
    return res.json({ tours: [{ order_ids }] });
  } catch (e) {
    console.error("OPTIMIZE error:", e);
    res.status(500).json({ error: "optimize failed" });
  }
});

/**
 * SAVE: JSON auf Platte speichern (Autosave/Manual)
 * POST /save?bucket=autosave&key=navio.json
 * Body = JSON (App-Snapshot)
 */
app.post("/save", async (req, res) => {
  try {
    const bucket = String(req.query.bucket || "misc");
    const key = String(req.query.key || "data.json").replace(/^\//, "");
    const target = path.join(DATA_ROOT, bucket, key);
    await writeFileSafe(target, JSON.stringify(req.body ?? {}, null, 2));
    return res.json({ ok: true, savedAt: Date.now(), path: target });
  } catch (e) {
    console.error("SAVE error:", e);
    res.status(500).json({ error: "save failed" });
  }
});

/**
 * Datei lesen (z. B. CMR-Layout)
 * GET /save/file?bucket=cmr&name=layout.json
 */
app.get("/save/file", async (req, res) => {
  try {
    const bucket = String(req.query.bucket || "");
    const name = String(req.query.name || "");
    if (!bucket || !name) return res.status(400).json({ error: "missing bucket or name" });

    const fp = path.join(DATA_ROOT, bucket, name);
    if (!fssync.existsSync(fp)) return res.status(404).json({ error: "not found" });

    const raw = await fs.readFile(fp, "utf8");
    try { return res.json(JSON.parse(raw)); }
    catch { res.type("text/plain").send(raw); }
  } catch (e) {
    console.error("READ file error:", e);
    res.status(500).json({ error: "read failed" });
  }
});

/**
 * CMR-Layout – lesen & schreiben
 * GET  /api/layout/cmr
 * POST /api/layout/cmr  (Body = JSON Layout)
 * Speichert unter Navio Software/local_data/cmr/layout.json
 * Fallback-Lesen aus NavioAI/public/cmr-layout.json
 */
const CMR_LAYOUT_FILE = path.join(DATA_ROOT, "cmr", "layout.json");

app.get("/api/layout/cmr", async (_req, res) => {
  try {
    let j = await readJsonSafe(CMR_LAYOUT_FILE);
    if (!j && fssync.existsSync(PUBLIC_CMR)) {
      j = await readJsonSafe(PUBLIC_CMR);
    }
    if (!j) j = { pageWidth: 595, pageHeight: 842, fields: {} };
    res.json(j);
  } catch (e) {
    console.error("GET CMR layout error:", e);
    res.status(500).json({ error: "layout read failed" });
  }
});

app.post("/api/layout/cmr", async (req, res) => {
  try {
    const layout = req.body || {};
    await writeFileSafe(CMR_LAYOUT_FILE, JSON.stringify(layout, null, 2));
    res.json({ ok: true, savedAt: Date.now() });
  } catch (e) {
    console.error("POST CMR layout error:", e);
    res.status(500).json({ error: "layout save failed" });
  }
});

// (optional) statische Dateien, wenn du hier etwas ausliefern willst:
app.use(express.static(path.join(BASE_DIR, "NavioAI", "public")));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] DATA_ROOT = ${DATA_ROOT}`);
  console.log(`[server] PUBLIC_CMR = ${PUBLIC_CMR}`);
});
