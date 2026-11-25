/* Shared validation for storage, imports and edits. No HTML interpretation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabnakSecurity = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const limits = Object.freeze({bytes: 2 * 1024 * 1024, title: 500, description: 10000, maps: 30, nodes: 500, edges: 1500, tasks: 10000, goals: 1000, coordinate: 1000000, depth: 100});
  const dangerous = new Set(['__proto__', 'prototype', 'constructor']);
  function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value; }
  function fail(key = 'invalidInput') { throw new Error(key); }
  function text(value, max = limits.title, required = false) {
    if (typeof value !== 'string') fail();
    if (value.length > max) fail('inputTooLong');
    if (required && !value.trim()) fail('requiredTitle');
    return value;
  }
  function identifier(value) {
    if (typeof value !== 'string' || !/^[\p{L}\p{N}_-]{1,128}$/u.test(value) || dangerous.has(value)) fail();
    return value;
  }
  function number(value, min = -limits.coordinate, max = limits.coordinate) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail();
    return value;
  }
  function inspect(value) {
    const stack = [[value, 0]], seen = new Set(); let count = 0;
    while (stack.length) {
      const [item, depth] = stack.pop();
      if (++count > 250000 || depth > limits.depth) fail('resourceLimit');
      if (item === null || typeof item !== 'object') continue;
      if (seen.has(item)) fail(); seen.add(item);
      for (const key of Object.keys(item)) {
        if (dangerous.has(key)) fail('unsafeKeys');
        stack.push([item[key], depth + 1]);
      }
    }
    return value;
  }
  function parse(raw, maxBytes = limits.bytes) {
    if (typeof raw !== 'string') fail();
    // UTF-8 byte count, including Unicode, without allocating another byte buffer.
    if (raw.length > maxBytes) fail('resourceLimit');
    let bytes = 0;
    for (const char of raw) { const c = char.codePointAt(0); bytes += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4; if (bytes > maxBytes) fail('resourceLimit'); }
    return inspect(JSON.parse(raw));
  }
  function version(value, max = 2) { if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > max)) fail('unsupportedVersion'); }
  function count(items, max) { if (!Array.isArray(items) || items.length > max) fail('resourceLimit'); return items; }
  return {limits, object, text, identifier, number, inspect, parse, version, count};
});
