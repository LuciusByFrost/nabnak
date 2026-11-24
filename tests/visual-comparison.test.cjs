const test = require('node:test');
const assert = require('node:assert/strict');
const {decodePng, encodePng, comparePng, compareSequence} = require('./browser/png-pixels.cjs');
const image = {width: 2, height: 1, data: Buffer.from([20, 30, 40, 255, 50, 60, 70, 255])};
test('pixel equality ignores PNG compression and metadata, never pixel differences', () => {
  const a = encodePng(image, {level: 0, note: 'first'}), b = encodePng(image, {level: 9, note: 'second'});
  assert.equal(a.equals(b), false);
  assert.equal(comparePng(a, b).equal, true);
  assert.equal(comparePng(a, b).changedPixels, 0);
  const changed = {...image, data: Buffer.from(image.data)}; changed.data[4]++;
  const result = comparePng(a, encodePng(changed));
  assert.equal(result.equal, false); assert.equal(result.changedPixels, 1); assert.equal(result.maxChannelDelta, 1);
  assert.deepEqual(result.bounds, {minX: 1, minY: 0, maxX: 1, maxY: 0});
});
test('dimension changes and malformed screenshots cannot pass the comparison', () => {
  assert.equal(comparePng(encodePng(image), encodePng({width: 1, height: 2, data: image.data})).equal, false);
  assert.throws(() => decodePng(Buffer.from('invalid')), /Invalid PNG/);
  assert.throws(() => decodePng(encodePng(image).subarray(0, 30)));
});

test('repeated frames never hide a later one-channel rendering difference', () => {
  const a = encodePng(image), same = encodePng(image, {level: 0, note: 'same raster'});
  assert.equal(compareSequence([a, same, a, same, a]).stable, true);
  const altered = {...image, data: Buffer.from(image.data)}; altered.data[0]++;
  const result = compareSequence([a, same, a, encodePng(altered), a]);
  assert.equal(result.stable, false);
  assert.equal(result.comparisons[2].changedPixels, 1);
  assert.equal(result.comparisons[2].maxChannelDelta, 1);
  assert.throws(() => compareSequence([a]), /At least two/);
});
