const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf'};
const inside = (base, file) => { const rel = path.relative(base, file); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
async function startServer(port = 0) {
  const canonicalRoot = await fs.realpath(root);
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  // Snapshot public asset names. Never expose tools, tests, docs, manifests or dotfiles.
  const publicFiles = new Set(['index.html']);
  async function collect(dir) {
    for (const entry of await fs.readdir(path.join(root, dir), {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const relative = dir + '/' + entry.name;
      if (entry.isDirectory()) await collect(relative);
      else if (entry.isFile() && types[path.extname(entry.name).toLowerCase()]) publicFiles.add(relative);
    }
  }
  for (const dir of ['js', 'css', 'assets', 'icons']) await collect(dir);
  const server = http.createServer(async (req, res) => {
    const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': csp + "; frame-ancestors 'none'"};
    const respond = (code, message) => { res.writeHead(code, {...headers, 'Content-Type': 'text/plain; charset=utf-8'}); res.end(message); };
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); respond(405, 'Method not allowed'); return; }
    if (![`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`].includes(req.headers.host)) { respond(403, 'Forbidden'); return; }
    try {
      const pathname = decodeURIComponent(req.url.split('?')[0]);
      if (!pathname.startsWith('/') || /[\\\0]/.test(pathname) || pathname.split('/').some(part => part === '..' || part === '.')) { respond(403, 'Forbidden'); return; }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!publicFiles.has(relative)) { respond(404, 'Not found'); return; }
      const file = path.resolve(root, relative), canonical = await fs.realpath(file);
      if (!inside(canonicalRoot, canonical)) { respond(403, 'Forbidden'); return; }
      let part = root;
      for (const segment of relative.split('/')) { part = path.join(part, segment); if ((await fs.lstat(part)).isSymbolicLink()) { respond(403, 'Forbidden'); return; } }
      const handle = await fs.open(canonical, 'r');
      try {
        if (!(await handle.stat()).isFile()) { respond(404, 'Not found'); return; }
        const data = req.method === 'HEAD' ? null : await handle.readFile();
        res.writeHead(200, {...headers, 'Content-Type': types[path.extname(canonical).toLowerCase()]}); res.end(data);
      } finally { await handle.close(); }
    } catch { if (!res.headersSent) respond(404, 'Not found'); else res.end(); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
if (require.main === module) startServer(Number(process.env.PORT || 4173)).then(server => console.log(`NABNAK: http://127.0.0.1:${server.address().port}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {startServer};
