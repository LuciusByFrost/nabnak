// Test-only state management: screenshot/scrollIntoView must not change the next measurement.
async function readScrollState(page) {
  return page.evaluate(() => {
    const pathFor = element => {
      if (element.id) return '#' + CSS.escape(element.id);
      const parts = [];
      for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
        const index = Array.from(node.parentElement.children).indexOf(node) + 1;
        parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
      }
      return 'html > ' + parts.join(' > ');
    };
    return {
      window: {x: scrollX, y: scrollY}, viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio},
      visualViewport: visualViewport ? {offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale} : null,
      containers: Array.from(document.querySelectorAll('*')).filter(element => element instanceof HTMLElement && element !== document.body && element !== document.documentElement && element.clientWidth && element.clientHeight && (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight)).map(element => ({selector: pathFor(element), x: element.scrollLeft, y: element.scrollTop}))
    };
  });
}
async function restoreScrollState(page, state) {
  await page.evaluate(state => {
    for (const item of state.containers) {
      const element = document.querySelector(item.selector);
      if (!element) throw new Error('Missing scroll container: ' + item.selector);
      element.scrollTo({left: item.x, top: item.y, behavior: 'instant'});
    }
    window.scrollTo({left: state.window.x, top: state.window.y, behavior: 'instant'});
  }, state);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function preserveState(read, restore, operation) {
  const state = await read();
  try { return await operation(state); }
  finally { await restore(state); }
}
async function withPreservedScroll(page, operation) {
  return preserveState(() => readScrollState(page), async state => {
    await restoreScrollState(page, state);
    await assertScrollState(page, state);
  }, operation);
}
async function assertScrollState(page, state) {
  const actual = await page.evaluate(state => ({
    window: {x: scrollX, y: scrollY}, viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio},
    containers: state.containers.map(saved => {
      const element = document.querySelector(saved.selector);
      return element ? {selector: saved.selector, x: element.scrollLeft, y: element.scrollTop} : null;
    }),
    visualViewport: visualViewport ? {offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale} : null
  }), state);
  const assert = require('node:assert/strict');
  assert.deepEqual(actual, state, 'Capture scroll/viewport conditions must be exactly restored before measuring');
}
module.exports = {readScrollState, restoreScrollState, assertScrollState, preserveState, withPreservedScroll};
