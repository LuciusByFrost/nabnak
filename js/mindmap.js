/* The map view uses the existing sidebar, translator and task editor. */
(() => {
  'use strict';
  const D = NabnakMindData, {t} = NabnakI18n, $ = id => document.getElementById(id);
  const view = $('mindmap-view'), viewport = $('mm-viewport'), world = $('mm-world');
  let storage;
  try { storage = window.localStorage; } catch { storage = {getItem() { throw new Error('unavailable'); }}; }
  const store = D.createStore(storage);
  let selectedId = null, selectedEdge = null, activeId = null, camera = {x: 0, y: 0, zoom: 1};
  let connecting = false, connectSource = null, gesture = null, wheelTimer = null, message = '';
  const pointers = new Map();
  const icons = {
    add: 'M12 4v16M4 12h16', child: 'M4 4v9h9M13 9v8M9 13h8M4 20h16', connect: 'M9 15l6-6M8 16l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0M16 8l2-2a3 3 0 0 1 4 4l-5 5a3 3 0 0 1-4 0',
    organize: 'M12 3v6M4 15v6M20 15v6M12 9H4v6M12 9h8v6M8 3h8M1 21h6M17 21h6', undo: 'M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12', redo: 'm16 5 5 5-5 5M21 10H10a6 6 0 0 0 0 12',
    zoomIn: 'M4 12h16M12 4v16', zoomOut: 'M4 12h16', center: 'M12 2v4M12 18v4M2 12h4M18 12h4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0', fit: 'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
    export: 'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6', import: 'M12 16V4m-5 5 5-5 5 5M4 15v6h16v-6'
  };
  const make = (tag, className, text) => {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = text; return element;
  };
  const svgElement = (tag, attributes) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value)); return element;
  };
  const mapNow = () => store.getState().maps.find(map => map.id === store.getState().activeMapId);
  const nodeNow = () => mapNow()?.nodes.find(node => node.id === selectedId);
  const dimensions = () => { const rect = viewport.getBoundingClientRect(); return {width: rect.width || 900, height: rect.height || 600}; };
  function status() { $('mm-message').textContent = t(store.getError() || message || (connecting ? 'mmConnectHint' : 'mmSaved')); }
  function transact(change) {
    try { message = ''; store.edit(change); } catch (error) { message = error.message; status(); }
  }
  function editMap(change) { transact(state => { const map = state.maps.find(map => map.id === state.activeMapId); if (map) change(map); }); }
  function card(node, interactive = true) {
    const element = make('div', `mm-node${node.isRoot ? ' is-root' : ''}${interactive && selectedId === node.id ? ' is-selected' : ''}`);
    const size = D.nodeSize(node);
    element.style.width = size.width + 'px'; element.style.minHeight = size.height + 'px';
    element.style.left = node.x - size.width / 2 + 'px'; element.style.top = node.y - size.height / 2 + 'px';
    element.style.setProperty('--idea-color', D.color(node.color)); element.dataset.nodeId = node.id;
    const title = make('div', 'mm-node-title', node.title); element.append(title);
    if (node.description) element.append(make('p', 'mm-node-description', node.description));
    if (node.collapsed) element.append(make('p', 'mm-collapsed', t('mmCollapsed')));
    if (interactive) {
      element.tabIndex = 0; element.setAttribute('role', 'group'); element.setAttribute('aria-label', node.title);
      title.addEventListener('dblclick', event => {
        event.stopPropagation(); if (store.isReadOnly() || connecting) return;
        title.setAttribute('contenteditable', 'true'); title.setAttribute('aria-label', t('mmTitle')); title.setAttribute('title', t('mmSaveTitle')); title.focus();
        let canceled = false;
        title.addEventListener('keydown', event => {
          if (event.key === 'Escape') { canceled = true; event.preventDefault(); title.blur(); }
          else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); title.blur(); }
          event.stopPropagation();
        }, {once: false});
        title.addEventListener('blur', () => {
          const text = title.textContent.trim();
          title.removeAttribute('contenteditable');
          if (!canceled && text && text !== node.title) updateNode({title: text});
          else { title.textContent = node.title; focusSelected(); }
        }, {once: true});
      });
      element.addEventListener('focus', () => { if (selectedId !== node.id) { select(node.id, false); focusSelected(); } });
    }
    return element;
  }
  function measure(node) {
    const host = $('mm-measure'), element = card({...node, height: undefined}, false); host.replaceChildren(element);
    // The DOM harness has no font/layout engine; deterministic estimates cover it.
    const height = typeof element.getClientRects === 'function' ? element.getBoundingClientRect().height : D.nodeSize(node).height;
    host.replaceChildren();
    return {width: D.nodeSize(node).width, height: Math.max(64, height)};
  }
  const arrange = (map, force = false) => D.layout(map, {force, measure});
  function drawEdges(map) {
    const layer = $('mm-edges'); layer.replaceChildren();
    const visible = new Map(D.visibleNodes(map).map(node => [node.id, node]));
    for (const edge of map.edges) {
      const source = visible.get(edge.source), target = visible.get(edge.target); if (!source || !target) continue;
      const d = D.curve(source, target), stroke = D.color(edge.kind === 'tree' ? target.color : source.color);
      const path = svgElement('path', {d, stroke, class: 'mm-edge' + (edge.id === selectedEdge ? ' is-selected' : '')});
      const hit = svgElement('path', {d, class: 'mm-edge-hit'});
      hit.addEventListener('pointerdown', event => {
        event.stopPropagation(); selectedEdge = edge.id; selectedId = null; connecting = false; connectSource = null; render();
      });
      layer.append(path, hit);
    }
  }
  function applyCamera() {
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    viewport.style.backgroundSize = `${24 * camera.zoom}px ${24 * camera.zoom}px`;
    viewport.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
    $('mm-zoom-value').textContent = Math.round(camera.zoom * 100) + '%';
  }
  function drawPositions(map) {
    for (const element of $('mm-nodes').querySelectorAll('.mm-node')) {
      const node = map.nodes.find(node => node.id === element.dataset.nodeId), size = D.nodeSize(node);
      element.style.left = node.x - size.width / 2 + 'px'; element.style.top = node.y - size.height / 2 + 'px';
    }
    drawEdges(map);
  }
  function render({preserveNodes = false} = {}) {
    const state = store.getState(), map = state.maps.find(map => map.id === state.activeMapId), node = map?.nodes.find(node => node.id === selectedId);
    const choices = $('mm-map-select'); choices.replaceChildren();
    for (const item of state.maps) { const option = make('option', '', item.title); option.value = item.id; choices.append(option); }
    choices.value = map?.id || ''; choices.disabled = !map;
    if (document.activeElement !== $('mm-map-name')) $('mm-map-name').value = map?.title || '';
    $('mm-map-name').disabled = !map || store.isReadOnly(); $('mm-new').disabled = store.isReadOnly();
    if (activeId !== map?.id) { activeId = map?.id; selectedId = null; selectedEdge = null; connecting = false; connectSource = null; preserveNodes = false; }
    if (!map?.edges.some(edge => edge.id === selectedEdge)) selectedEdge = null;
    if (map) camera = {...map.camera};
    $('mm-empty').hidden = Boolean(map);
    if (!preserveNodes) {
      $('mm-nodes').replaceChildren();
      if (map && !view.hidden) for (const item of D.visibleNodes(map)) $('mm-nodes').append(card(item));
    }
    for (const element of $('mm-nodes').querySelectorAll('.mm-node')) element.classList.toggle('is-selected', element.dataset.nodeId === selectedId);
    if (map) drawEdges(map); else $('mm-edges').replaceChildren();
    applyCamera();
    const current = map?.nodes.find(node => node.id === selectedId);
    $('mm-node-fields').hidden = !current; $('mm-selection-hint').hidden = Boolean(current);
    $('mm-selection-hint').textContent = t(selectedEdge ? 'mmEdgeSelected' : 'mmSelectHint');
    $('mm-remove-edge').hidden = !selectedEdge;
    const edgeChoices = $('mm-connection-select'); edgeChoices.replaceChildren();
    const placeholder = make('option', '', t('mmChooseConnection')); placeholder.value = ''; edgeChoices.append(placeholder);
    if (map) for (const edge of map.edges) {
      const source = map.nodes.find(node => node.id === edge.source), target = map.nodes.find(node => node.id === edge.target);
      const option = make('option', '', `${source.title} / ${target.title}`); option.value = edge.id; edgeChoices.append(option);
    }
    edgeChoices.value = selectedEdge || ''; $('mm-connections-label').hidden = !map?.edges.length;
    for (const [field, property] of [['mm-title', 'title'], ['mm-description', 'description'], ['mm-color', 'color']]) {
      if (document.activeElement !== $(field)) $(field).value = current?.[property] || (property === 'color' ? '#fd951f' : '');
      $(field).disabled = store.isReadOnly();
    }
    $('mm-delete').disabled = !current || current.isRoot || store.isReadOnly();
    $('mm-collapse').disabled = !current || !map.nodes.some(item => item.parentId === current.id);
    $('mm-collapse').setAttribute('aria-pressed', String(Boolean(current?.collapsed)));
    for (const id of ['mm-child', 'mm-duplicate', 'mm-task']) $(id).disabled = !current || store.isReadOnly();
    for (const id of ['mm-add', 'mm-connect', 'mm-organize', 'mm-center', 'mm-fit']) $(id).disabled = !map || store.isReadOnly();
    $('mm-undo').disabled = !store.canUndo(); $('mm-redo').disabled = !store.canRedo();
    $('mm-connect').setAttribute('aria-pressed', String(connecting)); viewport.classList.toggle('is-connecting', connecting);
    status();
  }
  function focusSelected() {
    const element = Array.from($('mm-nodes').querySelectorAll('.mm-node')).find(element => element.dataset.nodeId === selectedId);
    (element || viewport).focus({preventScroll: true});
  }
  function select(nodeId, focus = true) {
    const map = mapNow(); if (!map?.nodes.some(node => node.id === nodeId)) return;
    if (connecting) {
      if (!connectSource) { connectSource = nodeId; selectedId = nodeId; render(); return; }
      let added = false;
      editMap(map => { added = D.connect(map, connectSource, nodeId); });
      if (!added) { message = 'mmDuplicateEdge'; status(); return; }
      connecting = false; connectSource = null;
    }
    selectedId = nodeId; selectedEdge = null; render({preserveNodes: true}); if (focus) focusSelected();
  }
  function saveCamera() {
    const map = mapNow(); if (map) store.view(map.id, camera);
  }
  function fit() {
    const map = mapNow(); if (!map) return; const {width, height} = dimensions();
    camera = D.fitCamera(map, width, height); applyCamera(); saveCamera();
  }
  function center() {
    const map = mapNow(), root = map?.nodes.find(node => node.id === map.rootId); if (!root) return;
    const {width, height} = dimensions(); camera.x = width / 2 - root.x * camera.zoom; camera.y = height / 2 - root.y * camera.zoom; applyCamera(); saveCamera();
  }
  function zoom(factor, point) {
    const {width, height} = dimensions(); camera = D.zoomAt(camera, factor, point || {x: width / 2, y: height / 2}); applyCamera();
  }
  function add(child = false) {
    if (!mapNow()) return;
    let created;
    editMap(map => { created = D.addNode(map, child ? selectedId : map.rootId, t('mmIdea')); arrange(map); });
    if (created) { selectedId = created.id; render(); focusSelected(); }
  }
  function createMap() {
    if (store.isReadOnly()) return;
    const map = D.newMap(t('mmNewMap'), t('mmCentral'));
    transact(state => { state.maps.push(map); state.activeMapId = map.id; });
    selectedId = map.rootId; render(); fit(); focusSelected();
  }
  function open() {
    NabnakI18n.closeMenu(); view.hidden = false; document.querySelector('.workspace').hidden = true;
    if (!mapNow() && !store.isReadOnly()) createMap();
    else { render(); viewport.focus(); }
  }
  function close() {
    saveCamera(); view.hidden = true; document.querySelector('.workspace').hidden = false; connecting = false; connectSource = null; $('task').focus();
  }
  function updateNode(patch) {
    const node = nodeNow(); if (!node) return;
    editMap(map => {
      const current = map.nodes.find(item => item.id === node.id); Object.assign(current, patch); delete current.height;
      if (patch.color && !current.isRoot) {
        const branch = new Set([current.id]); let changed = true;
        while (changed) { changed = false; for (const item of map.nodes) if (branch.has(item.parentId) && !branch.has(item.id)) { branch.add(item.id); changed = true; } }
        for (const item of map.nodes) if (branch.has(item.id) && item.color === node.color) item.color = patch.color;
      }
      // Only nodes without an explicit manual position may move during editing.
      arrange(map);
    });
  }
  function deleteSelection() {
    if (selectedEdge) { editMap(map => D.disconnect(map, selectedEdge)); selectedEdge = null; render(); return; }
    const node = nodeNow(); if (!node) return;
    if (node.isRoot) { message = 'mmRootProtected'; status(); return; }
    if (!window.confirm(t('mmDeleteConfirm'))) return;
    editMap(map => { D.removeNode(map, node.id); arrange(map); }); selectedId = node.parentId; render(); focusSelected();
  }
  function svgExport(map) {
    const box = D.bounds(map), padding = 40;
    const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));
    const nodes = D.visibleNodes(map), byId = new Map(nodes.map(node => [node.id, node]));
    const lines = [];
    for (const edge of map.edges) {
      const source = byId.get(edge.source), target = byId.get(edge.target); if (!source || !target) continue;
      lines.push(`<path d="${D.curve(source, target)}" fill="none" stroke="${D.color(target.color)}" stroke-width="2.5"/>`);
    }
    for (const node of nodes) {
      const size = D.nodeSize(node), left = node.x - size.width / 2, top = node.y - size.height / 2;
      lines.push(`<rect x="${left}" y="${top}" width="${size.width}" height="${size.height}" rx="12" fill="#252326" stroke="${D.color(node.color)}" stroke-width="2"/>`);
      const wrap = text => String(text).split('\n').flatMap(line => line.match(/.{1,23}/gu) || ['']);
      let y = top + 28;
      for (const text of wrap(node.title)) { lines.push(`<text x="${left + 16}" y="${y}" fill="#f3f0ed" font-size="16" font-family="sans-serif">${escape(text)}</text>`); y += 23; }
      if (node.description) { y += 6; for (const text of wrap(node.description)) { lines.push(`<text x="${left + 16}" y="${y}" fill="#bbb6bd" font-size="14" font-family="sans-serif">${escape(text)}</text>`); y += 19; } }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.left - padding} ${box.top - padding} ${box.right - box.left + padding * 2} ${box.bottom - box.top + padding * 2}"><title>${escape(map.title)}</title><rect x="${box.left - padding}" y="${box.top - padding}" width="100%" height="100%" fill="#19181b"/>${lines.join('')}</svg>`;
  }
  function download() {
    const map = mapNow(), format = $('mm-export-format').value || 'json';
    let text, type;
    if (store.isReadOnly()) {
      try { text = [D.KEY, 'nabnak.mindMaps', 'nabnak.maps'].map(key => storage.getItem(key)).find(value => value !== null) || '{}'; } catch { text = '{}'; }
      type = 'application/json';
    } else if (format === 'svg' && map) { text = svgExport(map); type = 'image/svg+xml'; }
    else { text = JSON.stringify(store.getState(), null, 2); type = 'application/json'; }
    const url = URL.createObjectURL(new Blob([text], {type})), anchor = make('a');
    anchor.href = url; anchor.download = (map?.title || 'nabnak-maps').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) + (type === 'image/svg+xml' ? '.svg' : '.json');
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importJson(text) {
    try {
        const incoming = D.decode(JSON.parse(text));
        if (store.isReadOnly()) throw new Error('mmReadError');
        // Imported IDs are remapped so an import can never replace an existing map.
        transact(state => {
          for (const original of incoming.maps) {
            const map = D.clone(original), replacement = D.newMap(map.title, ''); const ids = new Map(map.nodes.map((node, i) => [node.id, replacement.id + '-' + i]));
            map.id = replacement.id; map.rootId = ids.get(map.rootId);
            map.nodes.forEach(node => { node.id = ids.get(node.id); node.parentId = ids.get(node.parentId) || null; });
            map.edges.forEach((edge, i) => { edge.id = map.id + '-edge-' + i; edge.source = ids.get(edge.source); edge.target = ids.get(edge.target); });
            state.maps.push(map); state.activeMapId = map.id;
          }
        }); render(); fit(); return true;
    } catch { message = 'mmImportError'; status(); return false; }
  }
  function importFile() {
    const input = make('input'); input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      try { importJson(await file.text()); } catch { message = 'mmImportError'; status(); }
    }); input.click();
  }
  function toolbar() {
    const bar = $('mm-toolbar');
    for (const [id, icon, key, action] of [
      ['add', 'add', 'mmAdd', () => add()], ['child', 'child', 'mmChild', () => add(true)],
      ['connect', 'connect', 'mmConnect', () => { connecting = !connecting; connectSource = selectedId; message = ''; render(); }],
      ['organize', 'organize', 'mmOrganize', () => { editMap(map => arrange(map, true)); fit(); }],
      ['undo', 'undo', 'mmUndo', () => store.undo()], ['redo', 'redo', 'mmRedo', () => store.redo()],
      ['zoom-out', 'zoomOut', 'mmZoomOut', () => { zoom(1 / 1.15); saveCamera(); }], ['zoom-in', 'zoomIn', 'mmZoomIn', () => { zoom(1.15); saveCamera(); }],
      ['center', 'center', 'mmCenter', center], ['fit', 'fit', 'mmFit', fit], ['export', 'export', 'mmExport', download], ['import', 'import', 'mmImport', importFile]
    ]) {
      const button = make('button'); button.id = 'mm-' + id; button.type = 'button';
      button.setAttribute('data-i18n-label', key); button.setAttribute('data-i18n-title', key); button.setAttribute('aria-label', t(key)); button.setAttribute('title', t(key));
      const svg = svgElement('svg', {viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false'}); svg.append(svgElement('path', {d: icons[icon]})); button.append(svg);
      button.addEventListener('click', action); bar.append(button);
      if (id === 'zoom-out') { const output = make('output'); output.id = 'mm-zoom-value'; output.textContent = '100%'; bar.append(output); }
    }
    const format = make('select'); format.id = 'mm-export-format'; format.setAttribute('data-i18n-label', 'mmFormat'); format.setAttribute('aria-label', t('mmFormat'));
    for (const type of ['json', 'svg']) { const option = make('option', '', type.toUpperCase()); option.value = type; format.append(option); } bar.append(format);
  }
  // Pointer capture keeps node dragging separate from background panning, including touch.
  const point = event => { const rect = viewport.getBoundingClientRect(); return {x: event.clientX - rect.left, y: event.clientY - rect.top}; };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0 || event.target.closest('[contenteditable="true"]')) return;
    const p = point(event); pointers.set(event.pointerId, p); viewport.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]; gesture = {type: 'pinch', distance: distance(a, b), midpoint: midpoint(a, b), camera: {...camera}}; return;
    }
    const element = event.target.closest('.mm-node');
    if (element) {
      select(element.dataset.nodeId, false);
      if (connecting || store.isReadOnly()) return;
      const map = mapNow(), node = map.nodes.find(node => node.id === selectedId);
      gesture = {type: 'node', point: p, nodeId: node.id, x: node.x, y: node.y, preview: D.clone(map), moved: false};
    } else { gesture = {type: 'pan', point: p, camera: {...camera}, moved: false}; }
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return; event.preventDefault(); const p = point(event); pointers.set(event.pointerId, p);
    if (gesture.type === 'pinch') {
      const [a, b] = [...pointers.values()]; if (!b) return;
      const middle = midpoint(a, b); camera = D.zoomAt(gesture.camera, distance(a, b) / Math.max(1, gesture.distance), gesture.midpoint);
      camera.x += middle.x - gesture.midpoint.x; camera.y += middle.y - gesture.midpoint.y; applyCamera(); return;
    }
    const dx = p.x - gesture.point.x, dy = p.y - gesture.point.y;
    if (Math.hypot(dx, dy) < 4 && !gesture.moved) return;
    gesture.moved = true; viewport.classList.add('is-dragging');
    if (gesture.type === 'pan') { camera.x = gesture.camera.x + dx; camera.y = gesture.camera.y + dy; applyCamera(); }
    else {
      const node = gesture.preview.nodes.find(node => node.id === gesture.nodeId);
      node.x = gesture.x + dx / camera.zoom; node.y = gesture.y + dy / camera.zoom; node.manual = true; drawPositions(gesture.preview);
    }
  });
  function endPointer(event) {
    pointers.delete(event.pointerId); viewport.releasePointerCapture?.(event.pointerId);
    if (!gesture) return;
    if (gesture.type === 'pinch' && pointers.size === 1) { gesture = {type: 'pan', point: [...pointers.values()][0], camera: {...camera}, moved: true}; return; }
    const ended = gesture; gesture = null; viewport.classList.remove('is-dragging');
    if (event.type === 'pointercancel') { render(); return; }
    if (ended.type === 'node' && ended.moved) editMap(map => { map.nodes = ended.preview.nodes; });
    else if (ended.type !== 'node' && ended.moved) saveCamera();
    else if (ended.type === 'pan') { selectedId = null; selectedEdge = null; render(); }
    if (ended.type === 'node') focusSelected();
  }
  viewport.addEventListener('pointerup', endPointer); viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('wheel', event => {
    if (!mapNow() || gesture) return; event.preventDefault(); zoom(Math.exp(-event.deltaY * .0015), point(event));
    clearTimeout(wheelTimer); wheelTimer = setTimeout(saveCamera, 150);
  }, {passive: false});
  document.addEventListener('keydown', event => {
    if (view.hidden || !view.contains(event.target) || Array.from(document.querySelectorAll('dialog')).some(dialog => dialog.open)) return;
    const target = event.target;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (gesture) {
      if (event.key === 'Escape') { gesture = null; pointers.clear(); viewport.classList.remove('is-dragging'); render(); }
      return;
    }
    if (event.key === 'Escape') { connecting = false; connectSource = null; message = ''; render(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); store.redo(); }
    else if (event.key === 'Tab' && !connecting && !event.shiftKey && selectedId && (target.closest('.mm-node') || target === viewport)) { event.preventDefault(); add(true); }
    else if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key) && target.closest('.mm-node')) {
      const nodes = D.visibleNodes(mapNow()), index = nodes.findIndex(node => node.id === selectedId);
      const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      event.preventDefault(); select(nodes[(index + step + nodes.length) % nodes.length].id);
    }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.15); saveCamera(); }
    else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.15); saveCamera(); }
    else if (event.key === 'Enter' && target.closest('.mm-node')) { select(target.closest('.mm-node').dataset.nodeId); $('mm-title').focus(); }
  });
  $('open-mindmaps').addEventListener('click', open); $('mm-back').addEventListener('click', close); $('mm-new').addEventListener('click', createMap);
  $('mm-map-select').addEventListener('change', event => { const mapId = event.target.value; saveCamera(); store.activate(mapId); render(); });
  $('mm-map-name').addEventListener('change', event => { const title = event.target.value.trim(); if (title) editMap(map => { map.title = title; }); else event.target.value = mapNow()?.title || ''; });
  $('mm-title').addEventListener('change', event => { const title = event.target.value.trim(); if (title) updateNode({title}); else event.target.value = nodeNow()?.title || ''; });
  $('mm-description').addEventListener('change', event => updateNode({description: event.target.value}));
  $('mm-color').addEventListener('change', event => updateNode({color: D.color(event.target.value)}));
  $('mm-collapse').addEventListener('click', () => editMap(map => { const node = map.nodes.find(node => node.id === selectedId); if (node) { node.collapsed = !node.collapsed; arrange(map); } }));
  $('mm-duplicate').addEventListener('click', () => { let duplicate; editMap(map => { duplicate = D.duplicateNode(map, selectedId); arrange(map); }); if (duplicate) select(duplicate.id); });
  $('mm-delete').addEventListener('click', deleteSelection); $('mm-remove-edge').addEventListener('click', deleteSelection);
  $('mm-connection-select').addEventListener('change', event => {
    selectedEdge = event.target.value || null; selectedId = null; connecting = false; connectSource = null; render({preserveNodes: true});
  });
  $('mm-task').addEventListener('click', () => { const node = nodeNow(); if (!node) return; NabnakPlanner.editTask(); $('edit-task-title').value = node.title; });
  $('task-dialog').addEventListener('close', () => { if (!view.hidden) focusSelected(); });
  // Calendar and goals remain available from the same sidebar while the map is open.
  document.addEventListener('nabnak:languagechange', () => { render(); });
  store.subscribe(kind => {
    if (kind !== 'view') { gesture = null; pointers.clear(); viewport.classList.remove('is-dragging'); }
    render({preserveNodes: kind === 'view'});
  });
  // A refresh/close must also flush a still-focused field, not just camera changes.
  window.addEventListener?.('pagehide', () => {
    if (view.hidden || store.isReadOnly()) return;
    const active = document.activeElement;
    if (['mm-title', 'mm-description', 'mm-map-name'].includes(active?.id)) active.dispatchEvent(new Event('change'));
    else if (active?.getAttribute('contenteditable') === 'true') active.blur();
    saveCamera();
  });
  toolbar(); render();
  window.NabnakMindmaps = {open, close, store, select, add, fit, center, svgExport, importJson};
})();
