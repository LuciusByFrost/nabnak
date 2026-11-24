/* Real Chromium validation. This suite never uses the user's browser profile. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {startServer} = require('../../tools/serve.cjs');
const output = path.resolve(__dirname, '../../artifacts/ui');
const report = {status: 'not-run', screenshots: [], checks: [], startedAt: new Date().toISOString()};
let browser, server;

async function menu(page) {
  if (await page.locator('#language-toggle').getAttribute('aria-expanded') === 'false') await page.locator('#language-toggle').click();
  await page.locator('#language-panel').waitFor({state: 'visible'});
}
async function navigate(page, view) {
  await menu(page);
  await page.locator('#open-' + view).click();
  const target = {tasks: '.workspace', calendar: '#calendar-dialog', goals: '#goals-dialog', mindmaps: '#mindmap-view'}[view];
  await page.locator(target).waitFor({state: 'visible'});
  assert.equal(await page.locator('#open-' + view).getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('.workspace:visible, .planner-view:visible, .mm-view:visible').count(), 1);
}
async function layout(page) {
  const dimensions = await page.evaluate(() => ({width: innerWidth, content: document.documentElement.scrollWidth}));
  assert.ok(dimensions.content <= dimensions.width + 1, `Horizontal overflow: ${JSON.stringify(dimensions)}`);
  const unnamed = await page.locator('button:visible, input:visible, select:visible, textarea:visible, summary:visible').evaluateAll(elements => elements.filter(el => {
    const labelledBy = el.getAttribute('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
    const name = el.getAttribute('aria-label') || labelledBy || Array.from(el.labels || []).map(label => label.textContent).join(' ') || (['BUTTON', 'SUMMARY'].includes(el.tagName) ? el.textContent : '');
    return !name?.trim();
  }).map(el => el.id || el.outerHTML.slice(0, 120)));
  assert.deepEqual(unnamed, [], 'All visible controls must have accessible names');
  const contrasts = await page.locator('.workspace-header p:visible, .card .content:visible, .task-filters label > span:visible, .calendar-week:visible, .day-count:visible, .goal-card h2:visible, .mm-node-title:visible, .mm-node-description:visible').evaluateAll(elements => {
    const rgba = value => { const numbers = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0]; return [...numbers.slice(0, 3), numbers[3] ?? 1]; };
    const blend = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
    const lum = rgb => rgb.reduce((sum, c, i) => { const v = c / 255; return sum + [.2126, .7152, .0722][i] * (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); }, 0);
    return elements.map(el => {
      const backgrounds = []; for (let node = el; node; node = node.parentElement) backgrounds.unshift(rgba(getComputedStyle(node).backgroundColor));
      const bg = backgrounds.reduce((base, color) => blend(color, base), [255, 255, 255]);
      const style = getComputedStyle(el), color = blend(rgba(style.color), bg), values = [lum(bg), lum(color)].sort((a, b) => b - a);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.666 && Number(style.fontWeight) >= 700);
      return {text: el.textContent.slice(0, 60), ratio: (values[0] + .05) / (values[1] + .05), minimum: large ? 3 : 4.5};
    }).filter(item => item.ratio < item.minimum);
  });
  assert.deepEqual(contrasts, [], 'Representative rendered text must have sufficient contrast');
}
async function capture(page, name) {
  await layout(page);
  const file = path.join(output, name + '.png');
  await page.screenshot({path: file, fullPage: true, animations: 'disabled'});
  report.screenshots.push(path.relative(path.resolve(__dirname, '../..'), file));
}
async function seed(context, theme, language = 'pt-BR') {
  await context.addInitScript(({theme, language}) => {
    if (sessionStorage.getItem('nabnak.audit-seeded')) return;
    sessionStorage.setItem('nabnak.audit-seeded', 'true');
    const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('nabnak.theme', theme);
    localStorage.setItem('nabnak.language', language);
    localStorage.setItem('nabnak.data', JSON.stringify({version: 2, custom: 'preserved', goals: [
      {id: 'study', title: 'Estudo e aprendizado', description: 'Avançar com consistência.', dueDate: '2099-12-31', target: 3},
      {id: 'work', title: 'Entrega do projeto', description: 'Revisar os próximos passos.', dueDate: '2099-12-31', target: 2}
    ], tasks: [
      {id: 'read', title: 'Revisar o capítulo e registrar as ideias principais', status: 'todo', dueDate: today, goalId: 'study', custom: 'keep'},
      {id: 'notes', title: 'Organizar as anotações da semana', status: 'todo', dueDate: null, goalId: null},
      {id: 'review', title: 'Preparar uma revisão detalhada do projeto com um título longo para conferir a quebra de linhas nos cartões', status: 'doing', dueDate: '2000-01-01', goalId: 'work'},
      {id: 'done', title: 'Definir as prioridades', status: 'done', dueDate: today, goalId: 'study'}
    ]}));
  }, {theme, language});
}
async function scenario(context, label, theme, mobile) {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'networkidle'});
  assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
  await page.locator('#quick-todo').fill('Tarefa rápida auditada');
  await page.locator('#quick-todo').press('Enter');
  assert.equal(await page.locator('.card').count(), 5);
  const dataBefore = await page.evaluate(() => localStorage.getItem('nabnak.data'));
  await page.locator('#task-search').fill('RAPIDA');
  await page.locator('#filter-status').selectOption('todo');
  await page.locator('#filter-goal').selectOption('__none');
  await page.locator('#filter-deadline').selectOption('noDate');
  assert.equal(await page.locator('.card').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('nabnak.data')), dataBefore);
  await page.locator('.card-move select').selectOption('doing');
  assert.equal(await page.locator('.card').count(), 0);
  await page.locator('#clear-filters').click();
  await page.locator('.card').filter({hasText: 'Tarefa rápida auditada'}).locator('.card-edit').click();
  await page.locator('#edit-task-title').fill('Tarefa rápida auditada — revisão');
  await page.locator('#task-editor-form button[type="submit"]').click();
  await page.locator('.card').filter({hasText: 'Tarefa rápida auditada — revisão'}).locator('.card-edit').click();
  await page.locator('#edit-task-title').fill('Tarefa rápida auditada');
  await page.locator('#task-editor-form button[type="submit"]').click();
  await page.locator('#quick-doing').fill('Excluir somente esta tarefa');
  await page.locator('#quick-doing').press('Enter');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.card').filter({hasText: 'Excluir somente esta tarefa'}).locator('.card-delete').click();
  assert.equal(await page.locator('.card').count(), 6);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.card').filter({hasText: 'Excluir somente esta tarefa'}).locator('.card-delete').click();
  assert.equal(await page.locator('.card').count(), 5);
  await page.locator('#task-search').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filter-deadline');
  assert.equal(await page.locator('.card').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await capture(page, label + '-tasks');
  await navigate(page, 'calendar');
  await page.locator('#calendar-month').fill('2024-02');
  await page.locator('#calendar-month').press('Tab');
  assert.equal(await page.locator('.calendar-day').count(), 29);
  await page.locator('[data-date="2024-02-29"]').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#calendar-month').inputValue(), '2024-03');
  await page.locator('#calendar-today').click();
  await page.locator('#calendar-new-task').click();
  await page.locator('#edit-task-title').fill('Criada pelo calendário');
  await page.locator('#edit-task-goal').selectOption('study');
  await page.locator('#task-editor-form button[type="submit"]').click();
  assert.equal(await page.locator('#task-dialog').isVisible(), false);
  await capture(page, label + '-calendar');
  await navigate(page, 'goals');
  assert.equal(await page.locator('.goal-card').count(), 2);
  await capture(page, label + '-goals');
  await navigate(page, 'mindmaps');
  await page.locator('#mm-add').click();
  await page.locator('#mm-details-toggle').click();
  // Open the inspector when the desktop toggle above closed it.
  if (await page.locator('#mm-inspector').isHidden()) await page.locator('#mm-details-toggle').click();
  await page.locator('#mm-title').fill('Ideia para o projeto');
  await page.locator('#mm-title').press('Tab');
  await page.locator('#mm-description').fill('Uma descrição que deve sobreviver à troca de vistas.');
  await navigate(page, 'calendar');
  await navigate(page, 'mindmaps');
  const description = await page.evaluate(() => NabnakMindmaps.store.getState().maps[0].nodes.find(node => node.title === 'Ideia para o projeto').description);
  assert.ok(description.includes('sobreviver'));
  await page.locator('#mm-child').click();
  await page.locator('#mm-add').click();
  const count = await page.locator('.mm-node').count();
  await page.locator('#mm-undo').click(); assert.equal(await page.locator('.mm-node').count(), count - 1);
  await page.locator('#mm-redo').click(); assert.equal(await page.locator('.mm-node').count(), count);
  await page.locator('#mm-move-right').click();
  await page.locator('#mm-organize').click();
  if (mobile) await page.locator('#mm-details-toggle').click();
  await page.locator('#mm-fit').click();
  await capture(page, label + '-mindmaps');
  await page.locator('.mm-file-menu summary').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#mm-export').click();
  const download = await downloadEvent;
  const exported = await fs.readFile(await download.path(), 'utf8');
  assert.ok(JSON.parse(exported));
  const mapsBefore = await page.evaluate(() => NabnakMindmaps.store.getState().maps.length);
  const chooserEvent = page.waitForEvent('filechooser');
  await page.locator('#mm-import').click();
  await (await chooserEvent).setFiles({name: 'audit-map.json', mimeType: 'application/json', buffer: Buffer.from(exported)});
  await page.waitForFunction(count => NabnakMindmaps.store.getState().maps.length > count, mapsBefore);
  await navigate(page, 'tasks');
  await menu(page);
  for (const language of ['en', 'es', 'pt-BR']) {
    await page.locator(`input[name="language"][value="${language}"]`).check();
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    assert.equal(await page.locator('[data-task-id="read"] .content').textContent(), 'Revisar o capítulo e registrar as ideias principais');
  }
  await page.locator('#theme-select').selectOption(theme === 'dark' ? 'light' : 'dark');
  await page.locator('#theme-select').selectOption('system');
  await page.emulateMedia({colorScheme: theme === 'dark' ? 'light' : 'dark'});
  await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme === 'dark' ? 'light' : 'dark');
  await page.locator('#theme-select').selectOption(theme);
  if (mobile) {
    await page.locator('#skin-midnight').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'language-toggle');
    await page.keyboard.press('Escape');
  } else {
    await page.locator('#language-toggle').click();
    await page.reload({waitUntil: 'networkidle'});
    assert.equal(await page.locator('#language-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('#language-toggle').click();
  }
  await layout(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nabnak.data')));
  assert.equal(saved.custom, 'preserved');
  assert.equal(saved.tasks.find(task => task.id === 'read').custom, 'keep');
  assert.ok(saved.tasks.some(task => task.title === 'Tarefa rápida auditada' && task.status === 'doing'));
  assert.deepEqual(errors, [], 'No uncaught application errors');
  report.checks.push(label + ': CRUD, filters, navigation, calendar, maps, import/export, languages, preferences and layout');
  await page.close();
}
async function main() {
  await fs.mkdir(output, {recursive: true});
  let chromium;
  try { ({chromium} = require('playwright')); }
  catch {
    report.status = 'blocked';
    throw new Error('Playwright is not installed. Run npm.cmd install, then npx.cmd playwright install chromium. No browser validation or screenshots were produced.');
  }
  server = await startServer();
  try {
    browser = await chromium.launch({headless: process.env.HEADED !== '1', ...(process.env.NABNAK_BROWSER_EXECUTABLE ? {executablePath: process.env.NABNAK_BROWSER_EXECUTABLE} : {})});
  } catch (error) { report.status = 'blocked'; throw error; }
  for (const [device, viewport, mobile] of [['desktop', {width: 1440, height: 1000}, false], ['mobile', {width: 375, height: 812}, true]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({viewport, isMobile: mobile, hasTouch: mobile, colorScheme: theme, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', acceptDownloads: true});
      await seed(context, theme);
      await scenario(context, device + '-' + theme, theme, mobile);
      await context.close();
    }
  }
  for (const [width, height] of [[320, 740], [768, 1024], [812, 375], [2560, 1440]]) {
    const context = await browser.newContext({viewport: {width, height}, reducedMotion: 'reduce'});
    await seed(context, 'light', 'es');
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'networkidle'});
    for (const view of ['tasks', 'calendar', 'goals', 'mindmaps']) { await navigate(page, view); await layout(page); }
    report.checks.push(`Responsive ${width}x${height}: all views, Spanish labels`);
    await context.close();
  }
  report.status = 'passed';
}
if (require.main === module) main().catch(error => {
  if (report.status !== 'blocked') report.status = 'failed';
  report.error = error.stack || String(error); console.error(report.error); process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  await fs.mkdir(output, {recursive: true});
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Browser validation: ${report.status}. Screenshots: ${report.screenshots.length}. Report: ${path.join(output, 'report.json')}`);
});
module.exports = {menu, navigate, layout, seed};
