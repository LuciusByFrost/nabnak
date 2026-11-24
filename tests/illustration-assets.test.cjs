const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {startServer} = require('../tools/serve.cjs');
const root = path.join(__dirname, '..');
const assets = ['lofi-cafe.jpg', 'lofi-cafe-sidebar.jpg', 'lofi-midnight.jpg', 'lofi-midnight-sidebar.jpg'];
function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  for (let offset = 2; offset + 8 < bytes.length;) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1], size = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    offset += size + 2;
  }
  throw new Error('Missing JPEG size');
}
test('all four local scene assets are genuine JPEGs at desktop and sidebar resolutions', () => {
  for (const asset of assets) {
    const bytes = fs.readFileSync(path.join(root, 'assets/themes', asset));
    const sidebar = asset.includes('sidebar');
    assert.deepEqual(jpegSize(bytes), sidebar ? [480, 320] : [1200, 800]);
    assert.ok(bytes.length > 10000, `${asset}: expected a complete illustration`);
    assert.ok(bytes.length < (sidebar ? 70000 : 350000), `${asset}: asset budget exceeded`);
  }
});
test('CSS asset references resolve inside both Live Server and GitHub Pages project paths', () => {
  const css = fs.readFileSync(path.join(root, 'css/themes.css'), 'utf8');
  const urls = [...css.matchAll(/url\('([^']+\.jpg)'\)/g)].map(match => match[1]);
  assert.equal(urls.length, 4);
  for (const prefix of ['/', '/nabnak/', '/projects/nabnak/']) {
    for (const reference of urls) {
      const url = new URL(reference, `http://localhost${prefix}css/themes.css`);
      assert.ok(url.pathname.startsWith(prefix + 'assets/themes/'));
      assert.ok(fs.existsSync(path.resolve(root, 'css', reference)));
    }
  }
});
test('the local server returns every scene as image/jpeg with intact contents', async () => {
  const server = await startServer();
  try {
    for (const asset of assets) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/assets/themes/${asset}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/jpeg');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(root, 'assets/themes', asset)));
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
