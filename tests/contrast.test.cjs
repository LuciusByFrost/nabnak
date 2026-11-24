const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/tokens.css'), 'utf8');
const parse = block => Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));
const light = parse(css.split(':root[data-theme="dark"]')[0]);
const dark = {...light, ...parse(css.split(':root[data-theme="dark"]')[1])};
const skins = fs.readFileSync(path.join(__dirname, '../css/themes.css'), 'utf8');
const cafe = {...light, ...parse(skins.match(/:root\[data-skin="lofi-cafe"\]\s*\{([^}]+)\}/)[1])};
const midnight = {...dark, ...parse(skins.match(/:root\[data-skin="lofi-midnight"\]\s*\{([^}]+)\}/)[1])};
function luminance(hex) {
  return [.2126, .7152, .0722].reduce((sum, weight, i) => {
    const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return sum + weight * (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  }, 0);
}
for (const [theme, tokens] of [['light', light], ['dark', dark], ['lofi-cafe', cafe], ['lofi-midnight', midnight]]) {
  test(`${theme} semantic text pairs meet 4.5:1 and focus/control borders meet 3:1`, () => {
    const pairs = [
      ...['--bg', '--surface', '--surface-soft'].flatMap(bg => ['--text', '--muted', '--danger', '--success', '--warning', '--accent'].map(fg => [fg, bg, 4.5])),
      ['--accent-ink', '--accent-solid', 4.5], ['--focus', '--surface', 3], ['--control-border', '--surface', 3], ['--control-border', '--bg', 3]
    ];
    if (tokens['--sidebar']) {
      for (const foreground of ['--text', '--muted', '--accent']) pairs.push([foreground, '--sidebar', 4.5]);
      pairs.push(['--text', '--accent-soft', 4.5], ['--accent', '--accent-soft', 4.5], ['--focus', '--sidebar', 3]);
      for (const role of ['success', 'danger', 'warning']) pairs.push([`--${role}`, `--${role}-soft`, 4.5]);
      pairs.push(['--accent-ink', '--accent-hover', 4.5]);
      pairs.push(['--positive-fill', '--surface-soft', 3]);
    }
    for (const [fg, bg, minimum] of pairs) {
      const values = [luminance(tokens[fg]), luminance(tokens[bg])].sort((a, b) => b - a);
      const ratio = (values[0] + .05) / (values[1] + .05);
      assert.ok(ratio >= minimum, `${theme}: ${fg}/${bg} = ${ratio.toFixed(2)}, minimum ${minimum}`);
    }
  });
}
