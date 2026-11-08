// Harness: serves app/zoom with sibling sources mapped, opens in Playwright with local three. Used by build-shots.cjs
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const H = __dirname, THREE = process.env.THREE_JS || path.join(__dirname, "tests", "three.min.js");
const SRC = { "engine.js": "../live/engine.js", "data.json": "../live/data.json", "terry-bat.js": "../brand/terry-bat.js", "terry.js": "../live/terry.js", "flyover.js": "../live/flyover.js", "terry-bat3d.js": "../bat3d/terry-bat3d.js", "assets/boston-dusk.webp": "assets/boston-dusk.webp" };
const PORT = +(process.env.PORT || 8801);
const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split("?")[0]).slice(1) || "index.html", f = path.join(H, SRC[p] || p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const body = fs.readFileSync(f);
  const ct = { ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".css": "text/css", ".html": "text/html; charset=utf-8" }[path.extname(f)] || "text/javascript; charset=utf-8";
  if (p === "index.html") { r.writeHead(200, { "content-type": ct }); return r.end(`<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`); }
  r.writeHead(200, { "content-type": ct }); r.end(body);
});
const ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
async function open(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: o.w || 1440, height: o.h || 900 }, reducedMotion: o.rm ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => { window.__terrySlow = 8; try { localStorage.setItem("terry.opening", "seen"); if (!window.__tourOn) localStorage.setItem("terry.toured", "1"); } catch (e) {} });
  if (o.seen) await ctx.addInitScript(() => { try { localStorage.setItem("terry.seen", "1"); } catch (e) {} });
  if (o.noguide) await ctx.addInitScript(() => { try { localStorage.setItem("terry.guide", "off"); } catch (e) {} });   // no tour, the short guided chase
  if (o.night) await ctx.addInitScript(() => { try { localStorage.setItem("terry.theme", "night"); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.errs = errs;
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.route("**/three.min.js", r => r.fulfill({ path: THREE, contentType: "text/javascript" }));
  if (o.block) await p.route(new RegExp(o.block), r => r.abort());
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`http://localhost:${PORT}/`); return p;
}
module.exports = { open, ARGS, srv, PORT, chromium, sleep: ms => new Promise(r => setTimeout(r, ms)), OUT: path.join(H, "shots", process.env.SHOTS || "build") };
