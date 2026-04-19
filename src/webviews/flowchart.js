// @ts-nocheck
/* global LF */
/**
 * flowchart.js — Premium visual node canvas.
 * Features: drag-to-connect, drag-to-reposition, pan, zoom, auto-center.
 */
window.FlowChart = (() => {
  const GRID_COL = 280;
  const GRID_ROW = 140;
  const COLS = 2;
  const NODE_W = 240;
  const NODE_H = 90;

  // ── State ─────────────────────────────────────────────────────
  let connectingFrom = null;
  let dragLine = null;

  // Node positions (persisted per session)
  let nodePositions = {};

  // Pan & zoom
  let panX = 0, panY = 0, zoom = 1;
  let isPanning = false, panStartX = 0, panStartY = 0, panStartPanX = 0, panStartPanY = 0;
  
  // Auto-fit tracking
  let isAutoCentered = true;
  let lastCenteredProject = null;

  // Node dragging
  let draggingNode = null;
  let dragNodeStartX = 0, dragNodeStartY = 0, dragNodeOrigX = 0, dragNodeOrigY = 0;

  // ── DOM ───────────────────────────────────────────────────────
  function getCanvas() { return document.getElementById('flow-canvas'); }
  function getWorld()  { return document.getElementById('fc-world'); }

  function ns(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

  function applyTransform() {
    const w = getWorld();
    if (w) w.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  function defaultPos(idx) {
    return {
      x: 40 + (idx % COLS) * GRID_COL,
      y: 40 + Math.floor(idx / COLS) * GRID_ROW,
    };
  }

  function getNodePos(agentId, idx) {
    if (nodePositions[agentId]) return nodePositions[agentId];
    return defaultPos(idx);
  }

  function nodeCenter(agentId, idx) {
    const p = getNodePos(agentId, idx);
    return { cx: p.x + NODE_W / 2, cy: p.y + NODE_H / 2 };
  }

  function visibleAgents() {
    return LF.activeProjectId === LF.GLOBAL_ID
      ? LF.agents.filter(a => !a.projectId || a.projectId === LF.GLOBAL_ID)
      : LF.agents.filter(a => a.projectId === LF.activeProjectId);
  }

  function screenToWorld(cx, cy) {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = (cx - rect.left - panX) / zoom;
    const y = (cy - rect.top - panY) / zoom;
    return { x, y };
  }

  // ── SVG ───────────────────────────────────────────────────────
  function buildSVG() {
    const svg = ns('svg');
    svg.id = 'fc-svg';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;z-index:0;';

    const defs = ns('defs');

    // Arrowhead for connections
    const m1 = ns('marker');
    m1.setAttribute('id', 'ah');
    m1.setAttribute('markerWidth', '12');
    m1.setAttribute('markerHeight', '8');
    m1.setAttribute('refX', '11');
    m1.setAttribute('refY', '4');
    m1.setAttribute('orient', 'auto');
    const p1 = ns('polygon');
    p1.setAttribute('points', '0 0, 12 4, 0 8');
    p1.setAttribute('fill', '#8b5cf6');
    m1.appendChild(p1);
    defs.appendChild(m1);

    // Arrowhead for drag preview
    const m2 = ns('marker');
    m2.setAttribute('id', 'ah-drag');
    m2.setAttribute('markerWidth', '12');
    m2.setAttribute('markerHeight', '8');
    m2.setAttribute('refX', '11');
    m2.setAttribute('refY', '4');
    m2.setAttribute('orient', 'auto');
    const p2 = ns('polygon');
    p2.setAttribute('points', '0 0, 12 4, 0 8');
    p2.setAttribute('fill', '#f472b6');
    m2.appendChild(p2);
    defs.appendChild(m2);

    svg.appendChild(defs);
    return svg;
  }

  function curvePath(x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  }

  // ── Connections ───────────────────────────────────────────────
  function addConnection(fromId, toId) {
    if (fromId === toId) return;
    LF.connections = LF.connections || [];
    if (LF.connections.some(c => c.from === fromId && c.to === toId)) return;
    LF.connections.push({ from: fromId, to: toId });
    LF.vscode.postMessage({ type: 'saveConnections', connections: LF.connections });
    render();
  }

  function removeConnection(fromId, toId) {
    LF.connections = (LF.connections || []).filter(c => !(c.from === fromId && c.to === toId));
    LF.vscode.postMessage({ type: 'saveConnections', connections: LF.connections });
    render();
  }

  // ── Model display name ────────────────────────────────────────
  function modelLabel(modelId) {
    if (!modelId) return '';
    const parts = modelId.split('/');
    const last = parts[parts.length - 1];
    return last.split(':')[0];
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.innerHTML = '';

    const agents = visibleAgents();

    if (!agents.length) {
      canvas.innerHTML = '<div class="flow-empty">No agents in this project.<br>Switch to list view to add one.</div>';
      return;
    }

    // World
    const world = document.createElement('div');
    world.id = 'fc-world';
    world.className = 'fc-world';
    world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    canvas.appendChild(world);

    // Compute world size based on node positions
    let maxX = 600, maxY = 400;
    agents.forEach((a, i) => {
      const p = getNodePos(a.id, i);
      if (p.x + NODE_W + 40 > maxX) maxX = p.x + NODE_W + 40;
      if (p.y + NODE_H + 60 > maxY) maxY = p.y + NODE_H + 60;
    });
    world.style.width = maxX + 'px';
    world.style.height = maxY + 'px';

    // SVG
    const svg = buildSVG();
    world.appendChild(svg);

    // Draw connections
    const connections = LF.connections || [];
    connections.forEach(({ from, to }) => {
      const fi = agents.findIndex(a => a.id === from);
      const ti = agents.findIndex(a => a.id === to);
      if (fi < 0 || ti < 0) return;
      const s = nodeCenter(from, fi);
      const e = nodeCenter(to, ti);
      const d = curvePath(s.cx, s.cy, e.cx, e.cy);

      const glow = ns('path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', '#8b5cf6');
      glow.setAttribute('stroke-width', '8');
      glow.setAttribute('stroke-opacity', '0.08');
      glow.setAttribute('fill', 'none');
      svg.appendChild(glow);

      const hit = ns('path');
      hit.setAttribute('d', d);
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '16');
      hit.setAttribute('fill', 'none');
      hit.style.pointerEvents = 'stroke';
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', () => removeConnection(from, to));
      svg.appendChild(hit);

      const path = ns('path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#8b5cf6');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '8,4');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#ah)');
      path.classList.add('fc-arrow');
      svg.appendChild(path);
    });

    // Render nodes
    agents.forEach((a, idx) => {
      const pos = getNodePos(a.id, idx);
      const on = !!a.running;
      const model = modelLabel(a.modelId);
      const node = document.createElement('div');
      node.className = 'fc-node' + (on ? ' fc-running' : '');
      node.id = 'fc-node-' + a.id;
      node.dataset.agentId = a.id;
      node.style.left = pos.x + 'px';
      node.style.top = pos.y + 'px';
      node.style.width = NODE_W + 'px';

      node.innerHTML = `
        <div class="fc-node-header">
          <div class="fc-node-dot ${on ? 'on' : ''}"></div>
          <div class="fc-node-title">${LF.esc(a.name)}</div>
          <div class="fc-node-actions">
            ${on
              ? `<button class="fc-btn fc-stop" data-stop="${a.id}" title="Stop">\u25A0</button>`
              : `<button class="fc-btn fc-start" data-start="${a.id}" title="Start">\u25B6</button>`
            }
            <button class="fc-btn fc-link" data-connect="${a.id}" title="Drag to connect">\u2192</button>
          </div>
        </div>
        <div class="fc-node-detail">
          ${model ? `<span class="fc-tag fc-tag-model">${LF.esc(model)}</span>` : ''}
          <span class="fc-tag fc-tag-port">:${a.port}</span>
          ${on ? '<span class="fc-tag fc-tag-live">\u25CF live</span>' : ''}
        </div>
        <div class="fc-node-status"></div>
        <div class="fc-preview"></div>
      `;
      world.appendChild(node);

      // Restore thinking state
      if (LF.thinkingAgents.has(a.id)) {
        node.classList.add('fc-thinking');
        const s = node.querySelector('.fc-node-status');
        if (s) s.textContent = 'thinking\u2026';
      }
    });

    // Auto-center bounds checking
    if (lastCenteredProject !== LF.activeProjectId) {
      lastCenteredProject = LF.activeProjectId;
      isAutoCentered = true;
      requestAnimationFrame(resetView);
    } else if (isAutoCentered) {
      requestAnimationFrame(resetView);
    }
  }

  // ── Node dragging ─────────────────────────────────────────────
  function onNodeDragStart(e) {
    if (e.target.closest('button')) return;
    const node = e.target.closest('.fc-node');
    if (!node) return;

    e.preventDefault();
    e.stopPropagation();
    draggingNode = node;
    const rect = node.getBoundingClientRect();
    const cvsRect = getCanvas().getBoundingClientRect();

    dragNodeStartX = e.clientX;
    dragNodeStartY = e.clientY;
    dragNodeOrigX = (rect.left - cvsRect.left - panX) / zoom;
    dragNodeOrigY = (rect.top - cvsRect.top - panY) / zoom;

    node.style.zIndex = '100';
    document.addEventListener('mousemove', onNodeDragMove, true);
    document.addEventListener('mouseup', onNodeDragEnd, true);
  }

  function onNodeDragMove(e) {
    if (!draggingNode) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = (e.clientX - dragNodeStartX) / zoom;
    const dy = (e.clientY - dragNodeStartY) / zoom;

    const nx = Math.max(0, dragNodeOrigX + dx);
    const ny = Math.max(0, dragNodeOrigY + dy);

    draggingNode.style.left = nx + 'px';
    draggingNode.style.top = ny + 'px';

    const aid = draggingNode.dataset.agentId;
    nodePositions[aid] = { x: nx, y: ny };

    // Update lines instantly
    const agents = visibleAgents();
    const fi = agents.findIndex(a => a.id === aid);
    if (fi < 0) return;
    const center = nodeCenter(aid, fi);

    const svg = document.getElementById('fc-svg');
    if (!svg) return;

    (LF.connections || []).forEach((c, idx) => {
      if (c.from === aid) {
        const ti = agents.findIndex(a => a.id === c.to);
        if (ti >= 0) {
          const tc = nodeCenter(c.to, ti);
          const p = curvePath(center.cx, center.cy, tc.cx, tc.cy);
          const paths = svg.querySelectorAll(`path:nth-child(${idx * 3 + 1}), path:nth-child(${idx * 3 + 2}), path:nth-child(${idx * 3 + 3})`);
          paths.forEach(pt => pt.setAttribute('d', p));
        }
      }
      if (c.to === aid) {
        const fi2 = agents.findIndex(a => a.id === c.from);
        if (fi2 >= 0) {
          const fc = nodeCenter(c.from, fi2);
          const p = curvePath(fc.cx, fc.cy, center.cx, center.cy);
          const paths = svg.querySelectorAll(`path:nth-child(${idx * 3 + 1}), path:nth-child(${idx * 3 + 2}), path:nth-child(${idx * 3 + 3})`);
          paths.forEach(pt => pt.setAttribute('d', p));
        }
      }
    });

    const w = getWorld();
    let maxX = parseFloat(w.style.width);
    let maxY = parseFloat(w.style.height);
    if (nx + NODE_W + 40 > maxX) w.style.width = (nx + NODE_W + 40) + 'px';
    if (ny + NODE_H + 60 > maxY) w.style.height = (ny + NODE_H + 60) + 'px';
  }

  function onNodeDragEnd(e) {
    if (!draggingNode) return;
    e.preventDefault();
    e.stopPropagation();
    draggingNode.style.zIndex = '';
    draggingNode = null;
    document.removeEventListener('mousemove', onNodeDragMove, true);
    document.removeEventListener('mouseup', onNodeDragEnd, true);
    LF.vscode.postMessage({ type: 'saveNodePositions', positions: nodePositions });
  }

  // ── Pan ───────────────────────────────────────────────────────
  function onCanvasMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('.fc-node')) return;
    if (e.button !== 0 && e.button !== 1) return;
    isPanning = true;
    panStartX = e.clientX; panStartY = e.clientY;
    panStartPanX = panX; panStartPanY = panY;
    getCanvas().classList.add('fc-panning');
    document.addEventListener('mousemove', onPanMove, true);
    document.addEventListener('mouseup', onPanEnd, true);
    e.preventDefault();
  }

  function onPanMove(e) {
    if (!isPanning) return;
    isAutoCentered = false;
    panX = panStartPanX + (e.clientX - panStartX);
    panY = panStartPanY + (e.clientY - panStartY);
    applyTransform();
  }

  function onPanEnd() {
    isPanning = false;
    getCanvas().classList.remove('fc-panning');
    document.removeEventListener('mousemove', onPanMove, true);
    document.removeEventListener('mouseup', onPanEnd, true);
  }

  // ── Zoom ──────────────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    isAutoCentered = false;
    const rect = getCanvas().getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const old = zoom;
    zoom = Math.min(3, Math.max(0.25, zoom + (e.deltaY > 0 ? -0.08 : 0.08)));
    panX = mx - (mx - panX) * (zoom / old);
    panY = my - (my - panY) * (zoom / old);
    applyTransform();
    const zi = document.getElementById('fc-zoom-indicator');
    if (zi) zi.textContent = Math.round(zoom * 100) + '%';
  }

  function resetView() {
    isAutoCentered = true;
    const canvas = getCanvas();
    if (!canvas) return;
    const agents = visibleAgents();
    
    if (!agents.length) {
      panX = 0; panY = 0; zoom = 1;
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      agents.forEach((a, i) => {
        const p = getNodePos(a.id, i);
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x + NODE_W > maxX) maxX = p.x + NODE_W;
        if (p.y + NODE_H > maxY) maxY = p.y + NODE_H;
      });
      
      const graphW = maxX - minX;
      const graphH = maxY - minY;
      
      const cw = canvas.clientWidth || window.innerWidth;
      const ch = canvas.clientHeight || window.innerHeight;
      
      const paddingX = 60;
      const paddingY = 60;
      
      const scaleX = (cw - paddingX * 2) / Math.max(1, graphW);
      const scaleY = (ch - paddingY * 2) / Math.max(1, graphH);
      
      zoom = Math.max(0.25, Math.min(1, scaleX, scaleY));
      
      panX = (cw - graphW * zoom) / 2 - minX * zoom;
      panY = 60 - minY * zoom; // Top-align, 60px from the top
    }

    applyTransform();
    const zi = document.getElementById('fc-zoom-indicator');
    if (zi) zi.textContent = Math.round(zoom * 100) + '%';
  }

  // ── Connect drag ──────────────────────────────────────────────
  function onConnectStart(e) {
    const btn = e.target.closest('[data-connect]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    connectingFrom = btn.dataset.connect;

    document.querySelectorAll('.fc-node').forEach(n => {
      n.classList.add(n.dataset.agentId === connectingFrom ? 'fc-source' : 'fc-target');
    });

    const svg = document.getElementById('fc-svg');
    if (svg) {
      dragLine = ns('path');
      dragLine.setAttribute('stroke', '#f472b6');
      dragLine.setAttribute('stroke-width', '2.5');
      dragLine.setAttribute('stroke-dasharray', '6,4');
      dragLine.setAttribute('fill', 'none');
      dragLine.setAttribute('marker-end', 'url(#ah-drag)');
      dragLine.style.pointerEvents = 'none';
      svg.appendChild(dragLine);
    }
    document.addEventListener('mousemove', onConnectMove, true);
    document.addEventListener('mouseup', onConnectEnd, true);
  }

  function onConnectMove(e) {
    if (!connectingFrom || !dragLine) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const agents = visibleAgents();
    const fi = agents.findIndex(a => a.id === connectingFrom);
    if (fi < 0) return;
    const s = nodeCenter(connectingFrom, fi);
    dragLine.setAttribute('d', curvePath(s.cx, s.cy, w.x, w.y));
  }

  function onConnectEnd(e) {
    document.removeEventListener('mousemove', onConnectMove, true);
    document.removeEventListener('mouseup', onConnectEnd, true);
    if (!connectingFrom) return;

    if (dragLine) { dragLine.remove(); dragLine = null; }

    const targetNode = e.target.closest('.fc-node');
    if (targetNode) {
      const toId = targetNode.dataset.agentId;
      addConnection(connectingFrom, toId);
    }

    connectingFrom = null;
    document.querySelectorAll('.fc-source, .fc-target').forEach(n => n.classList.remove('fc-source', 'fc-target'));
  }

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.start) { btn.textContent = '…'; btn.disabled = true; LF.vscode.postMessage({ type: 'startAgent', agentId: btn.dataset.start }); }
    if (btn.dataset.stop) { btn.textContent = '…'; btn.disabled = true; LF.vscode.postMessage({ type: 'stopAgent', agentId: btn.dataset.stop }); }
  }

  // ── Bind events ───────────────────────────────────────────────
  const canvas = getCanvas();
  if (canvas) {
    canvas.addEventListener('mousedown', onConnectStart);
    canvas.addEventListener('mousedown', onNodeDragStart);
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && connectingFrom) {
      if (dragLine) { dragLine.remove(); dragLine = null; }
      connectingFrom = null;
      document.querySelectorAll('.fc-source, .fc-target').forEach(n => n.classList.remove('fc-source', 'fc-target'));
    }
    if (e.key === '0' && e.ctrlKey) { e.preventDefault(); resetView(); }
  });

  // ── Output routing ────────────────────────────────────────────
  function routeOutput(fromAgentId, output) {
    (LF.connections || []).filter(c => c.from === fromAgentId).forEach(c => {
      LF.vscode.postMessage({ type: 'agentInput', agentId: c.to, input: output, sourceAgentId: fromAgentId });
      triggerActivity(c.to, output);
    });
  }

  // ── Public API ────────────────────────────────────────────────
  function triggerThinking(agentId) {
    const node = document.getElementById('fc-node-' + agentId);
    if (!node) return;
    node.classList.add('fc-thinking');
    const s = node.querySelector('.fc-node-status');
    if (s) s.textContent = 'thinking…';
  }

  function triggerActivity(agentId, preview) {
    const node = document.getElementById('fc-node-' + agentId);
    if (!node) return;
    node.classList.remove('fc-thinking');
    const s = node.querySelector('.fc-node-status');
    if (s) s.textContent = '';
    node.classList.remove('fc-activity');
    void node.offsetWidth;
    node.classList.add('fc-activity');
    if (preview) {
      const bubble = node.querySelector('.fc-preview');
      if (bubble) {
        bubble.textContent = preview.length > 40 ? preview.slice(0, 40) + '…' : preview;
        bubble.classList.remove('fc-preview-show');
        void bubble.offsetWidth;
        bubble.classList.add('fc-preview-show');
        setTimeout(() => bubble.classList.remove('fc-preview-show'), 3500);
      }
    }
  }

  // ── Initialization (Toolbar) ──────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    const centerBtn = document.getElementById('fc-btn-center');
    const zinBtn = document.getElementById('fc-btn-zin');
    const zoutBtn = document.getElementById('fc-btn-zout');
    
    if (centerBtn) centerBtn.addEventListener('click', resetView);
    
    if (zinBtn) zinBtn.addEventListener('click', () => {
      isAutoCentered = false;
      zoom = Math.min(3, zoom + 0.15);
      applyTransform();
      const ind = document.getElementById('fc-zoom-indicator');
      if (ind) ind.textContent = Math.round(zoom * 100) + '%';
    });
    
    if (zoutBtn) zoutBtn.addEventListener('click', () => {
      isAutoCentered = false;
      zoom = Math.max(0.25, zoom - 0.15);
      applyTransform();
      const ind = document.getElementById('fc-zoom-indicator');
      if (ind) ind.textContent = Math.round(zoom * 100) + '%';
    });

    window.addEventListener('resize', () => {
      if (LF.activeView === 'flowchart') {
        resetView();
      }
    });
  });

  return { render, triggerThinking, triggerActivity, routeOutput, resetView };
})();
