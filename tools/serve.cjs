const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'};
function startServer(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.')) || relative.split(path.sep).includes('node_modules')) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      const data = await fs.readFile(file);
      res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
if (require.main === module) startServer(Number(process.env.PORT || 4173)).then(server => console.log(`NABNAK: http://127.0.0.1:${server.address().port}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {startServer};
