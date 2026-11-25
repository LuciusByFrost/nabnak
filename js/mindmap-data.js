/* Map-only data, layout and history. No task storage is read or written here. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabnakMindData = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const S = typeof module === 'object' && module.exports ? require('./security.js') : NabnakSecurity;
  const KEY = 'nabnak.mindmaps', VERSION = 2;
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => 'mm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const color = value => /^#[\da-f]{6}$/i.test(value || '') ? value : '#fd951f';
  const palette = ['#fd951f', '#65a9ed', '#72c69a', '#b38ae0', '#e3c46a'];
  function nodeSize(node) {
    const width = node.width || (node.isRoot ? 264 : 224);
    const lines = value => String(value || '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 23)), 0);
    const estimate = Math.max(node.isRoot ? 88 : 64, 32 + lines(node.title) * 23 + (node.description ? 8 + lines(node.description) * 19 : 0));
    return {width, height: node.height || estimate};
  }
  function newMap(title, centralTitle) {
    S.text(title, S.limits.title, true); S.text(centralTitle, S.limits.title);
    const rootId = id();
    return {id: id(), title, rootId, nodes: [{id: rootId, title: centralTitle, description: '', color: palette[0], x: 0, y: 0, isRoot: true, parentId: null, manual: false, collapsed: false}], edges: [], camera: {x: 0, y: 0, zoom: 1}};
  }
  function normalizeMap(raw, preserve = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('mmReadError');
    S.count(raw.nodes, S.limits.nodes);
    if (!raw.nodes.length) throw new Error('mmReadError');
    const seen = new Set(), byId = new Map();
    const nodes = raw.nodes.map(item => {
      S.object(item);
      S.identifier(item.id);
      if (seen.has(item.id)) throw new Error('mmReadError');
      seen.add(item.id);
      const x = item.x ?? item.position?.x ?? 0, y = item.y ?? item.position?.y ?? 0;
      if (item.color !== undefined && (typeof item.color !== 'string' || !/^#[\da-f]{6}$/i.test(item.color))) throw new Error('invalidInput');
      for (const flag of ['manual', 'collapsed', 'isRoot']) if (item[flag] !== undefined && typeof item[flag] !== 'boolean') throw new Error('invalidInput');
      for (const dim of ['width', 'height']) if (item[dim] !== undefined) S.number(item[dim], 1, 50000);
      const node = {...(preserve ? item : {}), id: item.id,
        title: S.text(item.title ?? item.text ?? item.label ?? '', S.limits.title),
        description: S.text(item.description ?? '', S.limits.description), color: color(item.color),
        x: S.number(x), y: S.number(y), width: item.width, height: item.height,
        manual: item.manual ?? (Number.isFinite(item.x ?? item.position?.x) && Number.isFinite(item.y ?? item.position?.y)),
        collapsed: item.collapsed ?? false, parentId: item.parentId ?? null};
      if (item.side !== undefined) { if (![1, -1].includes(item.side)) throw new Error('invalidInput'); node.side = item.side; }
      if (node.parentId !== null) S.identifier(node.parentId);
      byId.set(node.id, node); return node;
    });
    const rootId = raw.rootId ?? raw.nodes.find(node => node.isRoot)?.id ?? nodes.find(node => !node.parentId)?.id ?? nodes[0].id;
    S.identifier(rootId);
    if (!seen.has(rootId) || byId.get(rootId).parentId) throw new Error('mmReadError');
    const edges = [], pairs = new Map(), edgeIds = new Set();
    for (const edge of S.count(raw.edges ?? raw.connections ?? [], S.limits.edges)) {
      S.object(edge);
      const source = S.identifier(edge.source ?? edge.from), target = S.identifier(edge.target ?? edge.to);
      if (!seen.has(source) || !seen.has(target) || source === target) throw new Error('mmReadError');
      const edgeId = edge.id === undefined ? id() : S.identifier(edge.id);
      if (edgeIds.has(edgeId)) throw new Error('mmReadError'); edgeIds.add(edgeId);
      if (edge.kind !== undefined && !['tree', 'link'].includes(edge.kind)) throw new Error('invalidInput');
      if (edge.kind === 'tree') {
        const child = byId.get(target);
        if (target === rootId || child.parentId && child.parentId !== source) throw new Error('mmReadError');
        child.parentId = source;
      }
      const pair = [source, target].sort().join('\0');
      if (pairs.has(pair)) { if (edge.kind === 'tree') pairs.get(pair).kind = 'tree'; continue; }
      const clean = {...(preserve ? edge : {}), id: edgeId, source, target, kind: edge.kind === 'tree' ? 'tree' : 'link'};
      pairs.set(pair, clean); edges.push(clean);
    }
    // Each parent pointer is visited once. Bound depth for the recursive layout engine.
    const depths = new Map();
    for (const node of nodes) {
      const chain = [], visiting = new Set(); let current = node;
      while (current && !depths.has(current.id)) {
        if (visiting.has(current.id)) throw new Error('mmReadError');
        visiting.add(current.id); chain.push(current);
        if (chain.length > S.limits.depth) throw new Error('resourceLimit');
        if (current.parentId && !byId.has(current.parentId)) throw new Error('mmReadError');
        current = byId.get(current.parentId);
      }
      let depth = current ? depths.get(current.id) : 0;
      while (chain.length) { const item = chain.pop(); if (++depth > S.limits.depth) throw new Error('resourceLimit'); depths.set(item.id, depth); }
      node.isRoot = node.id === rootId;
      if (node.parentId) {
        const pair = [node.parentId, node.id].sort().join('\0'), edge = pairs.get(pair);
        if (edge) { edge.source = node.parentId; edge.target = node.id; edge.kind = 'tree'; }
        else { const edge = {id: id(), source: node.parentId, target: node.id, kind: 'tree'}; edges.push(edge); pairs.set(pair, edge); }
      }
    }
    S.count(edges, S.limits.edges);
    const camera = S.object(raw.camera ?? raw.viewport ?? {});
    return {...(preserve ? raw : {}), id: raw.id === undefined ? id() : S.identifier(raw.id),
      title: S.text(raw.title ?? raw.name ?? 'Mind map', S.limits.title, true), rootId, nodes, edges,
      camera: {x: S.number(camera.x ?? 0), y: S.number(camera.y ?? 0), zoom: S.number(camera.zoom ?? 1, .01, 3)}};
  }
  function decode(raw, preserve = false) {
    S.inspect(raw); S.version(raw?.version);
    const maps = Array.isArray(raw) ? raw : raw?.maps ?? (raw?.nodes ? [raw] : null);
    S.count(maps, S.limits.maps);
    const normalized = maps.map(map => normalizeMap(map, preserve));
    if (new Set(normalized.map(map => map.id)).size !== normalized.length) throw new Error('mmReadError');
    if (raw.activeMapId !== undefined && raw.activeMapId !== null && !normalized.some(map => map.id === raw.activeMapId)) throw new Error('invalidInput');
    return {...(preserve && !Array.isArray(raw) ? raw : {}), version: VERSION, maps: normalized, activeMapId: raw.activeMapId ?? normalized[0]?.id ?? null};
  }
  function createStore(storage) {
    let state = {version: VERSION, maps: [], activeMapId: null}, error = '', readonly = false, original = null, originKey = KEY;
    const past = [], future = [], listeners = new Set();
    try {
      for (const key of [KEY, 'nabnak.mindMaps', 'nabnak.maps']) {
        const value = storage.getItem(key);
        if (value !== null) { original = value; originKey = key; state = decode(S.parse(value), true); break; }
      }
    } catch { error = 'mmReadError'; readonly = true; }
    let expected = null;
    try { expected = storage.getItem(KEY); } catch { /* Read error already reported. */ }
    function save(candidate = state, atomic = false) {
      if (readonly) { if (atomic) throw new Error('mmReadError'); return; }
      try {
        if (storage.getItem(KEY) !== expected) throw new Error('storageConflict');
        // Before the first write, retain an exact copy of the original serialized data.
        if (original !== null && storage.getItem(originKey + '.backup') === null) storage.setItem(originKey + '.backup', original);
        const serialized = JSON.stringify(candidate); S.parse(serialized);
        storage.setItem(KEY, serialized); expected = serialized; error = '';
      } catch (failure) { error = failure.message === 'storageConflict' ? 'storageConflict' : 'mmWriteError'; if (atomic) throw new Error(error); }
    }
    const notify = (kind = 'edit') => listeners.forEach(listener => listener(kind));
    if (typeof window === 'object') window.addEventListener?.('storage', event => {
      if ((event.key === KEY || event.key === null) && event.storageArea === storage) { readonly = true; error = 'storageConflict'; notify(); }
    });
    return {
      getState: () => clone(state), getError: () => error, isReadOnly: () => readonly,
      canUndo: () => past.length > 0, canRedo: () => future.length > 0,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      edit(change, {atomic = false} = {}) {
        if (readonly) throw new Error('mmReadError');
        let draft = clone(state); change(draft); draft = decode(draft, true);
        S.parse(JSON.stringify(draft));
        if (JSON.stringify(draft) === JSON.stringify(state)) return false;
        if (atomic) save(draft, true);
        past.push(clone(state));
        while (past.length > 60 || past.length > 1 && past.reduce((bytes, item) => bytes + JSON.stringify(item).length, 0) > 5 * 1024 * 1024) past.shift(); future.length = 0;
        state = draft; if (!atomic) save(); notify(); return true;
      },
      view(mapId, camera) {
        if (readonly) return;
        const map = state.maps.find(map => map.id === mapId);
        if (map) { try { map.camera = {x: S.number(camera.x), y: S.number(camera.y), zoom: S.number(camera.zoom, .01, 3)}; } catch { error = 'invalidInput'; return; } }
        save(); notify('view');
      },
      activate(mapId) { if (!state.maps.some(map => map.id === mapId)) return; state.activeMapId = mapId; save(); notify(); },
      undo() { if (!past.length || readonly) return; future.push(clone(state)); state = past.pop(); save(); notify(); },
      redo() { if (!future.length || readonly) return; past.push(clone(state)); state = future.pop(); save(); notify(); }
    };
  }
  function visibleNodes(map) {
    const byId = new Map(map.nodes.map(node => [node.id, node]));
    return map.nodes.filter(node => {
      let parent = byId.get(node.parentId); const visited = new Set([node.id]);
      while (parent) {
        if (visited.has(parent.id) || parent.collapsed) return false;
        visited.add(parent.id); parent = byId.get(parent.parentId);
      }
      return true;
    });
  }
  function addNode(map, parentId, title) {
    S.text(title, S.limits.title, true); if (map.nodes.length >= S.limits.nodes || map.edges.length >= S.limits.edges) throw new Error('resourceLimit');
    const parent = map.nodes.find(node => node.id === parentId) || map.nodes.find(node => node.id === map.rootId);
    const child = {id: id(), title, description: '', parentId: parent.id, color: parent.isRoot ? palette[(map.nodes.filter(node => node.parentId === parent.id).length + 1) % palette.length] : parent.color,
      x: parent.x, y: parent.y, manual: false, collapsed: false, isRoot: false};
    parent.collapsed = false; map.nodes.push(child);
    map.edges.push({id: id(), source: parent.id, target: child.id, kind: 'tree'}); return child;
  }
  function descendants(map, nodeId) {
    const ids = new Set([nodeId]); let changed = true;
    while (changed) { changed = false; for (const node of map.nodes) if (ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true; } }
    return ids;
  }
  function removeNode(map, nodeId) {
    if (nodeId === map.rootId) throw new Error('mmRootProtected');
    const ids = descendants(map, nodeId);
    map.nodes = map.nodes.filter(node => !ids.has(node.id));
    map.edges = map.edges.filter(edge => !ids.has(edge.source) && !ids.has(edge.target));
  }
  function duplicateNode(map, nodeId) {
    const original = map.nodes.find(node => node.id === nodeId); if (!original) return;
    const node = {...clone(original), id: id(), isRoot: false, parentId: original.parentId || map.rootId, manual: false, collapsed: false};
    map.nodes.push(node); map.edges.push({id: id(), source: node.parentId, target: node.id, kind: 'tree'}); return node;
  }
  function connect(map, source, target) {
    if (source === target || !map.nodes.some(node => node.id === source) || !map.nodes.some(node => node.id === target)) return false;
    if (map.edges.some(edge => edge.source === source && edge.target === target || edge.source === target && edge.target === source)) return false;
    map.edges.push({id: id(), source, target, kind: 'link'}); return true;
  }
  function disconnect(map, edgeId) {
    const edge = map.edges.find(edge => edge.id === edgeId);
    if (edge?.kind === 'tree') map.nodes.find(node => node.id === edge.target).parentId = null;
    map.edges = map.edges.filter(edge => edge.id !== edgeId);
  }
  function overlaps(a, b, gap = 24) {
    const as = nodeSize(a), bs = nodeSize(b);
    return Math.abs(a.x - b.x) < (as.width + bs.width) / 2 + gap && Math.abs(a.y - b.y) < (as.height + bs.height) / 2 + gap;
  }
  function layout(map, {force = false, measure = nodeSize} = {}) {
    const nodes = visibleNodes(map), root = nodes.find(node => node.id === map.rootId);
    if (!root) return;
    for (const node of nodes) { const size = measure(node); node.width = size.width; node.height = size.height; if (force) node.manual = false; }
    const childLists = new Map(nodes.map(node => [node.id, []])), spans = new Map();
    for (const node of nodes) childLists.get(node.parentId)?.push(node);
    const children = node => childLists.get(node.id) || [];
    const span = node => {
      if (!spans.has(node.id)) spans.set(node.id, Math.max(nodeSize(node).height, children(node).reduce((sum, child) => sum + span(child) + 32, -32)));
      return spans.get(node.id);
    };
    const branches = nodes.filter(node => node.id !== root.id && (!node.parentId || node.parentId === root.id));
    const left = [], right = []; let lh = 0, rh = 0;
    for (const branch of branches) {
      const side = force ? (rh <= lh ? 1 : -1) : (branch.side || (rh <= lh ? 1 : -1));
      if (side === 1) { right.push(branch); rh += span(branch) + 32; } else { left.push(branch); lh += span(branch) + 32; }
    }
    const placed = nodes.filter(node => node.manual || node.id === root.id);
    function place(node, parent, side, y) {
      node.side = side;
      if (!node.manual) {
        node.x = parent.x + side * (nodeSize(parent).width / 2 + 88 + nodeSize(node).width / 2); node.y = y;
        let collision;
        while ((collision = placed.find(other => other.id !== node.id && overlaps(node, other)))) node.y = collision.y + nodeSize(collision).height / 2 + nodeSize(node).height / 2 + 32;
        placed.push(node);
      }
      const kids = children(node), total = kids.reduce((sum, child) => sum + span(child) + 32, -32);
      let cursor = node.y - Math.max(0, total) / 2;
      for (const child of kids) { const height = span(child); place(child, node, side, cursor + height / 2); cursor += height + 32; }
    }
    for (const [group, side] of [[left, -1], [right, 1]]) {
      const total = group.reduce((sum, node) => sum + span(node) + 32, -32); let cursor = root.y - Math.max(0, total) / 2;
      for (const node of group) { const height = span(node); place(node, root, side, cursor + height / 2); cursor += height + 32; }
    }
  }
  function bounds(map) {
    const nodes = visibleNodes(map);
    return {left: Math.min(...nodes.map(node => node.x - nodeSize(node).width / 2)), right: Math.max(...nodes.map(node => node.x + nodeSize(node).width / 2)),
      top: Math.min(...nodes.map(node => node.y - nodeSize(node).height / 2)), bottom: Math.max(...nodes.map(node => node.y + nodeSize(node).height / 2))};
  }
  function fitCamera(map, width, height) {
    const box = bounds(map), zoom = Math.max(.01, Math.min(1.5, (width - 80) / Math.max(1, box.right - box.left), (height - 80) / Math.max(1, box.bottom - box.top)));
    return {zoom, x: width / 2 - (box.left + box.right) / 2 * zoom, y: height / 2 - (box.top + box.bottom) / 2 * zoom};
  }
  function zoomAt(camera, factor, point) {
    const zoom = Math.max(.01, Math.min(3, camera.zoom * factor)), ratio = zoom / camera.zoom;
    return {zoom, x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio};
  }
  function curve(source, target) {
    const direction = target.x >= source.x ? 1 : -1;
    const x1 = source.x + direction * nodeSize(source).width / 2, x2 = target.x - direction * nodeSize(target).width / 2;
    const bend = Math.max(48, Math.abs(x2 - x1) / 2);
    return `M ${x1} ${source.y} C ${x1 + direction * bend} ${source.y}, ${x2 - direction * bend} ${target.y}, ${x2} ${target.y}`;
  }
  return {KEY, VERSION, clone, color, newMap, normalizeMap, decode, createStore, nodeSize, visibleNodes, addNode, removeNode, duplicateNode, connect, disconnect, layout, overlaps, bounds, fitCamera, zoomAt, curve};
});
