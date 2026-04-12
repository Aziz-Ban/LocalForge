// @ts-nocheck
/**
 * flowchart.js — Visual node canvas for agents.
 * Uses window.LF shared state.
 */
window.FlowChart = (() => {
  const GRID_COL = 180;
  const GRID_ROW = 110;
  const COLS = 2;

  function getContainer() { return document.getElementById('flow-canvas'); }

  function posFor(idx) {
    return {
      x: 16 + (idx % COLS) * GRID_COL,
      y: 16 + Math.floor(idx / COLS) * GRID_ROW,
    };
  }

  function render() {
    const canvas = getContainer();
    if (!canvas) return;
    canvas.innerHTML = '';

    const visible = LF.activeProjectId === LF.GLOBAL_ID
      ? LF.agents.filter(a => !a.projectId || a.projectId === LF.GLOBAL_ID)
      : LF.agents.filter(a => a.projectId === LF.activeProjectId);

    if (!visible.length) {
      canvas.innerHTML = '<div class="flow-empty">No agents in this project.<br>Switch to list view to add one.</div>';
      return;
    }

    canvas.style.minHeight = (Math.ceil(visible.length / COLS) * GRID_ROW + 48) + 'px';

    visible.forEach((a, idx) => {
      const { x, y } = posFor(idx);
      const isOn = !!a.running;
      const node = document.createElement('div');
      node.className = 'fc-node' + (isOn ? ' fc-running' : '');
      node.id = 'fc-node-' + a.id;
      node.style.left = x + 'px';
      node.style.top = y + 'px';
      node.innerHTML =
        '<div class="fc-node-dot ' + (isOn ? 'on' : 'off') + '"></div>' +
        '<div class="fc-node-body">' +
          '<div class="fc-node-name">' + LF.esc(a.name) + '</div>' +
          '<div class="fc-node-sub">:' + a.port + '</div>' +
          '<div class="fc-node-status"></div>' +
        '</div>' +
        '<div class="fc-node-actions">' +
          (isOn
            ? '<button class="fc-btn fc-stop" data-stop="' + a.id + '">■</button>'
            : '<button class="fc-btn fc-start" data-start="' + a.id + '">▶</button>') +
        '</div>' +
        '<div class="fc-preview"></div>';
      canvas.appendChild(node);
    });
  }

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
        bubble.textContent = preview.length > 15 ? preview.substring(0, 15) + '…' : preview;
        bubble.classList.remove('fc-preview-show');
        void bubble.offsetWidth;
        bubble.classList.add('fc-preview-show');
        setTimeout(() => bubble.classList.remove('fc-preview-show'), 3500);
      }
    }
  }

  document.getElementById('flow-canvas').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.start) {
      const a = LF.agents.find(x => x.id === t.dataset.start);
      if (a) { t.textContent = '…'; t.disabled = true; LF.vscode.postMessage({ type: 'startAgent', agent: a }); }
    }
    if (t.dataset.stop) {
      t.textContent = '…'; t.disabled = true;
      LF.vscode.postMessage({ type: 'stopAgent', agentId: t.dataset.stop });
    }
  });

  return { render, triggerThinking, triggerActivity };
})();
