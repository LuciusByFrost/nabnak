/* Runs each installed engine; REQUIRE_ALL_BROWSERS=1 makes missing engines fatal in CI. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium, firefox, webkit} = require('playwright');
const {startServer} = require('../../tools/serve.cjs');
const report = {status: 'not-run', engines: [], checks: []};
const output = path.resolve(__dirname, '../../artifacts/security');
const payload = '<img src="https://example.invalid/x" onerror="window.pwned=1"><svg onload="window.pwned=1">ação & 😀';
let server;
async function run(browser, engine) {
  const context = await browser.newContext({acceptDownloads: true});
  const page = await context.newPage(), errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:')) external.push(req.url()); });
  await page.addInitScript(() => { window.violations = []; document.addEventListener('securitypolicyviolation', event => window.violations.push(event.effectiveDirective)); });
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'networkidle'});
  await page.evaluate(payload => {
    const goal = NabnakStore.addGoal({title: payload, description: payload, dueDate: '2099-01-01', target: 1});
    NabnakStore.addTask({title: payload, goalId: goal.id});
    document.getElementById('open-goals').click();
    if (document.querySelector('.goal-card h2')?.textContent !== payload || document.querySelector('.goal-description')?.textContent !== payload || document.querySelector('.goal-card img')) throw new Error('Goal text rendering failed');
    NabnakMindmaps.open();
    NabnakMindmaps.store.edit(state => { const map = state.maps[0]; map.title = payload; map.nodes[0].title = payload; map.nodes[0].description = payload; });
  }, payload);
  assert.equal(await page.locator('.mm-node-title').first().textContent(), payload);
  assert.equal(await page.locator('.card img, .mm-node img').count(), 0);
  const svg = await page.evaluate(() => NabnakMindmaps.svgExport(NabnakMindmaps.store.getState().maps[0]));
  const svgPage = await context.newPage();
  await svgPage.route('**/export.svg', route => route.fulfill({contentType: 'image/svg+xml', body: svg}));
  await svgPage.goto(`http://127.0.0.1:${server.address().port}/export.svg`);
  assert.equal(await svgPage.locator('script, image, foreignObject').count(), 0);
  assert.equal(await svgPage.evaluate(() => window.pwned), undefined); await svgPage.close();
  await page.locator('.mm-node-title').first().dblclick();
  await page.locator('[contenteditable="true"]').evaluate((el, payload) => {
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const data = new DataTransfer(); data.setData('text/html', '<img src=x onerror="window.pwned=1">'); data.setData('text/plain', payload);
    const event = new Event('paste', {bubbles: true, cancelable: true}); Object.defineProperty(event, 'clipboardData', {value: data}); el.dispatchEvent(event);
    if (!event.defaultPrevented) throw new Error('HTML paste was not prevented');
  }, payload);
  assert.equal(await page.locator('[contenteditable="true"] img').count(), 0);
  await page.locator('[contenteditable="true"]').press('Enter');
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  const importResults = await page.evaluate(() => {
    const api = NabnakMindmaps, before = JSON.stringify(api.store.getState()), raw = localStorage.getItem('nabnak.mindmaps');
    const map = NabnakMindData.newMap('Bad', 'Root'); map.nodes[0].parentId = map.nodes[0].id;
    const inputs = ['{', ' '.repeat(NabnakSecurity.limits.bytes + 1), '{"maps":[],"__proto__":{}}', '{"version":99,"maps":[]}', JSON.stringify(map)];
    const rejected = inputs.every(text => api.importJson(text) === false);
    const unchanged = before === JSON.stringify(api.store.getState()) && raw === localStorage.getItem('nabnak.mindmaps');
    const exported = api.svgExport(api.store.getState().maps[0]);
    const original = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    const result = api.importJson(JSON.stringify({maps: [NabnakMindData.newMap('Import', 'Root')]})); Storage.prototype.setItem = original;
    return {rejected, unchanged, quotaRejected: result === false, quotaUnchanged: before === JSON.stringify(api.store.getState()), escaped: exported.includes('&lt;img')};
  });
  assert.deepEqual(importResults, {rejected: true, unchanged: true, quotaRejected: true, quotaUnchanged: true, escaped: true});
  // Exercise the real file picker, including the pre-read size gate.
  await page.evaluate(() => { window.fileReads = 0; const original = File.prototype.text; File.prototype.text = function () { window.fileReads++; return original.call(this); }; });
  for (const [name, buffer, shouldRead] of [['bad.json', Buffer.from('{"version":99,"maps":[]}'), 1], ['large.json', Buffer.alloc(2 * 1024 * 1024 + 1, 32), 0]]) {
    const count = await page.evaluate(() => window.fileReads), before = await page.evaluate(() => JSON.stringify(NabnakMindmaps.store.getState()));
    const picker = page.waitForEvent('filechooser'); await page.locator('#mm-import').click();
    await (await picker).setFiles({name, mimeType: 'application/json', buffer});
    await page.waitForFunction(count => document.getElementById('mm-message').textContent.length > 0 && window.fileReads >= count, count + shouldRead);
    assert.equal(await page.evaluate(() => window.fileReads), count + shouldRead);
    assert.equal(await page.evaluate(() => JSON.stringify(NabnakMindmaps.store.getState())), before);
  }
  assert.deepEqual(await page.evaluate(() => window.violations), [], 'ordinary application use must not violate CSP');
  assert.deepEqual(external, [], 'ordinary application use makes no external requests');
  // Direct injected code is blocked by CSP; this does not rely on browser innerHTML script inertness.
  await page.evaluate(() => {
    const script = document.createElement('script'); script.textContent = 'window.cspExecuted = true'; document.head.append(script);
    try { (0, eval)('window.evalExecuted = true'); } catch {}
    const button = document.createElement('button'); button.setAttribute('onclick', 'window.handlerExecuted = true'); document.body.append(button); button.click(); button.remove();
  });
  await page.waitForFunction(() => window.violations.length >= 3);
  assert.deepEqual(await page.evaluate(() => [window.cspExecuted, window.evalExecuted, window.handlerExecuted].map(Boolean)), [false, false, false]);
  assert.deepEqual(errors, []);
  // Corruption must survive reload verbatim.
  await page.evaluate(() => { localStorage.setItem('nabnak.data', '{broken'); localStorage.setItem('nabnak.mindmaps', '{broken'); });
  await page.reload();
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('nabnak.data'), localStorage.getItem('nabnak.mindmaps')]), ['{broken', '{broken']);
  assert.equal(await page.evaluate(() => NabnakMindmaps.store.isReadOnly()), true);
  await context.close();
  report.checks.push(`${engine}: inert text in task/goal/map fields, clipboard, SVG, malicious files, size gate, quota/atomicity, corruption, CSP and no external requests`);
}
async function main() {
  server = await startServer();
  for (const [name, type] of Object.entries({chromium, firefox, webkit})) {
    let browser;
    try { browser = await type.launch({headless: true}); }
    catch (error) {
      const missing = /Executable doesn't exist/.test(error.message);
      report.engines.push({engine: name, status: missing ? 'unavailable' : 'blocked', error: error.message});
      if (!missing || process.env.REQUIRE_ALL_BROWSERS === '1') process.exitCode = 1;
      continue;
    }
    try { await run(browser, name); report.engines.push({engine: name, status: 'passed'}); }
    catch (error) { report.engines.push({engine: name, status: 'failed', error: error.stack}); process.exitCode = 1; }
    finally { await browser.close(); }
  }
  report.status = process.exitCode ? 'incomplete' : report.engines.some(item => item.status === 'passed') ? 'passed' : 'blocked';
  if (report.status === 'blocked') process.exitCode = 1;
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await fs.mkdir(output, {recursive: true}); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
