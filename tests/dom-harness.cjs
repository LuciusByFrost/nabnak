// Minimal DOM for deterministic event integration tests. This does not render CSS
// or reproduce browser layout, native focus trapping, touch, or native validation.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
class TestEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}
class Element {
  constructor(tag, attrs = {}, doc) {
    this.tagName = tag; this.attrs = attrs; this.doc = doc; this.children = []; this.listeners = {};
    this.checked = Object.hasOwn(attrs, 'checked'); this.hidden = Object.hasOwn(attrs, 'hidden'); this.inert = Object.hasOwn(attrs, 'inert');
    this.open = false;
    this.style = {setProperty(name, value) { this[name] = value; }};
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle: (name, enabled) => { const on = enabled ?? !this.classList.contains(name); on ? this.classList.add(name) : this.classList.remove(name); }
    };
    this.dataset = new Proxy({}, {get: (_, key) => this.attrs['data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())], set: (_, key, value) => {this.attrs['data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = value; return true;}});
  }
  get id() { return this.attrs.id; } set id(value) { this.attrs.id = value; }
  get className() { return this.attrs.class || ''; } set className(value) { this.attrs.class = value; }
  get name() { return this.attrs.name; }
  get parentElement() { return this.parent || null; }
  get firstElementChild() { return this.children.find(child => child instanceof Element); }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(String(value)); }
  get value() {
    const value = this._value ?? this.attrs.value ?? (this.tagName === 'select' ? this.querySelector('option')?.value : '') ?? '';
    return this.tagName === 'progress' ? Number(value) : value;
  }
  set value(value) { this._value = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  removeAttribute(key) { delete this.attrs[key]; }
  append(...nodes) { nodes.forEach(node => { if (node instanceof Element) { node.parent?.removeChild(node); node.parent = this; } this.children.push(node); }); }
  appendChild(node) { this.append(node); return node; }
  removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parent = null; }
  replaceChildren(...nodes) { this.children.forEach(child => { if (child instanceof Element) child.parent = null; }); this.children = []; this.append(...nodes); }
  contains(node) { return node === this || this.children.some(child => child instanceof Element && child.contains(node)); }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (part.startsWith('#')) return this.id === part.slice(1);
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      const match = part.match(/^(\w+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?(?::(checked))?$/);
      if (!match) throw new Error('Unsupported test selector: ' + part);
      return (!match[1] || this.tagName === match[1]) && (!match[2] || Object.hasOwn(this.attrs, match[2]) && (match[3] === undefined || this.attrs[match[2]] === match[3])) && (!match[4] || this.checked);
    });
  }
  querySelectorAll(selector) {
    const result = [];
    const walk = node => { for (const child of node.children) if (child instanceof Element) {if (child.matches(selector)) result.push(child); walk(child);} };
    walk(this); return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatchEvent(event) {
    event.target ||= this;
    for (const listener of this.listeners[event.type] || []) listener.call(this, event);
    if (!event.stopped && this.parent && ['click', 'submit', 'change', 'keydown', 'dragstart', 'dragover', 'drop', 'dragend'].includes(event.type)) this.parent.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  fire(type, init = {}) { return this.dispatchEvent(new TestEvent(type, init)); }
  focus() { this.doc.activeElement = this; }
  blur() { this.doc.activeElement = this.doc.body; this.fire('blur'); }
  remove() { this.parent?.removeChild(this); }
  setPointerCapture() {}
  releasePointerCapture() {}
  click() {
    this.focus();
    if (this.tagName === 'input' && this.attrs.type === 'radio') {
      const changed = !this.checked;
      this.doc.querySelectorAll(`input[name="${this.name}"]`).forEach(option => { option.checked = option === this; });
      if (changed) this.fire('change');
    }
    this.fire('click');
  }
  showModal() { this.previousFocus = this.doc.activeElement; this.open = true; this.focus(); }
  close() { this.open = false; this.previousFocus?.focus(); this.fire('close'); }
  getBoundingClientRect() { return {left: 0, right: 100, top: 0, bottom: 100}; }
}
function parse(html, root, doc) {
  const stack = [root];
  for (const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token[0] === '<') {
      const tag = token.match(/^<([\w-]+)/)[1]; const attrs = {};
      for (const match of token.slice(tag.length + 1, -1).matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[match[1]] = match[2] ?? '';
      const element = new Element(tag, attrs, doc); stack.at(-1).append(element);
      if (!['meta', 'link', 'input', 'img', 'br'].includes(tag) && !token.endsWith('/>')) stack.push(element);
    } else stack.at(-1).children.push(token);
  }
}
function boot(data = new Map()) {
  const document = new Element('document'); document.doc = document;
  document.getElementById = id => document.querySelector('#' + id);
  document.createElement = tag => new Element(tag, {}, document);
  document.createElementNS = (_namespace, tag) => new Element(tag, {}, document);
  parse(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), document, document);
  document.documentElement = document.querySelector('html'); document.body = document.querySelector('body'); document.activeElement = document.body;
  const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
  const context = vm.createContext({document, console, Intl, Date, Event: TestEvent, setInterval() {}, setTimeout(fn) { fn(); return 0; }, clearTimeout() {}, addEventListener(type, fn) { document.addEventListener('window:' + type, fn); }, localStorage: storage, confirm: () => true});
  context.window = context;
  for (const script of document.querySelectorAll('script')) vm.runInContext(fs.readFileSync(path.join(ROOT, script.attrs.src), 'utf8'), context, {filename: script.attrs.src});
  return {document, context, data, $: id => document.getElementById(id)};
}
module.exports = {boot};
