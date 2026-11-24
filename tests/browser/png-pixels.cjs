// Exact PNG raster comparison, independent of compression and ancillary metadata.
const {inflateSync, deflateSync} = require('node:zlib');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('Invalid PNG signature');
  let width, height, channels, ended = false;
  const parts = [];
  for (let offset = 8; offset < buffer.length;) {
    const size = buffer.readUInt32BE(offset), kind = buffer.toString('ascii', offset + 4, offset + 8);
    if (offset + size + 12 > buffer.length) throw new Error('Truncated PNG');
    const data = buffer.subarray(offset + 8, offset + 8 + size);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = {2: 3, 6: 4}[data[9]];
      if (!width || !height || data[8] !== 8 || !channels || data[10] || data[11] || data[12]) throw new Error('Expected non-interlaced 8-bit RGB/RGBA screenshot');
    }
    if (kind === 'IDAT') parts.push(data);
    if (kind === 'IEND') { ended = true; break; }
    offset += size + 12;
  }
  if (!ended || !channels || !parts.length) throw new Error('Incomplete PNG');
  const raw = inflateSync(Buffer.concat(parts)), stride = width * channels;
  if (raw.length !== (stride + 1) * height) throw new Error('Invalid PNG raster size');
  const raster = Buffer.alloc(stride * height), rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? raster[y * stride + x - channels] : 0;
      const up = y ? raster[(y - 1) * stride + x] : 0;
      const corner = y && x >= channels ? raster[(y - 1) * stride + x - channels] : 0;
      const p = left + up - corner, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
      const paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      const prediction = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      raster[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  for (let pixel = 0; pixel < width * height; pixel++) {
    raster.copy(rgba, pixel * 4, pixel * channels, pixel * channels + 3);
    rgba[pixel * 4 + 3] = channels === 4 ? raster[pixel * channels + 3] : 255;
  }
  return {width, height, data: rgba};
}
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(kind, data) {
  const type = Buffer.from(kind), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
function encodePng({width, height, data}, options = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const stride = width * 4, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([signature, chunk('IHDR', header), ...(options.note ? [chunk('tEXt', Buffer.from('Note\0' + options.note))] : []), chunk('IDAT', deflateSync(raw, {level: options.level ?? 6})), chunk('IEND', Buffer.alloc(0))]);
}
function comparePng(actual, expected) {
  const a = decodePng(actual), b = decodePng(expected);
  if (a.width !== b.width || a.height !== b.height) return {equal: false, dimensions: {actual: [a.width, a.height], expected: [b.width, b.height]}, changedPixels: null};
  const diff = Buffer.alloc(a.data.length); let changedPixels = 0, maxChannelDelta = 0, minX = a.width, minY = a.height, maxX = -1, maxY = -1;
  for (let pixel = 0; pixel < a.width * a.height; pixel++) {
    let different = false;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(a.data[pixel * 4 + c] - b.data[pixel * 4 + c]);
      if (delta) different = true;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
    }
    if (different) {
      changedPixels++; const x = pixel % a.width, y = Math.floor(pixel / a.width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      diff[pixel * 4] = 255; diff[pixel * 4 + 2] = 255;
    }
    diff[pixel * 4 + 3] = 255;
  }
  return {equal: changedPixels === 0, changedPixels, maxChannelDelta, bounds: changedPixels ? {minX, minY, maxX, maxY} : null, diff: encodePng({width: a.width, height: a.height, data: diff})};
}
function compareSequence(buffers) {
  if (buffers.length < 2) throw new Error('At least two frames are required to measure repeatability');
  const comparisons = buffers.slice(1).map(buffer => {
    const {diff, ...result} = comparePng(buffers[0], buffer); return result;
  });
  return {stable: comparisons.every(item => item.equal), comparisons};
}
module.exports = {decodePng, encodePng, comparePng, compareSequence};
