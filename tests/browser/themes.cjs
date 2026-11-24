/* Appearance checks in real Chromium; isolated fixtures, no user browser data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {startServer} = require('../../tools/serve.cjs');
const {menu, navigate, layout, seed} = require('./validate.cjs');
const {comparePng, decodePng, compareSequence} = require('./png-pixels.cjs');
const {readScrollState, restoreScrollState, assertScrollState, withPreservedScroll} = require('./capture-state.cjs');
const output = path.resolve(__dirname, '../../artifacts/themes');
const report = {status: 'not-run', screenshots: [], comparisons: [], geometries: [], checks: [], failures: [], startedAt: new Date().toISOString()};
const skinIds = {original: 'skin-original', 'lofi-cafe': 'skin-cafe', 'lofi-midnight': 'skin-midnight'};
const viewSelectors = {tasks: '.workspace', calendar: '#calendar-dialog', goals: '#goals-dialog', mindmaps: '#mindmap-view'};
let browser, server;

async function closeMobileMenu(page) {
  if (page.viewportSize().width < 1100 && await page.locator('#language-toggle').getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape');
}
async function choose(page, skin) {
  await menu(page);
  await page.locator('#' + skinIds[skin]).click();
  assert.equal(await page.locator('html').getAttribute('data-skin'), skin);
  assert.equal(await page.locator('#' + skinIds[skin]).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-skin-option][aria-pressed="true"]').count(), 1);
  await closeMobileMenu(page);
}
async function contentSnapshot(page) {
  return page.evaluate(() => ['nabnak.data', 'nabnak.mindmaps', 'nabnak.language'].map(key => [key, localStorage.getItem(key)]));
}
async function sceneAssets(page, skin) {
  const sources = await page.evaluate(async () => {
    const selectors = [document.body, document.querySelector('.sidebar-preferences')];
    return Promise.all(selectors.map(async element => {
      const style = getComputedStyle(element, '::before');
      if (style.content === 'none') throw new Error('Scene layer missing');
      const source = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      if (!source) throw new Error('Local scene image missing');
      const image = new Image(); image.src = source; await image.decode();
      return {source, width: image.naturalWidth, height: image.naturalHeight};
    }));
  });
  assert.equal(sources[0].source, new URL(`assets/themes/${skin}.jpg`, page.url()).href);
  assert.equal(sources[1].source, new URL(`assets/themes/${skin}-sidebar.jpg`, page.url()).href);
  assert.deepEqual(sources.map(item => [item.width, item.height]), [[1200, 800], [480, 320]]);
}
async function capture(page, label, locator = page) {
  return withPreservedScroll(page, async () => {
  await layout(page);
  const file = path.join(output, label + '.png');
  await locator.screenshot({path: file, animations: 'disabled', ...(locator === page ? {fullPage: true} : {})});
  report.screenshots.push(path.relative(path.resolve(__dirname, '../..'), file));
  });
}
async function rasterState(page, selector) {
  return page.locator(selector).evaluate(element => {
    const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderWidth', 'borderRadius', 'boxShadow', 'outlineStyle', 'outlineWidth', 'outlineOffset', 'outlineColor', 'opacity', 'transform', 'padding', 'margin', 'appearance', 'colorScheme', 'display', 'visibility', 'fill', 'stroke', 'position', 'top', 'right', 'bottom', 'left', 'filter', 'clipPath', 'textRendering'];
    return {
      scroll: [scrollX, scrollY], viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      focused: document.activeElement?.id, fonts: document.fonts.status,
      nodes: [element, ...element.querySelectorAll('*')].map(node => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        return {tag: node.tagName, id: node.id, class: node.getAttribute('class'), date: node.getAttribute('data-date'), pressed: node.getAttribute('aria-pressed'), current: node.getAttribute('aria-current'), rect: [rect.x, rect.y, rect.width, rect.height], scroll: [node.scrollLeft ?? 0, node.scrollTop ?? 0], styles: Object.fromEntries(properties.map(key => [key, style[key]]))};
      })
    };
  });
}
async function compareOriginalPixels(page, selector, label) {
  const directory = path.join(output, 'comparisons'); await fs.mkdir(directory, {recursive: true});
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.locator(selector).scrollIntoViewIfNeeded();
  const screenshot = () => page.locator(selector).screenshot({animations: 'disabled', caret: 'hide'});
  const sampleCount = 5;
  async function samples(state) {
    const frames = [];
    for (let i = 0; i < sampleCount; i++) {
      const buffer = await screenshot(), decoded = decodePng(buffer);
      const file = path.join(directory, `${label}-${state}${i ? '-repeat-' + i : ''}.png`);
      await fs.writeFile(file, buffer);
      frames.push({buffer, file, rasterHash: `${decoded.width}x${decoded.height}:` + createHash('sha256').update(decoded.data).digest('hex')});
    }
    return frames;
  }
  const actualFrames = await samples('actual'), before = actualFrames[0].buffer, actualState = await rasterState(page, selector);
  await page.evaluate(() => { document.querySelector('link[href="./css/themes.css"]').disabled = true; });
  let baseline, expectedState, expectedFrames;
  try {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expectedFrames = await samples('expected'); baseline = expectedFrames[0].buffer; expectedState = await rasterState(page, selector);
  }
  finally { await page.evaluate(() => { document.querySelector('link[href="./css/themes.css"]').disabled = false; }); }
  const restoredFrames = await samples('restored'), restoredState = await rasterState(page, selector);
  const {diff, ...comparison} = comparePng(before, baseline);
  const paths = {actual: path.join(directory, label + '-actual.png'), expected: path.join(directory, label + '-expected.png'), state: path.join(directory, label + '-state.json')};
  await fs.writeFile(paths.actual, before); await fs.writeFile(paths.expected, baseline);
  await fs.writeFile(paths.state, JSON.stringify({selector, actual: actualState, expected: expectedState, restored: restoredState}, null, 2));
  if (!comparison.equal && diff) { paths.diff = path.join(directory, label + '-diff.png'); await fs.writeFile(paths.diff, diff); }
  const summarize = (a, b) => { const {diff, ...result} = comparePng(a, b); return result; };
  const repeatability = {
    sampleCount,
    states: Object.fromEntries([['actual', actualFrames], ['expected', expectedFrames], ['restored', restoredFrames]].map(([state, frames]) => [state, {
      frames: frames.map(({file, rasterHash}) => ({file, rasterHash})),
      ...compareSequence(frames.map(frame => frame.buffer))
    }])),
    afterRestore: summarize(before, restoredFrames[0].buffer)
  };
  const evidence = {label, selector, ...comparison, pngBytesEqual: before.equals(baseline), stylesAndGeometryEqual: JSON.stringify(actualState) === JSON.stringify(expectedState) && JSON.stringify(actualState) === JSON.stringify(restoredState), repeatability, paths};
  report.comparisons.push(evidence);
  assert.equal(evidence.stylesAndGeometryEqual, true, `Original computed styles or capture conditions changed: ${paths.state}`);
  assert.equal(Object.values(repeatability.states).every(state => state.comparisons.every(item => item.equal)), true, `Rendering unstable with unchanged stylesheet: ${label}. Inspect repeatability in report.json`);
  assert.equal(repeatability.afterRestore.equal, true, `Original raster changed after restoring stylesheet: ${label}`);
  assert.equal(comparison.equal, true, `Original module pixels must match the pre-skin styles: ${JSON.stringify(evidence)}`);
}
async function originalPixels(page, selector, label) {
  return withPreservedScroll(page, () => compareOriginalPixels(page, selector, label));
}
async function geometry(page, selector) {
  return page.locator(selector).evaluateAll(elements => elements.map(element => {
    const {x, y, width, height} = element.getBoundingClientRect();
    return [x, y, width, height].map(value => Math.round(value * 10) / 10);
  }));
}
async function scenario(device, viewport, skin) {
  const mobile = device === 'mobile';
  const context = await browser.newContext({viewport, isMobile: mobile, hasTouch: mobile, colorScheme: 'light', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce'});
  await seed(context, 'light');
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'networkidle'});
  assert.equal(await page.locator('html').getAttribute('data-skin'), 'original');
  await navigate(page, 'mindmaps');
  await page.locator('#mm-add').click(); await page.locator('#mm-child').click(); await page.locator('#mm-fit').click();
  await navigate(page, 'tasks');
  const originalData = await contentSnapshot(page);
  for (const view of ['tasks', 'calendar', 'goals', 'mindmaps']) {
    await choose(page, 'original'); await navigate(page, view);
    const selector = viewSelectors[view];
    const geometrySelector = {tasks: '.workspace-header, .task, .task-filters, .board, .card', calendar: '.calendar-layout, .calendar-month-view, .calendar-agenda', goals: '.goals-list, .goal-card', mindmaps: '.mm-view, .mm-body, .mm-viewport, .mm-toolbar'}[view];
    await page.evaluate(() => document.fonts.ready);
    const scrollOrigin = await readScrollState(page);
    const positions = await geometry(page, geometrySelector);
    if (skin === 'original') await originalPixels(page, selector, `${device}-${view}-light`);
    await choose(page, skin);
    if (skin !== 'original') await sceneAssets(page, skin);
    await restoreScrollState(page, scrollOrigin);
    await assertScrollState(page, scrollOrigin);
    const afterPositions = await geometry(page, geometrySelector);
    report.geometries.push({device, skin, view, scrollBefore: scrollOrigin, scrollAfter: await readScrollState(page), before: positions, after: afterPositions});
    assert.deepEqual(afterPositions, positions, `${skin}: ${view} positions changed`);
    await capture(page, `${device}-${skin}-${view}`);
    assert.deepEqual(await contentSnapshot(page), originalData, 'Appearance must not change saved content');
  }
  await menu(page);
  await capture(page, `${device}-${skin}-previews`, page.locator('.theme-options'));
  if (skin !== 'original') {
    assert.equal(await page.locator('#theme-select').isDisabled(), true);
    assert.equal(await page.locator('#theme-illustrations').isChecked(), true);
    await page.locator('#theme-illustrations').uncheck();
    assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element, '::before').content), 'none');
    assert.equal(await page.locator('.sidebar-preferences').evaluate(element => getComputedStyle(element, '::before').content), 'none');
    await page.reload({waitUntil: 'networkidle'});
    assert.equal(await page.locator('html').getAttribute('data-illustrations'), 'off');
    await menu(page); await page.locator('#theme-illustrations').check();
    await sceneAssets(page, skin);
    await page.reload({waitUntil: 'networkidle'});
    assert.equal(await page.locator('html').getAttribute('data-skin'), skin);
    assert.equal(await page.locator('html').getAttribute('data-illustrations'), 'on');
    await menu(page);
    await page.locator('#skin-original').click();
    assert.equal(await page.locator('#theme-select').inputValue(), 'light');
    assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element, '::before').content), 'none');
    assert.equal(await page.locator('.sidebar-preferences').evaluate(element => getComputedStyle(element, '::before').content), 'none');
  } else {
    await page.locator('#theme-select').selectOption('dark');
    await closeMobileMenu(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await originalPixels(page, viewSelectors.mindmaps, `${device}-mindmaps-dark`);
    await menu(page); await page.locator('#theme-select').selectOption('light');
  }
  await choose(page, skin);
  await menu(page);
  for (const language of ['en', 'es', 'pt-BR']) {
    await page.locator(`input[name="language"][value="${language}"]`).check();
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    assert.equal(await page.locator('#skin-cafe').textContent().then(value => value.trim()), 'Lo-fi Café');
  }
  await closeMobileMenu(page);
  await page.reload({waitUntil: 'networkidle'});
  assert.equal(await page.locator('html').getAttribute('data-skin'), skin);
  assert.deepEqual(await contentSnapshot(page), originalData);
  assert.deepEqual(errors, []);
  report.checks.push(`${device}/${skin}: all views, contrast, positions, persistence, previews, optional illustrations, languages, content integrity${skin === 'original' ? ', original pixel equivalence in light/dark' : ''}`);
  await context.close();
}
async function main() {
  await fs.mkdir(output, {recursive: true});
  let chromium;
  try { ({chromium} = require('playwright')); }
  catch { report.status = 'blocked'; throw new Error('Playwright unavailable. Run npm.cmd install and npx.cmd playwright install chromium. No theme screenshots or visual checks were performed.'); }
  server = await startServer();
  try { browser = await chromium.launch({headless: process.env.HEADED !== '1', ...(process.env.NABNAK_BROWSER_EXECUTABLE ? {executablePath: process.env.NABNAK_BROWSER_EXECUTABLE} : {})}); }
  catch (error) { report.status = 'blocked'; throw error; }
  report.environment = {browser: browser.version(), platform: process.platform, arch: process.arch, node: process.version, pixelTolerance: 0, repeatSamplesPerState: 5};
  for (const [device, viewport] of [['desktop', {width: 1440, height: 1000}], ['mobile', {width: 375, height: 812}]]) {
    for (const skin of Object.keys(skinIds)) {
      try { await scenario(device, viewport, skin); }
      catch (error) {
        const failure = {scenario: `${device}/${skin}`, error: error.stack || String(error)};
        for (const context of browser.contexts()) {
          const page = context.pages()[0];
          if (page) {
            const file = path.join(output, `${device}-${skin}-failure.png`);
            try { await page.screenshot({path: file, fullPage: true, animations: 'disabled'}); failure.screenshot = file; }
            catch (captureError) { failure.captureError = String(captureError); }
          }
          await context.close();
        }
        report.failures.push(failure);
      }
    }
  }
  if (report.failures.length) throw new Error(`${report.failures.length} theme scenarios failed. See failures and comparisons in artifacts/themes/report.json`);
  report.status = 'passed';
}
main().catch(error => {
  if (report.status !== 'blocked') report.status = 'failed';
  report.error = error.stack || String(error); console.error(report.error); process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  await fs.mkdir(output, {recursive: true});
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Theme browser validation: ${report.status}. Screenshots: ${report.screenshots.length}. Report: ${path.join(output, 'report.json')}`);
});
